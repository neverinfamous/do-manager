/**
 * Migration Routes
 *
 * API endpoints for migrating instances between namespaces.
 */

import type {
  Env,
  CorsHeaders,
  Instance,
  Namespace,
  ErrorContext,
} from "../types";
import {
  jsonResponse,
  errorResponse,
  generateId,
  nowISO,
  parseJsonBody,
  createJob,
  completeJob,
  failJob,
} from "../utils/helpers";
import { logInfo, logError } from "../utils/error-logger";

/**
 * Cutover mode for migration
 */
type CutoverMode = "copy" | "copy_freeze" | "copy_delete";

/**
 * Migration request body
 */
interface MigrateInstanceBody {
  targetNamespaceId: string;
  targetInstanceName?: string;
  cutoverMode: CutoverMode;
  migrateAlarms?: boolean;
  runVerification?: boolean;
}

/**
 * Migration verification result
 */
interface VerificationResult {
  passed: boolean;
  sourceKeyCount: number;
  targetKeyCount: number;
}

/**
 * Migration response
 */
interface MigrateInstanceResponse {
  success: boolean;
  newInstance: Instance;
  sourceFrozen: boolean;
  sourceDeleted: boolean;
  verification?: VerificationResult;
  warnings?: string[];
}

/**
 * Helper to create error context
 */
function createContext(
  operation: string,
  userEmail: string | null,
  metadata?: Record<string, unknown>,
): ErrorContext {
  const ctx: ErrorContext = { module: "migrate", operation };
  if (userEmail) {
    ctx.userId = userEmail;
  }
  if (metadata) {
    ctx.metadata = metadata;
  }
  return ctx;
}

/**
 * Handle migration-related API routes
 */
export async function handleMigrateRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/instances/:id/migrate - Migrate instance to another namespace
  const migrateMatch = /^\/api\/instances\/([^/]+)\/migrate$/.exec(path);
  if (method === "POST" && migrateMatch) {
    const instanceId = migrateMatch[1];
    if (!instanceId) {
      return errorResponse("Instance ID required", corsHeaders, 400);
    }
    return migrateInstance(
      request,
      instanceId,
      env,
      corsHeaders,
      isLocalDev,
      userEmail,
    );
  }

  return errorResponse("Not Found", corsHeaders, 404);
}

/**
 * Migrate an instance to another namespace
 */
