import type { Env, CorsHeaders, Namespace, Instance } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'

/**
 * Mock storage data for local development
 */
const MOCK_STORAGE: Record<string, { keys: Record<string, unknown>; tables: string[] }> = {
  'inst-1': {
    keys: {
      'user:1': { name: 'Alice', role: 'admin', created: '2024-01-15' },
      'user:2': { name: 'Bob', role: 'member', created: '2024-02-20' },
      'settings': { theme: 'dark', notifications: true },
    },
    tables: ['users', 'messages', 'settings'],
  },
  'inst-2': {
    keys: {
      'channel:general': { members: ['alice', 'bob'], created: '2024-01-01' },
      'message:1': { text: 'Hello world', author: 'alice', timestamp: '2024-03-01' },
    },
    tables: ['channels', 'messages'],
  },
  'inst-3': {
    keys: {
      'counter': 42,
      'lastUpdate': '2024-03-03T09:15:00Z',
    },
    tables: ['counters'],
  },
}

/**
 * Mock SQL query results
 */
const MOCK_SQL_RESULTS: Record<string, unknown[]> = {
  "SELECT * FROM users": [
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob', role: 'member' },
  ],
  "SELECT * FROM messages": [
    { id: 1, text: 'Hello', author: 'alice', created: '2024-03-01' },
    { id: 2, text: 'World', author: 'bob', created: '2024-03-02' },
  ],
}

/**
 * Handle storage routes
 */
export async function handleStorageRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/instances/:id/storage - List storage contents
  const listMatch = path.match(/^\/api\/instances\/([^/]+)\/storage$/)
  if (method === 'GET' && listMatch) {
    const instanceId = listMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return listStorage(instanceId, env, corsHeaders, isLocalDev)
  }

  // GET /api/instances/:id/storage/:key - Get storage value
  const getMatch = path.match(/^\/api\/instances\/([^/]+)\/storage\/(.+)$/)
  if (method === 'GET' && getMatch) {
    const instanceId = getMatch[1]
    const key = getMatch[2]
    if (!instanceId || !key) {
      return errorResponse('Instance ID and key required', corsHeaders, 400)
    }
    return getStorageValue(instanceId, decodeURIComponent(key), env, corsHeaders, isLocalDev)
  }

  // PUT /api/instances/:id/storage/:key - Set storage value
  if (method === 'PUT' && getMatch) {
    const instanceId = getMatch[1]
    const key = getMatch[2]
    if (!instanceId || !key) {
      return errorResponse('Instance ID and key required', corsHeaders, 400)
    }
    return setStorageValue(request, instanceId, decodeURIComponent(key), env, corsHeaders, isLocalDev, userEmail)
  }

  // DELETE /api/instances/:id/storage/:key - Delete storage value
  if (method === 'DELETE' && getMatch) {
    const instanceId = getMatch[1]
    const key = getMatch[2]
    if (!instanceId || !key) {
      return errorResponse('Instance ID and key required', corsHeaders, 400)
    }
    return deleteStorageValue(instanceId, decodeURIComponent(key), env, corsHeaders, isLocalDev, userEmail)
  }

  // POST /api/instances/:id/sql - Execute SQL query
  const sqlMatch = path.match(/^\/api\/instances\/([^/]+)\/sql$/)
  if (method === 'POST' && sqlMatch) {
    const instanceId = sqlMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return executeSql(request, instanceId, env, corsHeaders, isLocalDev)
  }

  // POST /api/instances/:id/import - Import storage keys from JSON
  const importMatch = path.match(/^\/api\/instances\/([^/]+)\/import$/)
  if (method === 'POST' && importMatch) {
    const instanceId = importMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return importStorage(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List storage contents (keys/tables)
 */
async function listStorage(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return jsonResponse({
        keys: [],
        tables: [],
        error: 'No mock data for this instance',
      }, corsHeaders)
    }
    return jsonResponse({
      keys: Object.keys(storage.keys),
      tables: storage.tables,
    }, corsHeaders)
  }

  // In production, call the DO's admin hook via the configured endpoint
  try {
    // Get instance and namespace info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    if (!namespace.endpoint_url) {
      return jsonResponse({
        keys: [],
        tables: [],
        warning: 'Admin hook endpoint not configured. Go to namespace settings to configure the endpoint URL pointing to your Worker with admin hooks enabled.',
        admin_hook_required: true,
      }, corsHeaders)
    }

    // Check if admin hook is enabled
    if (namespace.admin_hook_enabled !== 1) {
      return jsonResponse({
        keys: [],
        tables: [],
        warning: 'Admin hook is not enabled for this namespace. Enable it in namespace settings after adding admin hook methods to your DO class.',
        admin_hook_required: true,
      }, corsHeaders)
    }

    // Normalize endpoint URL (remove trailing slash)
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    // Use the instance name or object_id to route to the correct DO
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/list`

    console.log('[Storage] Calling admin hook:', adminUrl)

    // Call the DO's admin hook
    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[Storage] Admin hook error:', response.status, errorText)
      return jsonResponse({
        keys: [],
        tables: [],
        error: `Admin hook returned ${String(response.status)}. Ensure your DO class has admin hook methods and the endpoint URL is correct.`,
        details: errorText.slice(0, 200),
      }, corsHeaders)
    }

    const data = await response.json()
    return jsonResponse(data, corsHeaders)
  } catch (error) {
    console.error('[Storage] List error:', error)
    return jsonResponse({
      keys: [],
      tables: [],
      error: `Failed to connect to admin hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, corsHeaders)
  }
}

/**
 * Get a storage value
 */
