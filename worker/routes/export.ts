import type { Env, CorsHeaders, Instance, Namespace } from '../types'
import { jsonResponse, errorResponse } from '../utils/helpers'

/**
 * Handle export routes
 */
export async function handleExportRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/instances/:id/export - Export instance storage
  const exportMatch = path.match(/^\/api\/instances\/([^/]+)\/export$/)
  if (method === 'GET' && exportMatch) {
    const instanceId = exportMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return exportInstance(instanceId, env, corsHeaders, isLocalDev)
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
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const mockData = MOCK_EXPORT_DATA[instanceId] ?? {}
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
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Fetch storage data from DO
    const instanceName = instance.name ?? instance.object_id
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
    console.error('[Export] Error:', error)
    return errorResponse(
      `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
      corsHeaders,
      500
    )
  }
}

