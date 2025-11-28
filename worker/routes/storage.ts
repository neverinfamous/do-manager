import type { Env, CorsHeaders, Namespace, Instance } from '../types'
import { jsonResponse, errorResponse, parseJsonBody } from '../utils/helpers'

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
  _userEmail: string | null
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
    return setStorageValue(request, instanceId, decodeURIComponent(key), env, corsHeaders, isLocalDev)
  }

  // DELETE /api/instances/:id/storage/:key - Delete storage value
  if (method === 'DELETE' && getMatch) {
    const instanceId = getMatch[1]
    const key = getMatch[2]
    if (!instanceId || !key) {
      return errorResponse('Instance ID and key required', corsHeaders, 400)
    }
    return deleteStorageValue(instanceId, decodeURIComponent(key), env, corsHeaders, isLocalDev)
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

  // In production, this would call the DO's admin hook via the configured endpoint
  // For now, return a placeholder response
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

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Call the DO's admin hook
    const response = await fetch(`${namespace.endpoint_url}/admin/${instance.object_id}/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return errorResponse('Failed to fetch storage from DO', corsHeaders, response.status)
    }

    const data = await response.json()
    return jsonResponse(data, corsHeaders)
  } catch (error) {
    console.error('[Storage] List error:', error)
    return errorResponse('Failed to list storage', corsHeaders, 500)
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
  return errorResponse('Production storage access not yet implemented', corsHeaders, 501)
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
  isLocalDev: boolean
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
  return errorResponse('Production storage access not yet implemented', corsHeaders, 501)
}

/**
 * Delete a storage value
 */
async function deleteStorageValue(
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
    delete storage.keys[key]
    return jsonResponse({ success: true }, corsHeaders)
  }

  // Production: call admin hook
  return errorResponse('Production storage access not yet implemented', corsHeaders, 501)
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
  return errorResponse('Production SQL access not yet implemented', corsHeaders, 501)
}

