import type { Env, CorsHeaders, Namespace, Instance } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'
import { logInfo, logWarning } from '../utils/error-logger'
import { triggerWebhooks, createStorageWebhookData, createImportExportWebhookData } from '../utils/webhooks'

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
  const listMatch = /^\/api\/instances\/([^/]+)\/storage$/.exec(path)
  if (method === 'GET' && listMatch) {
    const instanceId = listMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return listStorage(instanceId, env, corsHeaders, isLocalDev)
  }

  // GET /api/instances/:id/storage/:key - Get storage value
  const getMatch = /^\/api\/instances\/([^/]+)\/storage\/(.+)$/.exec(path)
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
  const sqlMatch = /^\/api\/instances\/([^/]+)\/sql$/.exec(path)
  if (method === 'POST' && sqlMatch) {
    const instanceId = sqlMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return executeSql(request, instanceId, env, corsHeaders, isLocalDev)
  }

  // POST /api/instances/:id/import - Import storage keys from JSON
  const importMatch = /^\/api\/instances\/([^/]+)\/import$/.exec(path)
  if (method === 'POST' && importMatch) {
    const instanceId = importMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return importStorage(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // POST /api/instances/:id/storage/rename - Rename a storage key
  const renameMatch = /^\/api\/instances\/([^/]+)\/storage\/rename$/.exec(path)
  if (method === 'POST' && renameMatch) {
    const instanceId = renameMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return renameStorageKey(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // GET /api/instances/:id/freeze - Get freeze status
  const freezeMatch = /^\/api\/instances\/([^/]+)\/freeze$/.exec(path)
  if (method === 'GET' && freezeMatch) {
    const instanceId = freezeMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return getFreezeStatus(instanceId, env, corsHeaders, isLocalDev)
  }

  // DELETE /api/instances/:id/freeze - Unfreeze instance
  if (method === 'DELETE' && freezeMatch) {
    const instanceId = freezeMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return unfreezeInstance(instanceId, env, corsHeaders, isLocalDev, userEmail)
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
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/list`

    logInfo(`Calling admin hook: ${adminUrl}`, {
      module: 'storage',
      operation: 'list',
      instanceId,
      namespaceId: namespace.id,
      metadata: { adminUrl }
    })

    // Call the DO's admin hook
    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logWarning(`Admin hook error: ${String(response.status)} ${errorText}`, {
        module: 'storage',
        operation: 'list',
        instanceId,
        namespaceId: namespace.id,
        metadata: { status: response.status, errorText: errorText.slice(0, 200) }
      })
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
    logWarning(`List error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'list',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/get?key=${encodeURIComponent(key)}`

    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    const data = await response.json() as { value?: unknown }
    const resultValue: unknown = data.value ?? data
    return jsonResponse({ key, value: resultValue }, corsHeaders)
  } catch (error) {
    logWarning(`Get error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'get',
      instanceId,
      metadata: { key, error: error instanceof Error ? error.message : String(error) }
    })
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
  if (body?.value === undefined) {
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
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/put`

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: body.value }),
    })

    if (!response.ok) {
      if (response.status === 423) {
        await failJob(env.METADATA, jobId, 'Instance is frozen')
        return errorResponse('Instance is frozen. Unfreeze before making changes.', corsHeaders, 423)
      }
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    await completeJob(env.METADATA, jobId, { key })

    // Trigger storage_update webhook
    void triggerWebhooks(
      env,
      'storage_update',
      createStorageWebhookData(
        instanceId,
        instance.name ?? instance.object_id,
        instance.namespace_id,
        namespace.name,
        key,
        userEmail
      ),
      isLocalDev
    )

    return jsonResponse({ success: true, key, value: body.value }, corsHeaders)
  } catch (error) {
    logWarning(`Set error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'set',
      instanceId,
      metadata: { key, error: error instanceof Error ? error.message : String(error) }
    })
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
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/delete`

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    if (!response.ok) {
      if (response.status === 423) {
        await failJob(env.METADATA, jobId, 'Instance is frozen')
        return errorResponse('Instance is frozen. Unfreeze before making changes.', corsHeaders, 423)
      }
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    await completeJob(env.METADATA, jobId, { key })

    // Trigger storage_delete webhook
    void triggerWebhooks(
      env,
      'storage_delete',
      createStorageWebhookData(
        instanceId,
        instance.name ?? instance.object_id,
        instance.namespace_id,
        namespace.name,
        key,
        userEmail
      ),
      isLocalDev
    )

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Delete error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'delete',
      instanceId,
      metadata: { key, error: error instanceof Error ? error.message : String(error) }
    })
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
    const instanceName = instance.object_id
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

    const data = await response.json() as { result?: unknown[] }
    const results: unknown[] = data.result ?? []
    return jsonResponse({
      results,
      rowCount: results.length,
    }, corsHeaders)
  } catch (error) {
    logWarning(`SQL error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'sql',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/import`

    logInfo(`Calling admin hook import: ${adminUrl} keys: ${String(keyCount)}`, {
      module: 'storage',
      operation: 'import',
      instanceId,
      namespaceId: namespace.id,
      metadata: { adminUrl, keyCount }
    })

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: body.data }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logWarning(`Import admin hook error: ${String(response.status)} ${errorText}`, {
        module: 'storage',
        operation: 'import',
        instanceId,
        namespaceId: namespace.id,
        metadata: { status: response.status, errorText: errorText.slice(0, 100) }
      })
      await failJob(env.METADATA, jobId, `Admin hook error: ${String(response.status)} - ${errorText.slice(0, 100)}`)
      return errorResponse(`Admin hook error: ${String(response.status)}`, corsHeaders, response.status)
    }

    const result = await response.json() as { success?: boolean; imported?: number }

    await completeJob(env.METADATA, jobId, {
      key_count: keyCount,
      instance_name: instanceName,
      namespace_name: namespace.name,
      merge_mode: body.mergeMode ?? 'merge',
    })

    // Trigger import_complete webhook
    void triggerWebhooks(
      env,
      'import_complete',
      createImportExportWebhookData(
        instanceId,
        instanceName,
        instance.namespace_id,
        namespace.name,
        result.imported ?? keyCount,
        userEmail
      ),
      isLocalDev
    )

    return jsonResponse({
      success: true,
      imported: result.imported ?? keyCount,
      mergeMode: body.mergeMode ?? 'merge',
    }, corsHeaders)
  } catch (error) {
    logWarning(`Import error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'import',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Rename a storage key (non-atomic: GET → PUT → DELETE)
 */
async function renameStorageKey(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface RenameKeyBody {
    oldKey: string
    newKey: string
  }

  const body = await parseJsonBody<RenameKeyBody>(request)
  if (!body?.oldKey?.trim() || !body?.newKey?.trim()) {
    return errorResponse('oldKey and newKey are required', corsHeaders, 400)
  }

  const oldKey = body.oldKey.trim()
  const newKey = body.newKey.trim()

  if (oldKey === newKey) {
    return errorResponse('newKey must be different from oldKey', corsHeaders, 400)
  }

  if (isLocalDev) {
    // Mock rename for local development
    const storage = MOCK_STORAGE[instanceId]
    if (!storage) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const value = storage.keys[oldKey]
    if (value === undefined) {
      return errorResponse('Old key not found', corsHeaders, 404)
    }

    // Check if new key already exists
    if (storage.keys[newKey] !== undefined) {
      return errorResponse('New key already exists', corsHeaders, 409)
    }

    // Perform rename: add new key and remove old key using object filtering
    storage.keys[newKey] = value
    const newKeys: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(storage.keys)) {
      if (k !== oldKey) {
        newKeys[k] = v
      }
    }
    storage.keys = newKeys

    return jsonResponse({ success: true, oldKey, newKey }, corsHeaders)
  }

  // Production: call admin hook (GET → PUT → DELETE)
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

    const jobId = await createJob(env.METADATA, 'rename_key', userEmail, instance.namespace_id, instanceId)

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.object_id

    // Step 1: GET the old key value
    const getUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/get?key=${encodeURIComponent(oldKey)}`
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!getResponse.ok) {
      await failJob(env.METADATA, jobId, `Failed to get old key: ${String(getResponse.status)}`)
      return errorResponse(`Failed to get old key: ${String(getResponse.status)}`, corsHeaders, getResponse.status)
    }

    const getData = await getResponse.json() as { value?: unknown }
    const value: unknown = getData.value ?? getData

    // Step 2: PUT the value under the new key
    const putUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/put`
    const putResponse = await fetch(putUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey, value }),
    })

    if (!putResponse.ok) {
      await failJob(env.METADATA, jobId, `Failed to create new key: ${String(putResponse.status)}`)
      return errorResponse(`Failed to create new key: ${String(putResponse.status)}`, corsHeaders, putResponse.status)
    }

    // Step 3: DELETE the old key
    const deleteUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/delete`
    const deleteResponse = await fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: oldKey }),
    })

    if (!deleteResponse.ok) {
      // Log warning but don't fail - new key was created successfully
      logWarning(`Failed to delete old key during rename: ${String(deleteResponse.status)}`, {
        module: 'storage',
        operation: 'rename_key',
        instanceId,
        metadata: { oldKey, newKey, deleteStatus: deleteResponse.status }
      })
    }

    await completeJob(env.METADATA, jobId, { oldKey, newKey })
    return jsonResponse({ success: true, oldKey, newKey }, corsHeaders)
  } catch (error) {
    logWarning(`Rename key error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'rename_key',
      instanceId,
      metadata: { oldKey, newKey, error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse(`Failed to rename key: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}

/**
 * Get freeze status of an instance
 */
async function getFreezeStatus(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ frozen: false }, corsHeaders)
  }

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
      return jsonResponse({ frozen: false, warning: 'Admin hook not configured' }, corsHeaders)
    }

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/freeze`

    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return jsonResponse({ frozen: false }, corsHeaders)
    }

    const data = await response.json() as { frozen?: boolean; frozenAt?: string }
    return jsonResponse(data, corsHeaders)
  } catch (error) {
    logWarning(`Get freeze status error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'freeze_status',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return jsonResponse({ frozen: false }, corsHeaders)
  }
}

/**
 * Unfreeze an instance
 */
async function unfreezeInstance(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ success: true, frozen: false }, corsHeaders)
  }

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

    const jobId = await createJob(env.METADATA, 'unfreeze_instance', userEmail, instance.namespace_id, instanceId)

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/freeze`

    logInfo(`Unfreezing instance: ${adminUrl}`, {
      module: 'storage',
      operation: 'unfreeze',
      instanceId,
      ...(userEmail ? { userId: userEmail } : {}),
    })

    const response = await fetch(adminUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      await failJob(env.METADATA, jobId, `Unfreeze failed: ${response.status}`)
      return errorResponse(`Failed to unfreeze: ${errorText.slice(0, 100)}`, corsHeaders, response.status)
    }

    await completeJob(env.METADATA, jobId, { instanceName })
    return jsonResponse({ success: true, frozen: false }, corsHeaders)
  } catch (error) {
    logWarning(`Unfreeze error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'storage',
      operation: 'unfreeze',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse(`Failed to unfreeze: ${error instanceof Error ? error.message : 'Unknown error'}`, corsHeaders, 500)
  }
}
