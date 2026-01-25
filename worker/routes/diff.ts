import type { Env, CorsHeaders, Instance, Namespace } from "../types";
import { jsonResponse, errorResponse, parseJsonBody } from "../utils/helpers";
import { logWarning } from "../utils/error-logger";

/**
 * Diff result for comparing two instances
 */
interface DiffResult {
  instanceA: {
    id: string;
    name: string;
    namespaceId: string;
    namespaceName: string;
  };
  instanceB: {
    id: string;
    name: string;
    namespaceId: string;
    namespaceName: string;
  };
  onlyInA: string[];
  onlyInB: string[];
  different: {
    key: string;
    valueA: unknown;
    valueB: unknown;
  }[];
  identical: string[];
  summary: {
    totalA: number;
    totalB: number;
    onlyInACount: number;
    onlyInBCount: number;
    differentCount: number;
    identicalCount: number;
  };
}

/**
 * Mock storage data for diff in local development
 */
const MOCK_STORAGE: Record<string, Record<string, unknown>> = {
  "inst-1": {
    "user:1": { name: "Alice", role: "admin" },
    "user:2": { name: "Bob", role: "member" },
    settings: { theme: "dark" },
    config: { version: 1 },
  },
  "inst-2": {
    "user:1": { name: "Alice", role: "user" }, // Different from inst-1
    "user:3": { name: "Charlie", role: "member" }, // Only in inst-2
    settings: { theme: "dark" }, // Same as inst-1
  },
  "inst-3": {
    counter: 42,
    lastUpdate: "2024-03-03T09:15:00Z",
  },
};

/**
 * Handle diff routes
 */
export async function handleDiffRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null,
): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/instances/diff - Compare two instances
  if (method === "POST" && path === "/api/instances/diff") {
    return compareInstances(request, env, corsHeaders, isLocalDev);
  }

  return errorResponse("Not Found", corsHeaders, 404);
}

/**
 * Fetch storage data for an instance via admin hook
 */