async function migrateInstance(
  request: Request,
  sourceInstanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<MigrateInstanceBody>(request);

  if (!body?.targetNamespaceId) {
    return errorResponse("targetNamespaceId is required", corsHeaders, 400);
  }

  const cutoverMode = body.cutoverMode ?? "copy";
  const migrateAlarms = body.migrateAlarms ?? false;
  const runVerification = body.runVerification ?? true;
  const targetInstanceName = body.targetInstanceName?.trim();

  // Validate cutover mode
  if (!["copy", "copy_freeze", "copy_delete"].includes(cutoverMode)) {
    return errorResponse(
      "Invalid cutoverMode. Must be: copy, copy_freeze, or copy_delete",
      corsHeaders,
      400,
    );
  }

  logInfo(
    `Starting migration for instance ${sourceInstanceId}`,
    createContext("migrate_start", userEmail, {
      targetNamespaceId: body.targetNamespaceId,
      cutoverMode,
      migrateAlarms,
    }),
  );

  // Mock for local development
  if (isLocalDev) {
    const mockResponse: MigrateInstanceResponse = {
      success: true,
      newInstance: {
        id: generateId(),
        namespace_id: body.targetNamespaceId,
        name: targetInstanceName ?? "migrated-instance",
        object_id: targetInstanceName ?? "migrated-instance",
        last_accessed: nowISO(),
        storage_size_bytes: 1024,
        has_alarm: migrateAlarms ? 1 : 0,
        color: null,
        created_at: nowISO(),
        updated_at: nowISO(),
        metadata: null,
        tags: [],
      },
      sourceFrozen: cutoverMode === "copy_freeze",
      sourceDeleted: cutoverMode === "copy_delete",
      ...(runVerification
        ? {
            verification: {
              passed: true,
              sourceKeyCount: 10,
              targetKeyCount: 10,
            },
          }
        : {}),
      warnings: [],
    };
    return jsonResponse(mockResponse, corsHeaders, 201);
  }

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "migrate_instance",
    userEmail,
    null,
    sourceInstanceId,
  );
  const warnings: string[] = [];

  try {
    // Get source instance
    const sourceInstance = await env.METADATA.prepare(
      "SELECT * FROM instances WHERE id = ?",
    )
      .bind(sourceInstanceId)
      .first<Instance>();

    if (!sourceInstance) {
      await failJob(env.METADATA, jobId, "Source instance not found");
      return errorResponse("Source instance not found", corsHeaders, 404);
    }

    // Get source namespace
    const sourceNamespace = await env.METADATA.prepare(
      "SELECT * FROM namespaces WHERE id = ?",
    )
      .bind(sourceInstance.namespace_id)
      .first<Namespace>();

    if (!sourceNamespace?.endpoint_url) {
      await failJob(
        env.METADATA,
        jobId,
        "Source namespace endpoint not configured",
      );
      return errorResponse(
        "Source namespace endpoint not configured. Set up admin hook first.",
        corsHeaders,
        400,
      );
    }

    // Get target namespace
    const targetNamespace = await env.METADATA.prepare(
      "SELECT * FROM namespaces WHERE id = ?",
    )
      .bind(body.targetNamespaceId)
      .first<Namespace>();

    if (!targetNamespace) {
      await failJob(env.METADATA, jobId, "Target namespace not found");
      return errorResponse("Target namespace not found", corsHeaders, 404);
    }

    if (!targetNamespace.endpoint_url) {
      await failJob(
        env.METADATA,
        jobId,
        "Target namespace endpoint not configured",
      );
      return errorResponse(
        "Target namespace endpoint not configured. Set up admin hook first.",
        corsHeaders,
        400,
      );
    }

    // Prevent migrating to same namespace
    if (sourceNamespace.id === targetNamespace.id) {
      await failJob(
        env.METADATA,
        jobId,
        "Cannot migrate to the same namespace",
      );
      return errorResponse(
        "Cannot migrate to the same namespace. Use clone instead.",
        corsHeaders,
        400,
      );
    }

    // Determine target instance name
    const finalTargetName =
      targetInstanceName ?? sourceInstance.name ?? sourceInstance.object_id;

    // Check if target name already exists in target namespace
    const existingTarget = await env.METADATA.prepare(
      "SELECT id FROM instances WHERE namespace_id = ? AND (name = ? OR object_id = ?)",
    )
      .bind(body.targetNamespaceId, finalTargetName, finalTargetName)
      .first<{ id: string }>();

    if (existingTarget) {
      await failJob(
        env.METADATA,
        jobId,
        "Instance with this name already exists in target namespace",
      );
      return errorResponse(
        "Instance with this name already exists in target namespace",
        corsHeaders,
        409,
      );
    }

    const sourceBaseUrl = sourceNamespace.endpoint_url.replace(/\/+$/, "");
    const targetBaseUrl = targetNamespace.endpoint_url.replace(/\/+$/, "");
    const sourceInstanceName = sourceInstance.object_id;

    // Step 1: Export data from source instance
    logInfo(
      "Exporting from source instance",
      createContext("EXPORT", userEmail),
    );
    const exportResponse = await fetch(
      `${sourceBaseUrl}/admin/${encodeURIComponent(sourceInstanceName)}/export`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!exportResponse.ok) {
      const errorText = await exportResponse
        .text()
        .catch(() => "Unknown error");
      await failJob(
        env.METADATA,
        jobId,
        `Export failed: ${String(exportResponse.status)}`,
      );
      return errorResponse(
        `Failed to export source instance: ${errorText.slice(0, 100)}`,
        corsHeaders,
        exportResponse.status,
      );
    }

    interface ExportData {
      data: Record<string, unknown>;
      keyCount?: number;
    }
    const exportData: ExportData = await exportResponse.json();
    const sourceKeyCount =
      exportData.keyCount ?? Object.keys(exportData.data ?? {}).length;
    logInfo(
      `Export returned ${sourceKeyCount} keys`,
      createContext("export_result", userEmail, { keyCount: sourceKeyCount }),
    );

    // Step 2: Import data to target instance
    logInfo("Importing to target instance", createContext("IMPORT", userEmail));
    const importResponse = await fetch(
      `${targetBaseUrl}/admin/${encodeURIComponent(finalTargetName)}/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: exportData.data }),
      },
    );

    if (!importResponse.ok) {
      const errorText = await importResponse
        .text()
        .catch(() => "Unknown error");
      await failJob(
        env.METADATA,
        jobId,
        `Import failed: ${String(importResponse.status)}`,
      );
      return errorResponse(
        `Failed to import to target instance: ${errorText.slice(0, 100)}`,
        corsHeaders,
        importResponse.status,
      );
    }

    // Step 3: Migrate alarm if requested
    if (migrateAlarms && sourceInstance.has_alarm) {
      try {
        const alarmResponse = await fetch(
          `${sourceBaseUrl}/admin/${encodeURIComponent(sourceInstanceName)}/alarm`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );

        if (alarmResponse.ok) {
          const alarmData = (await alarmResponse.json()) as {
            alarm: number | null;
          };
          if (alarmData.alarm !== null) {
            await fetch(
              `${targetBaseUrl}/admin/${encodeURIComponent(finalTargetName)}/alarm`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timestamp: alarmData.alarm }),
              },
            );
          }
        }
      } catch {
        warnings.push("Failed to migrate alarm");
      }
    }

    // Step 4: Verify migration if requested
    let verification: VerificationResult | undefined;
    if (runVerification) {
      try {
        const verifyResponse = await fetch(
          `${targetBaseUrl}/admin/${encodeURIComponent(finalTargetName)}/export`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );

        if (verifyResponse.ok) {
          const verifyData: ExportData = await verifyResponse.json();
          const targetKeyCount =
            verifyData.keyCount ?? Object.keys(verifyData.data).length;
          verification = {
            passed: sourceKeyCount === targetKeyCount,
            sourceKeyCount,
            targetKeyCount,
          };

          if (!verification.passed) {
            warnings.push(
              `Key count mismatch: source=${sourceKeyCount}, target=${targetKeyCount}`,
            );
          }
        }
      } catch {
        warnings.push("Verification failed");
      }
    }

    // Step 5: Handle cutover mode
    let sourceFrozen = false;
    let sourceDeleted = false;

    if (cutoverMode === "copy_freeze") {
      const freezeUrl = `${sourceBaseUrl}/admin/${encodeURIComponent(sourceInstanceName)}/freeze`;
      logInfo(
        `Freezing source instance: ${freezeUrl}`,
        createContext("FREEZE", userEmail),
      );
      try {
        const freezeResponse = await fetch(freezeUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        });
        sourceFrozen = freezeResponse.ok;
        if (!freezeResponse.ok) {
          const errorText = await freezeResponse.text().catch(() => "Unknown");
          logInfo(
            `Freeze failed: ${freezeResponse.status} - ${errorText}`,
            createContext("FREEZE_FAILED", userEmail),
          );
          warnings.push("Failed to freeze source instance");
        } else {
          logInfo(
            "Source instance frozen successfully",
            createContext("FREEZE_SUCCESS", userEmail),
          );
        }
      } catch (error) {
        logInfo(
          `Freeze error: ${error instanceof Error ? error.message : String(error)}`,
          createContext("FREEZE_ERROR", userEmail),
        );
        warnings.push("Failed to freeze source instance");
      }
    } else if (cutoverMode === "copy_delete") {
      // Only delete if verification passed or was skipped
      if (!verification || verification.passed) {
        await env.METADATA.prepare("DELETE FROM instances WHERE id = ?")
          .bind(sourceInstanceId)
          .run();
        sourceDeleted = true;
      } else {
        warnings.push("Source not deleted due to verification failure");
      }
    }

    // Step 6: Create tracking record for new instance
    const newInstanceId = generateId();
    const now = nowISO();

    await env.METADATA.prepare(
      `
      INSERT INTO instances (id, namespace_id, name, object_id, last_accessed, color, created_at, updated_at, has_alarm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        newInstanceId,
        body.targetNamespaceId,
        finalTargetName,
        finalTargetName,
        now,
        sourceInstance.color,
        now,
        now,
        migrateAlarms && sourceInstance.has_alarm ? 1 : 0,
      )
      .run();

    const newInstance: Instance = {
      id: newInstanceId,
      namespace_id: body.targetNamespaceId,
      name: finalTargetName,
      object_id: finalTargetName,
      last_accessed: now,
      storage_size_bytes: sourceInstance.storage_size_bytes,
      has_alarm: migrateAlarms && sourceInstance.has_alarm ? 1 : 0,
      color: sourceInstance.color,
      created_at: now,
      updated_at: now,
      metadata: null,
      tags: [],
    };

    await completeJob(env.METADATA, jobId, {
      source_instance: sourceInstanceName,
      source_namespace: sourceNamespace.name,
      target_namespace: targetNamespace.name,
      target_instance: finalTargetName,
      cutover_mode: cutoverMode,
      source_frozen: sourceFrozen,
      source_deleted: sourceDeleted,
      key_count: sourceKeyCount,
    });

    logInfo(
      `Migration completed for instance ${sourceInstanceId}`,
      createContext("migrate_complete", userEmail, {
        newInstanceId,
        cutoverMode,
        sourceFrozen,
        sourceDeleted,
      }),
    );

    const response: MigrateInstanceResponse = {
      success: true,
      newInstance,
      sourceFrozen,
      sourceDeleted,
      ...(verification !== undefined ? { verification } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return jsonResponse(response, corsHeaders, 201);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError(
      env,
      `Migration failed: ${errorMessage}`,
      createContext("migrate_error", userEmail),
      isLocalDev,
    );
    await failJob(env.METADATA, jobId, errorMessage);
    return errorResponse(`Migration failed: ${errorMessage}`, corsHeaders, 500);
  }
}