async function getStorageValue(
  instanceId: string,
  key: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    const value = storage.keys[key]
    if (value === undefined) {
      return errorResponse('Key not found', corsHeaders, 404)
    }
    return jsonResponse({ key, value }, corsHeaders)
  }

  // Production: call admin hook
  try {
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse('Admin hook not configured or enabled', corsHeaders, 400)
    }

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/get?key=${encodeURIComponent(key)}`

    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const data = await response.json() as { value?: unknown }
    const resultValue: unknown = data.value ?? data
    return jsonResponse({ key, value: resultValue }, corsHeaders)
  } catch (error) {
    console.error('[Storage] Get error:', error)
    return errorResponse(`Failed to get value: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Set a storage value
 */
async function setStorageValue(
  request: Request,
  instanceId: string,
  key: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<{ value: unknown }>(request)
  if (!body || body.value === undefined) {
    return errorResponse('value is required', corsHeaders, 400)
  }

  if (isLocalDev) {
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    storage.keys[key] = body.value
    return jsonResponse({ success: true, key, value: body.value }, corsHeaders)
  }

  // Production: call admin hook
  try {
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse('Admin hook not configured or enabled', corsHeaders, 400)
    }

    const jobId = await createJob(env.METADATA, 'create_key', userEmail, instance.namespace_id, instanceId)

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/put`

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: body.value }),
    })

    if (!response.ok) {
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    await completeJob(env.METADATA, jobId, { key })
    return jsonResponse({ success: true, key, value: body.value }, corsHeaders)
  } catch (error) {
    console.error('[Storage] Set error:', error)
    return errorResponse(`Failed to set value: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Delete a storage value
 */
async function deleteStorageValue(
  instanceId: string,
  key: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    // Create a new object without the deleted key
    const newKeys: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(storage.keys)) {
      if (k !== key) {
        newKeys[k] = v
      }
    }
    storage.keys = newKeys
    return jsonResponse({ success: true }, corsHeaders)
  }

  // Production: call admin hook
  try {
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse('Admin hook not configured or enabled', corsHeaders, 400)
    }

    const jobId = await createJob(env.METADATA, 'delete_key', userEmail, instance.namespace_id, instanceId)

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/delete`

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    if (!response.ok) {
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    await completeJob(env.METADATA, jobId, { key })
    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    console.error('[Storage] Delete error:', error)
    return errorResponse(`Failed to delete value: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Execute SQL query
 */
async function executeSql(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const body = await parseJsonBody<{ query: string }>(request)
  if (!body?.query) {
    return errorResponse('query is required', corsHeaders, 400)
  }

  if (isLocalDev) {
    // Check for mock results
    const normalizedQuery = body.query.trim()
    const mockResult = MOCK_SQL_RESULTS[normalizedQuery]
    
    if (mockResult) {
      return jsonResponse({
        results: mockResult,
        rowCount: mockResult.length,
      }, corsHeaders)
    }

    // Return empty result for unknown queries
    return jsonResponse({
      results: [],
      rowCount: 0,
      message: 'Query executed (mock mode)',
    }, corsHeaders)
  }

  // Production: call admin hook
  try {
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse('Admin hook not configured or enabled', corsHeaders, 400)
    }

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/sql`

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: body.query }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return errorResponse(`SQL execution failed: ${errorText}`, corsHeaders, response.status)
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const data = await response.json() as { result?: unknown[] }
    const results: unknown[] = data.result ?? []
    return jsonResponse({
      results,
      rowCount: results.length,
    }, corsHeaders)
  } catch (error) {
    console.error('[Storage] SQL error:', error)
    return errorResponse(`Failed to execute SQL: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Import request body type
 */
interface ImportStorageRequest {
  data: Record<string, unknown>
  mergeMode?: 'merge' | 'replace'
}

/**
 * Import storage keys from JSON
 */
async function importStorage(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<ImportStorageRequest>(request)
  
  // Validate request body
  if (!body?.data) {
    return errorResponse('data object is required', corsHeaders, 400)
  }

  const keyCount = Object.keys(body.data).length
  if (keyCount === 0) {
    return errorResponse('data object must contain at least one key', corsHeaders, 400)
  }

  if (isLocalDev) {
    // Mock import for local development
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Handle merge mode
    if (body.mergeMode === 'replace') {
      storage.keys = { ...body.data }
    } else {
      // Default is merge
      storage.keys = { ...storage.keys, ...body.data }
    }

    return jsonResponse({
      success: true,
      imported: keyCount,
      mergeMode: body.mergeMode ?? 'merge',
    }, corsHeaders)
  }

  // Production: call admin hook
  try {
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse('Admin hook not configured or enabled', corsHeaders, 400)
    }

    const jobId = await createJob(env.METADATA, 'import_keys', userEmail, instance.namespace_id, instanceId)

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/import`

    console.log('[Storage] Calling admin hook import:', adminUrl, 'keys:', keyCount)

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body.data }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[Storage] Import admin hook error:', response.status, errorText)
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)} - ${errorText.slice(0, 100)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const result = await response.json() as { success?: boolean; imported?: number }
    
    await completeJob(env.METADATA, jobId, {
      key_count: keyCount,
      instance_name: instanceName,
      namespace_name: namespace.name,
      merge_mode: body.mergeMode ?? 'merge',
    })

    return jsonResponse({
      success: true,
      imported: result.imported ?? keyCount,
      mergeMode: body.mergeMode ?? 'merge',
    }, corsHeaders)
  } catch (error) {
    console.error('[Storage] Import error:', error)
    return errorResponse(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

