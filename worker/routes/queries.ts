import type { Env, CorsHeaders, SavedQuery } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO, parseJsonBody } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'

/**
 * Mock saved queries for local development
 */
const MOCK_SAVED_QUERIES: SavedQuery[] = [
  {
    id: 'sq-1',
    namespace_id: 'ns-1',
    name: 'All Users',
    description: 'Fetch all users with their roles',
    query: 'SELECT * FROM users ORDER BY created_at DESC LIMIT 100',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'sq-2',
    namespace_id: 'ns-1',
    name: 'Active Sessions',
    description: 'Count active sessions by user',
    query: 'SELECT user_id, COUNT(*) as session_count FROM sessions WHERE active = 1 GROUP BY user_id',
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-02-20T14:30:00Z',
  },
]

/**
 * Handle saved queries routes
 */
export async function handleQueriesRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/namespaces/:nsId/queries - List saved queries for namespace
  const listMatch = /^\/api\/namespaces\/([^/]+)\/queries$/.exec(path)
  if (method === 'GET' && listMatch) {
    const namespaceId = listMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return listQueries(namespaceId, env, corsHeaders, isLocalDev)
  }

  // POST /api/namespaces/:nsId/queries - Create saved query
  if (method === 'POST' && listMatch) {
    const namespaceId = listMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return createQuery(request, namespaceId, env, corsHeaders, isLocalDev)
  }

  // PUT /api/queries/:id - Update saved query
  const singleMatch = /^\/api\/queries\/([^/]+)$/.exec(path)
  if (method === 'PUT' && singleMatch) {
    const queryId = singleMatch[1]
    if (!queryId) {
      return errorResponse('Query ID required', corsHeaders, 400)
    }
    return updateQuery(request, queryId, env, corsHeaders, isLocalDev)
  }

  // DELETE /api/queries/:id - Delete saved query
  if (method === 'DELETE' && singleMatch) {
    const queryId = singleMatch[1]
    if (!queryId) {
      return errorResponse('Query ID required', corsHeaders, 400)
    }
    return deleteQuery(queryId, env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List saved queries for a namespace
 */
async function listQueries(
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const filtered = MOCK_SAVED_QUERIES.filter((q) => q.namespace_id === namespaceId)
    return jsonResponse({ queries: filtered }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(`
      SELECT * FROM saved_queries 
      WHERE namespace_id = ? 
      ORDER BY name ASC
    `).bind(namespaceId).all<SavedQuery>()

    return jsonResponse({ queries: result.results }, corsHeaders)
  } catch (error) {
    logWarning(`List error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'queries',
      operation: 'list',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to list saved queries', corsHeaders, 500)
  }
}

/**
 * Create a new saved query
 */
async function createQuery(
  request: Request,
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  interface CreateQueryBody {
    name: string
    description?: string
    query: string
  }

  const body = await parseJsonBody<CreateQueryBody>(request)
  if (!body?.name?.trim()) {
    return errorResponse('name is required', corsHeaders, 400)
  }
  if (!body.query?.trim()) {
    return errorResponse('query is required', corsHeaders, 400)
  }

  const name = body.name.trim()
  const query = body.query.trim()
  const description = body.description?.trim() ?? null

  if (isLocalDev) {
    const newQuery: SavedQuery = {
      id: generateId(),
      namespace_id: namespaceId,
      name,
      description,
      query,
      created_at: nowISO(),
      updated_at: nowISO(),
    }
    MOCK_SAVED_QUERIES.push(newQuery)
    return jsonResponse({ query: newQuery }, corsHeaders, 201)
  }

  try {
    const id = generateId()
    const now = nowISO()

    await env.METADATA.prepare(`
      INSERT INTO saved_queries (id, namespace_id, name, description, query, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, namespaceId, name, description, query, now, now).run()

    const result = await env.METADATA.prepare(
      'SELECT * FROM saved_queries WHERE id = ?'
    ).bind(id).first<SavedQuery>()

    return jsonResponse({ query: result }, corsHeaders, 201)
  } catch (error) {
    logWarning(`Create error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'queries',
      operation: 'create',
      namespaceId,
      metadata: { name, error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to create saved query', corsHeaders, 500)
  }
}

/**
 * Update a saved query
 */
async function updateQuery(
  request: Request,
  queryId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  interface UpdateQueryBody {
    name?: string
    description?: string
    query?: string
  }

  const body = await parseJsonBody<UpdateQueryBody>(request)
  if (!body) {
    return errorResponse('Request body required', corsHeaders, 400)
  }

  const updates: { name?: string; description?: string | null; query?: string } = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description ? body.description.trim() : null
  if (body.query !== undefined) updates.query = body.query.trim()

  if (Object.keys(updates).length === 0) {
    return errorResponse('At least one field to update is required', corsHeaders, 400)
  }

  if (isLocalDev) {
    const index = MOCK_SAVED_QUERIES.findIndex((q) => q.id === queryId)
    const existing = MOCK_SAVED_QUERIES[index]
    if (index === -1 || !existing) {
      return errorResponse('Query not found', corsHeaders, 404)
    }
    const updated: SavedQuery = {
      ...existing,
      ...updates,
      updated_at: nowISO(),
    }
    MOCK_SAVED_QUERIES[index] = updated
    return jsonResponse({ query: updated }, corsHeaders)
  }

  try {
    // Build dynamic update query
    const setClauses: string[] = ['updated_at = ?']
    const values: (string | null)[] = [nowISO()]

    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?')
      values.push(updates.description)
    }
    if (updates.query !== undefined) {
      setClauses.push('query = ?')
      values.push(updates.query)
    }

    values.push(queryId)

    await env.METADATA.prepare(`
      UPDATE saved_queries SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run()

    const result = await env.METADATA.prepare(
      'SELECT * FROM saved_queries WHERE id = ?'
    ).bind(queryId).first<SavedQuery>()

    if (!result) {
      return errorResponse('Query not found', corsHeaders, 404)
    }

    return jsonResponse({ query: result }, corsHeaders)
  } catch (error) {
    logWarning(`Update error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'queries',
      operation: 'update',
      metadata: { queryId, error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to update saved query', corsHeaders, 500)
  }
}

/**
 * Delete a saved query
 */
async function deleteQuery(
  queryId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const index = MOCK_SAVED_QUERIES.findIndex((q) => q.id === queryId)
    if (index !== -1) {
      MOCK_SAVED_QUERIES.splice(index, 1)
    }
    return jsonResponse({ success: true }, corsHeaders)
  }

  try {
    await env.METADATA.prepare(
      'DELETE FROM saved_queries WHERE id = ?'
    ).bind(queryId).run()

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Delete error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'queries',
      operation: 'delete',
      metadata: { queryId, error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to delete saved query', corsHeaders, 500)
  }
}

