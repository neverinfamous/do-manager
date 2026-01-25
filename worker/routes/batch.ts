import type { Env, CorsHeaders, Instance, Namespace } from "../types";
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
import {
  triggerWebhooks,
  createBatchCompleteWebhookData,
} from "../utils/webhooks";
import { logWarning } from "../utils/error-logger";

/**
 * Batch operation request types
 */
interface BatchDeleteInstancesRequest {
  instanceIds?: string[];
}

interface BatchDeleteNamespacesRequest {
  namespaceIds?: string[];
}

interface BatchBackupRequest {
  instanceIds?: string[];
}

interface BatchExportInstancesRequest {
  instanceIds?: string[];
  namespaceId: string;
  namespaceName: string;
}

interface BatchExportNamespacesRequest {
  namespaceIds?: string[];
}

interface BatchDeleteKeysRequest {
  instanceId: string;
  instanceName: string;
  namespaceId: string;
  namespaceName: string;
  keys?: string[];
  successCount: number;
  failedCount: number;
}

interface BatchExportKeysRequest {
  instanceId: string;
  instanceName: string;
  namespaceId: string;
  namespaceName: string;
  keys?: string[];
  exportedCount: number;
}

interface BatchOperationResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
}

interface BatchBackupResult extends BatchOperationResult {
  backupId?: string;
  size?: number;
}

/**
 * Handle batch routes
 */
export async function handleBatchRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  // POST /api/batch/instances/delete - Batch delete instances
  if (method === "POST" && path === "/api/batch/instances/delete") {
    return batchDeleteInstances(
      request,
      env,
      corsHeaders,
      isLocalDev,
      userEmail,
    );
  }

  // POST /api/batch/instances/backup - Batch backup instances
  if (method === "POST" && path === "/api/batch/instances/backup") {
    return batchBackupInstances(
      request,
      env,
      corsHeaders,
      isLocalDev,
      userEmail,
    );
  }

  // POST /api/batch/instances/export - Log batch export instances job
  if (method === "POST" && path === "/api/batch/instances/export") {
    return batchExportInstances(request, env, corsHeaders, userEmail);
  }

  // POST /api/batch/namespaces/delete - Batch delete namespaces
  if (method === "POST" && path === "/api/batch/namespaces/delete") {
    return batchDeleteNamespaces(
      request,
      env,
      corsHeaders,
      isLocalDev,
      userEmail,
    );
  }

  // POST /api/batch/namespaces/export - Log batch export namespaces job
  if (method === "POST" && path === "/api/batch/namespaces/export") {
    return batchExportNamespaces(request, env, corsHeaders, userEmail);
  }

  // POST /api/batch/keys/delete - Log batch delete keys job
  if (method === "POST" && path === "/api/batch/keys/delete") {
    return batchDeleteKeys(request, env, corsHeaders, userEmail);
  }

  // POST /api/batch/keys/export - Log batch export keys job
  if (method === "POST" && path === "/api/batch/keys/export") {
    return batchExportKeys(request, env, corsHeaders, userEmail);
  }

  return errorResponse("Not Found", corsHeaders, 404);
}

/**
 * Batch delete instances
 */
