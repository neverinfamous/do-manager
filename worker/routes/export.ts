import type { Env, CorsHeaders, Instance, Namespace } from '../types'
import { jsonResponse, errorResponse, createJob, completeJob, failJob } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'
import { triggerWebhooks, createImportExportWebhookData } from '../utils/webhooks'

/**
 * Handle export routes
 */
export async function handleExportRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/instances/:id/export - Export instance storage
  const instanceExportMatch = /^\/api\/instances\/([^/]+)\/export$/.exec(path)
  if (method === 'GET' && instanceExportMatch) {
    const instanceId = instanceExportMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return exportInstance(instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // GET /api/namespaces/:id/export - Export namespace config
  const namespaceExportMatch = /^\/api\/namespaces\/([^/]+)\/export$/.exec(path)
  if (method === 'GET' && namespaceExportMatch) {
    const namespaceId = namespaceExportMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return exportNamespace(namespaceId, env, corsHeaders, isLocalDev, userEmail)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * Mock export data for local development
 */
const MOCK_EXPORT_DATA: Record<string, Record<string, unknown>> = {
  'inst-1': {
    'user:1': { name: 'Alice', role: 'admin', created: '2024-01-15' },
    'user:2': { name: 'Bob', role: 'member', created: '2024-02-20' },
    'settings': { theme: 'dark', notifications: true },
  },
  'inst-2': {
    'channel:general': { members: ['alice', 'bob'], created: '2024-01-01' },
    'message:1': { text: 'Hello world', author: 'alice', timestamp: '2024-03-01' },
  },
  'inst-3': {
    'counter': 42,
    'lastUpdate': '2024-03-03T09:15:00Z',
  },
}

/**
 * Export instance storage data
 */
async function exportInstance(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  // Create job record
  const jobId = await createJob(env.METADATA, 'export_instance', userEmail, null, instanceId)

  if (isLocalDev) {
    const mockData = MOCK_EXPORT_DATA[instanceId] ?? {}
    await completeJob(env.METADATA, jobId, { keyCount: Object.keys(mockData).length })
    return jsonResponse({
      data: mockData,
      exportedAt: new Date().toISOString(),
      keyCount: Object.keys(mockData).length,
    }, corsHeaders)
  }

  try {
    // Get instance info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      await failJob(env.METADATA, jobId, 'Instance not found')
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Update job with namespace info
    if (jobId) {
      await env.METADATA.prepare(
        'UPDATE jobs SET namespace_id = ? WHERE id = ?'
      ).bind(instance.namespace_id, jobId).run()
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      await failJob(env.METADATA, jobId, 'Namespace endpoint not configured')
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Fetch storage data from DO
    const instanceName = instance.object_id
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const exportResponse = await fetch(
      `${baseUrl}/admin/${encodeURIComponent(instanceName)}/export`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!exportResponse.ok) {
      const errorText = await exportResponse.text().catch(() => 'Unknown error')
      await failJob(env.METADATA, jobId, `Export failed: ${String(exportResponse.status)}`)
      return errorResponse(
        `Export failed: ${String(exportResponse.status)} - ${errorText.slice(0, 100)}`,
        corsHeaders,
        exportResponse.status
      )
    }

    interface ExportData {
      data: Record<string, unknown>
      exportedAt: string
      keyCount: number
    }
    const exportData: ExportData = await exportResponse.json()

    await completeJob(env.METADATA, jobId, {
      instance_name: instanceName,
      namespace_name: namespace.name,
      key_count: exportData.keyCount,
    })

    // Trigger export_complete webhook
    void triggerWebhooks(
      env,
      'export_complete',
      createImportExportWebhookData(
        instanceId,
        instanceName,
        instance.namespace_id,
        namespace.name,
        exportData.keyCount,
        userEmail
      ),
      isLocalDev
    )

    // Add instance metadata to export
    return jsonResponse({
      ...exportData,
      instanceId,
      instanceName,
      namespaceId: instance.namespace_id,
      namespaceName: namespace.name,
      storageBackend: namespace.storage_backend,
    }, corsHeaders)
  } catch (error) {
    logWarning(`Export error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'export',
      operation: 'export_instance',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Unknown error')
    return errorResponse(
      `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
      corsHeaders,
      500
    )
  }
}

/**
 * Export namespace configuration
 */
async function exportNamespace(
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  // Create job record
  const jobId = await createJob(env.METADATA, 'export_namespace', userEmail, namespaceId)

  if (isLocalDev) {
    // Return mock namespace config
    const mockConfig = {
      id: namespaceId,
      name: 'Mock Namespace',
      class_name: 'MockDO',
      script_name: 'mock-worker',
      storage_backend: 'sqlite',
      endpoint_url: 'https://mock-worker.example.workers.dev',
      admin_hook_enabled: true,
      exported_at: new Date().toISOString(),
    }
    await completeJob(env.METADATA, jobId, { namespace_name: mockConfig.name })
    return jsonResponse(mockConfig, corsHeaders)
  }

  try {
    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(namespaceId).first<Namespace>()

    if (!namespace) {
      await failJob(env.METADATA, jobId, 'Namespace not found')
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    const config = {
      id: namespace.id,
      name: namespace.name,
      class_name: namespace.class_name,
      script_name: namespace.script_name,
      storage_backend: namespace.storage_backend,
      endpoint_url: namespace.endpoint_url,
      admin_hook_enabled: namespace.admin_hook_enabled === 1,
      exported_at: new Date().toISOString(),
    }

    await completeJob(env.METADATA, jobId, { namespace_name: namespace.name })

    return jsonResponse(config, corsHeaders)
  } catch (error) {
    logWarning(`Namespace export error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'export',
      operation: 'export_namespace',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Unknown error')
    return errorResponse(
      `Failed to export namespace: ${error instanceof Error ? error.message : 'Unknown error'}`,
      corsHeaders,
      500
    )
  }
}