async function fetchInstanceStorage(
  instance: Instance,
  namespace: Namespace,
): Promise<Record<string, unknown>> {
  if (!namespace.endpoint_url || namespace.admin_hook_enabled !== 1) {
    throw new Error(
      `Admin hook not configured for namespace ${namespace.name}`,
    );
  }

  const baseUrl = namespace.endpoint_url.replace(/\/+$/, "");
  const instanceName = instance.object_id;

  // First, get list of keys
  const listResponse = await fetch(
    `${baseUrl}/admin/${encodeURIComponent(instanceName)}/list`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!listResponse.ok) {
    throw new Error(
      `Failed to list keys for ${instanceName}: ${String(listResponse.status)}`,
    );
  }

  const listData: { keys?: string[] } = await listResponse.json();
  const keys = listData.keys ?? [];

  // Fetch values for each key
  const storage: Record<string, unknown> = {};
  for (const key of keys) {
    try {
      const getResponse = await fetch(
        `${baseUrl}/admin/${encodeURIComponent(instanceName)}/get?key=${encodeURIComponent(key)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (getResponse.ok) {
        const data: { value?: unknown } = await getResponse.json();
        storage[key] = data.value ?? data;
      }
    } catch (err) {
      logWarning(
        `Failed to fetch key ${key}: ${err instanceof Error ? err.message : String(err)}`,
        {
          module: "diff",
          operation: "fetch_key",
          metadata: {
            key,
            error: err instanceof Error ? err.message : String(err),
          },
        },
      );
    }
  }

  return storage;
}

/**
 * Compare storage between two instances
 */
async function compareInstances(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
): Promise<Response> {
  interface CompareBody {
    instanceIdA: string;
    instanceIdB: string;
  }

  const body = await parseJsonBody<CompareBody>(request);
  if (!body?.instanceIdA || !body.instanceIdB) {
    return errorResponse(
      "instanceIdA and instanceIdB are required",
      corsHeaders,
      400,
    );
  }

  if (body.instanceIdA === body.instanceIdB) {
    return errorResponse(
      "Cannot compare an instance with itself",
      corsHeaders,
      400,
    );
  }

  if (isLocalDev) {
    // Mock diff for local development
    const storageA = MOCK_STORAGE[body.instanceIdA] ?? {};
    const storageB = MOCK_STORAGE[body.instanceIdB] ?? {};

    const result = computeDiff(
      storageA,
      storageB,
      {
        id: body.instanceIdA,
        name: `Instance ${body.instanceIdA}`,
        namespaceId: "ns-1",
        namespaceName: "Mock Namespace",
      },
      {
        id: body.instanceIdB,
        name: `Instance ${body.instanceIdB}`,
        namespaceId: "ns-1",
        namespaceName: "Mock Namespace",
      },
    );

    return jsonResponse({ diff: result }, corsHeaders);
  }

  try {
    // Fetch instance A
    const instanceA = await env.METADATA.prepare(
      "SELECT * FROM instances WHERE id = ?",
    )
      .bind(body.instanceIdA)
      .first<Instance>();

    if (!instanceA) {
      return errorResponse("Instance A not found", corsHeaders, 404);
    }

    // Fetch instance B
    const instanceB = await env.METADATA.prepare(
      "SELECT * FROM instances WHERE id = ?",
    )
      .bind(body.instanceIdB)
      .first<Instance>();

    if (!instanceB) {
      return errorResponse("Instance B not found", corsHeaders, 404);
    }

    // Fetch namespaces
    const namespaceA = await env.METADATA.prepare(
      "SELECT * FROM namespaces WHERE id = ?",
    )
      .bind(instanceA.namespace_id)
      .first<Namespace>();

    const namespaceB = await env.METADATA.prepare(
      "SELECT * FROM namespaces WHERE id = ?",
    )
      .bind(instanceB.namespace_id)
      .first<Namespace>();

    if (!namespaceA || !namespaceB) {
      return errorResponse("Namespace not found", corsHeaders, 404);
    }

    // Fetch storage for both instances
    const [storageA, storageB] = await Promise.all([
      fetchInstanceStorage(instanceA, namespaceA),
      fetchInstanceStorage(instanceB, namespaceB),
    ]);

    const result = computeDiff(
      storageA,
      storageB,
      {
        id: instanceA.id,
        name: instanceA.name ?? instanceA.object_id,
        namespaceId: namespaceA.id,
        namespaceName: namespaceA.name,
      },
      {
        id: instanceB.id,
        name: instanceB.name ?? instanceB.object_id,
        namespaceId: namespaceB.id,
        namespaceName: namespaceB.name,
      },
    );

    return jsonResponse({ diff: result }, corsHeaders);
  } catch (error) {
    logWarning(
      `Compare error: ${error instanceof Error ? error.message : String(error)}`,
      {
        module: "diff",
        operation: "compare",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
    return errorResponse(
      `Failed to compare instances: ${error instanceof Error ? error.message : "Unknown error"}`,
      corsHeaders,
      500,
    );
  }
}

/**
 * Compute the diff between two storage objects
 */
function computeDiff(
  storageA: Record<string, unknown>,
  storageB: Record<string, unknown>,
  instanceInfoA: {
    id: string;
    name: string;
    namespaceId: string;
    namespaceName: string;
  },
  instanceInfoB: {
    id: string;
    name: string;
    namespaceId: string;
    namespaceName: string;
  },
): DiffResult {
  const keysA = new Set(Object.keys(storageA));
  const keysB = new Set(Object.keys(storageB));

  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const different: { key: string; valueA: unknown; valueB: unknown }[] = [];
  const identical: string[] = [];

  // Find keys only in A
  for (const key of keysA) {
    if (!keysB.has(key)) {
      onlyInA.push(key);
    }
  }

  // Find keys only in B
  for (const key of keysB) {
    if (!keysA.has(key)) {
      onlyInB.push(key);
    }
  }

  // Compare common keys
  for (const key of keysA) {
    if (keysB.has(key)) {
      const valueA = storageA[key];
      const valueB = storageB[key];

      if (JSON.stringify(valueA) === JSON.stringify(valueB)) {
        identical.push(key);
      } else {
        different.push({ key, valueA, valueB });
      }
    }
  }

  // Sort all arrays
  onlyInA.sort();
  onlyInB.sort();
  different.sort((a, b) => a.key.localeCompare(b.key));
  identical.sort();

  return {
    instanceA: instanceInfoA,
    instanceB: instanceInfoB,
    onlyInA,
    onlyInB,
    different,
    identical,
    summary: {
      totalA: keysA.size,
      totalB: keysB.size,
      onlyInACount: onlyInA.length,
      onlyInBCount: onlyInB.length,
      differentCount: different.length,
      identicalCount: identical.length,
    },
  };
}