async function batchDeleteInstances(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchDeleteInstancesRequest>(request);
  if (!body?.instanceIds || body.instanceIds.length === 0) {
    return errorResponse("instanceIds array is required", corsHeaders, 400);
  }

  const results: BatchOperationResult[] = [];

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_delete_instances",
    userEmail,
  );

  try {
    for (const instanceId of body.instanceIds) {
      try {
        // Get instance info for result
        const instance = await env.METADATA.prepare(
          "SELECT * FROM instances WHERE id = ?",
        )
          .bind(instanceId)
          .first<Instance>();

        if (!instance) {
          results.push({
            id: instanceId,
            name: "Unknown",
            success: false,
            error: "Instance not found",
          });
          continue;
        }

        if (isLocalDev) {
          // Mock delete for local dev
          results.push({
            id: instanceId,
            name: instance.name ?? instance.object_id,
            success: true,
          });
          continue;
        }

        // Delete the instance tracking record
        await env.METADATA.prepare("DELETE FROM instances WHERE id = ?")
          .bind(instanceId)
          .run();

        results.push({
          id: instanceId,
          name: instance.name ?? instance.object_id,
          success: true,
        });
      } catch (err) {
        results.push({
          id: instanceId,
          name: instanceId,
          success: false,
          error: err instanceof Error ? err.message : "Delete failed",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await completeJob(env.METADATA, jobId, {
      total: body.instanceIds.length,
      success: successCount,
      failed: failureCount,
      instances: results.filter((r) => r.success).map((r) => r.name),
    });

    // Trigger webhook
    void triggerWebhooks(
      env,
      "batch_complete",
      createBatchCompleteWebhookData(
        "batch_delete_instances",
        body.instanceIds.length,
        successCount,
        failureCount,
        userEmail,
      ),
      isLocalDev,
    );

    return jsonResponse(
      {
        results,
        summary: {
          total: body.instanceIds.length,
          success: successCount,
          failed: failureCount,
        },
      },
      corsHeaders,
    );
  } catch (error) {
    logWarning(
      `Delete instances error: ${error instanceof Error ? error.message : String(error)}`,
      {
        module: "batch",
        operation: "delete_instances",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
    await failJob(
      env.METADATA,
      jobId,
      error instanceof Error ? error.message : "Batch delete failed",
    );
    return errorResponse("Batch delete failed", corsHeaders, 500);
  }
}

/**
 * Batch delete namespaces
 */
async function batchDeleteNamespaces(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchDeleteNamespacesRequest>(request);
  if (!body?.namespaceIds || body.namespaceIds.length === 0) {
    return errorResponse("namespaceIds array is required", corsHeaders, 400);
  }

  const results: BatchOperationResult[] = [];

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_delete_namespaces",
    userEmail,
  );

  try {
    for (const namespaceId of body.namespaceIds) {
      try {
        // Get namespace info for result
        const namespace = await env.METADATA.prepare(
          "SELECT * FROM namespaces WHERE id = ?",
        )
          .bind(namespaceId)
          .first<Namespace>();

        if (!namespace) {
          results.push({
            id: namespaceId,
            name: "Unknown",
            success: false,
            error: "Namespace not found",
          });
          continue;
        }

        if (isLocalDev) {
          // Mock delete for local dev
          results.push({
            id: namespaceId,
            name: namespace.name,
            success: true,
          });
          continue;
        }

        // Delete the namespace tracking record
        await env.METADATA.prepare("DELETE FROM namespaces WHERE id = ?")
          .bind(namespaceId)
          .run();

        results.push({
          id: namespaceId,
          name: namespace.name,
          success: true,
        });
      } catch (err) {
        results.push({
          id: namespaceId,
          name: namespaceId,
          success: false,
          error: err instanceof Error ? err.message : "Delete failed",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await completeJob(env.METADATA, jobId, {
      total: body.namespaceIds.length,
      success: successCount,
      failed: failureCount,
      namespaces: results.filter((r) => r.success).map((r) => r.name),
    });

    // Trigger webhook
    void triggerWebhooks(
      env,
      "batch_complete",
      createBatchCompleteWebhookData(
        "batch_delete_namespaces",
        body.namespaceIds.length,
        successCount,
        failureCount,
        userEmail,
      ),
      isLocalDev,
    );

    return jsonResponse(
      {
        results,
        summary: {
          total: body.namespaceIds.length,
          success: successCount,
          failed: failureCount,
        },
      },
      corsHeaders,
    );
  } catch (error) {
    logWarning(
      `Delete namespaces error: ${error instanceof Error ? error.message : String(error)}`,
      {
        module: "batch",
        operation: "delete_namespaces",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
    await failJob(
      env.METADATA,
      jobId,
      error instanceof Error ? error.message : "Batch delete failed",
    );
    return errorResponse("Batch delete failed", corsHeaders, 500);
  }
}

/**
 * Batch backup instances to R2
 */
async function batchBackupInstances(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchBackupRequest>(request);
  if (!body?.instanceIds || body.instanceIds.length === 0) {
    return errorResponse("instanceIds array is required", corsHeaders, 400);
  }

  const results: BatchBackupResult[] = [];

  // Create job record
  const jobId = await createJob(env.METADATA, "batch_backup", userEmail);

  try {
    for (const instanceId of body.instanceIds) {
      try {
        // Get instance info
        const instance = await env.METADATA.prepare(
          "SELECT * FROM instances WHERE id = ?",
        )
          .bind(instanceId)
          .first<Instance>();

        if (!instance) {
          results.push({
            id: instanceId,
            name: "Unknown",
            success: false,
            error: "Instance not found",
          });
          continue;
        }

        // Get namespace info
        const namespace = await env.METADATA.prepare(
          "SELECT * FROM namespaces WHERE id = ?",
        )
          .bind(instance.namespace_id)
          .first<Namespace>();

        if (!namespace?.endpoint_url) {
          results.push({
            id: instanceId,
            name: instance.name ?? instance.object_id,
            success: false,
            error: "Namespace endpoint not configured",
          });
          continue;
        }

        if (isLocalDev) {
          // Mock backup for local dev
          results.push({
            id: instanceId,
            name: instance.name ?? instance.object_id,
            success: true,
            backupId: generateId(),
            size: Math.floor(Math.random() * 10000),
          });
          continue;
        }

        // Fetch storage data from DO
        const instanceName = instance.object_id;
        const baseUrl = namespace.endpoint_url.replace(/\/+$/, "");
        const storageResponse = await fetch(
          `${baseUrl}/admin/${encodeURIComponent(instanceName)}/export`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (!storageResponse.ok) {
          results.push({
            id: instanceId,
            name: instanceName,
            success: false,
            error: `Export failed: ${String(storageResponse.status)}`,
          });
          continue;
        }

        const storageData = await storageResponse.text();
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const r2Key = `backups/${instance.namespace_id}/${instanceId}/${timestamp}.json`;

        // Store in R2
        await env.BACKUP_BUCKET.put(r2Key, storageData, {
          customMetadata: {
            instanceId,
            namespaceId: instance.namespace_id,
            createdBy: userEmail ?? "unknown",
            storageBackend: namespace.storage_backend,
            batchJob: jobId ?? "",
          },
        });

        // Record backup in D1
        const backupId = generateId();
        await env.METADATA.prepare(
          `
          INSERT INTO backups (id, instance_id, namespace_id, r2_key, size_bytes, storage_type, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
          .bind(
            backupId,
            instanceId,
            instance.namespace_id,
            r2Key,
            storageData.length,
            namespace.storage_backend,
            userEmail,
            nowISO(),
          )
          .run();

        results.push({
          id: instanceId,
          name: instanceName,
          success: true,
          backupId,
          size: storageData.length,
        });
      } catch (err) {
        results.push({
          id: instanceId,
          name: instanceId,
          success: false,
          error: err instanceof Error ? err.message : "Backup failed",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await completeJob(env.METADATA, jobId, {
      total: body.instanceIds.length,
      success: successCount,
      failed: failureCount,
      instances: results.filter((r) => r.success).map((r) => r.name),
    });

    // Trigger webhook
    void triggerWebhooks(
      env,
      "batch_complete",
      createBatchCompleteWebhookData(
        "batch_backup",
        body.instanceIds.length,
        successCount,
        failureCount,
        userEmail,
      ),
      isLocalDev,
    );

    return jsonResponse(
      {
        results,
        summary: {
          total: body.instanceIds.length,
          success: successCount,
          failed: failureCount,
        },
      },
      corsHeaders,
    );
  } catch (error) {
    logWarning(
      `Backup error: ${error instanceof Error ? error.message : String(error)}`,
      {
        module: "batch",
        operation: "backup",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    );
    await failJob(
      env.METADATA,
      jobId,
      error instanceof Error ? error.message : "Batch backup failed",
    );
    return errorResponse("Batch backup failed", corsHeaders, 500);
  }
}

/**
 * Log batch export instances job (export happens client-side, this logs the job)
 */
async function batchExportInstances(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchExportInstancesRequest>(request);
  if (!body?.instanceIds || body.instanceIds.length === 0) {
    return errorResponse("instanceIds array is required", corsHeaders, 400);
  }

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_export_instances",
    userEmail,
    body.namespaceId,
  );

  await completeJob(env.METADATA, jobId, {
    total: body.instanceIds.length,
    namespace_name: body.namespaceName,
    instance_ids: body.instanceIds,
  });

  return jsonResponse({ success: true, jobId }, corsHeaders);
}

/**
 * Log batch export namespaces job (export happens client-side, this logs the job)
 */
async function batchExportNamespaces(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchExportNamespacesRequest>(request);
  if (!body?.namespaceIds || body.namespaceIds.length === 0) {
    return errorResponse("namespaceIds array is required", corsHeaders, 400);
  }

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_export_namespaces",
    userEmail,
  );

  await completeJob(env.METADATA, jobId, {
    total: body.namespaceIds.length,
    namespace_ids: body.namespaceIds,
  });

  return jsonResponse({ success: true, jobId }, corsHeaders);
}

/**
 * Log batch delete keys job (delete happens client-side, this logs the job)
 */
async function batchDeleteKeys(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchDeleteKeysRequest>(request);
  if (!body?.keys || body.keys.length === 0) {
    return errorResponse("keys array is required", corsHeaders, 400);
  }

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_delete_keys",
    userEmail,
    body.namespaceId,
    body.instanceId,
  );

  await completeJob(env.METADATA, jobId, {
    total: body.keys.length,
    success: body.successCount,
    failed: body.failedCount,
    instance_name: body.instanceName,
    namespace_name: body.namespaceName,
    keys: body.keys.slice(0, 20), // Limit to first 20 keys in result
  });

  return jsonResponse({ success: true, jobId }, corsHeaders);
}

/**
 * Log batch export keys job (export happens client-side, this logs the job)
 */
async function batchExportKeys(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  userEmail: string | null,
): Promise<Response> {
  const body = await parseJsonBody<BatchExportKeysRequest>(request);
  if (!body?.keys || body.keys.length === 0) {
    return errorResponse("keys array is required", corsHeaders, 400);
  }

  // Create job record
  const jobId = await createJob(
    env.METADATA,
    "batch_export_keys",
    userEmail,
    body.namespaceId,
    body.instanceId,
  );

  await completeJob(env.METADATA, jobId, {
    total: body.keys.length,
    exported: body.exportedCount,
    instance_name: body.instanceName,
    namespace_name: body.namespaceName,
    keys: body.keys.slice(0, 20), // Limit to first 20 keys in result
  });

  return jsonResponse({ success: true, jobId }, corsHeaders);
}
