import type { Env, CorsHeaders, Namespace, Instance } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'

/**
 * Search request types
 */
interface KeySearchRequest {
  query: string
  namespaceIds?: string[]
  limit?: number
}

interface ValueSearchRequest {
  query: string
  namespaceIds?: string[]
  instanceIds?: string[]
  limit?: number
}

/**
 * Search result item
 */
interface SearchResult {
  namespaceId: string
  namespaceName: string
  instanceId: string
  instanceName: string
  key: string
  matchType: 'key' | 'value'
  valuePreview?: string
}

/**
 * Search summary
 */
interface SearchSummary {
  totalMatches: number
  namespacesSearched: number
  instancesSearched: number
  errors: number
}

/**
 * Mock data for local development
 */
const MOCK_SEARCH_DATA: Record<string, Record<string, unknown>> = {
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

const MOCK_INSTANCES: { id: string; namespaceId: string; namespaceName: string; name: string }[] = [
  { id: 'inst-1', namespaceId: 'ns-1', namespaceName: 'ChatRooms', name: 'room-general' },
  { id: 'inst-2', namespaceId: 'ns-1', namespaceName: 'ChatRooms', name: 'room-support' },
  { id: 'inst-3', namespaceId: 'ns-2', namespaceName: 'Counters', name: 'counter-main' },
]

/**
 * Handle search routes
 */
export async function handleSearchRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // POST /api/search/keys - Cross-namespace key search
  if (method === 'POST' && path === '/api/search/keys') {
    return searchKeys(request, env, corsHeaders, isLocalDev, userEmail)
  }

  // POST /api/search/values - Value content search
  if (method === 'POST' && path === '/api/search/values') {
    return searchValues(request, env, corsHeaders, isLocalDev, userEmail)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * Search for keys across namespaces
 */
async function searchKeys(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<KeySearchRequest>(request)
  
  if (!body?.query || body.query.trim().length === 0) {
    return errorResponse('query is required', corsHeaders, 400)
  }

  const query = body.query.trim().toLowerCase()
  const limit = Math.min(body.limit ?? 100, 500)

  if (isLocalDev) {
    return mockKeySearch(query, limit, corsHeaders)
  }

  // Create job record
  const jobId = await createJob(env.METADATA, 'search_keys', userEmail)

  try {
    const results: SearchResult[] = []
    let namespacesSearched = 0
    let instancesSearched = 0
    let errors = 0

    // Get namespaces with admin hooks enabled
    let namespaces: Namespace[]
    if (body.namespaceIds && body.namespaceIds.length > 0) {
      const placeholders = body.namespaceIds.map(() => '?').join(',')
      const result = await env.METADATA.prepare(
        `SELECT * FROM namespaces WHERE id IN (${placeholders}) AND admin_hook_enabled = 1`
      ).bind(...body.namespaceIds).all<Namespace>()
      namespaces = result.results
    } else {
      const result = await env.METADATA.prepare(
        'SELECT * FROM namespaces WHERE admin_hook_enabled = 1'
      ).all<Namespace>()
      namespaces = result.results
    }

    // Search each namespace
    for (const namespace of namespaces) {
      if (!namespace.endpoint_url) continue
      namespacesSearched++

      // Get instances for this namespace
      const instancesResult = await env.METADATA.prepare(
        'SELECT * FROM instances WHERE namespace_id = ?'
      ).bind(namespace.id).all<Instance>()

      // Search each instance
      for (const instance of instancesResult.results) {
        if (results.length >= limit) break

        instancesSearched++
        const instanceName = instance.name ?? instance.object_id

        try {
          const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
          const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/list`

          const response = await fetch(adminUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            errors++
            continue
          }

          const data = await response.json() as { keys?: string[] }
          const keys = data.keys ?? []

          // Filter keys matching query
          for (const key of keys) {
            if (results.length >= limit) break
            if (key.toLowerCase().includes(query)) {
              results.push({
                namespaceId: namespace.id,
                namespaceName: namespace.name,
                instanceId: instance.id,
                instanceName,
                key,
                matchType: 'key',
              })
            }
          }
        } catch {
          errors++
        }
      }

      if (results.length >= limit) break
    }

    const summary: SearchSummary = {
      totalMatches: results.length,
      namespacesSearched,
      instancesSearched,
      errors,
    }

    await completeJob(env.METADATA, jobId, {
      query,
      total_matches: results.length,
      namespaces_searched: namespacesSearched,
      instances_searched: instancesSearched,
    })

    return jsonResponse({ results, summary }, corsHeaders)
  } catch (error) {
    logWarning(`Key search error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'search',
      operation: 'key_search',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Search failed')
    return errorResponse('Search failed', corsHeaders, 500)
  }
}

/**
 * Search within storage values
 */
async function searchValues(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<ValueSearchRequest>(request)
  
  if (!body?.query || body.query.trim().length === 0) {
    return errorResponse('query is required', corsHeaders, 400)
  }

  const query = body.query.trim().toLowerCase()
  const limit = Math.min(body.limit ?? 100, 500)

  if (isLocalDev) {
    return mockValueSearch(query, limit, corsHeaders)
  }

  // Create job record
  const jobId = await createJob(env.METADATA, 'search_values', userEmail)

  try {
    const results: SearchResult[] = []
    let namespacesSearched = 0
    let instancesSearched = 0
    let errors = 0

    // Get namespaces with admin hooks enabled
    let namespaces: Namespace[]
    if (body.namespaceIds && body.namespaceIds.length > 0) {
      const placeholders = body.namespaceIds.map(() => '?').join(',')
      const result = await env.METADATA.prepare(
        `SELECT * FROM namespaces WHERE id IN (${placeholders}) AND admin_hook_enabled = 1`
      ).bind(...body.namespaceIds).all<Namespace>()
      namespaces = result.results
    } else {
      const result = await env.METADATA.prepare(
        'SELECT * FROM namespaces WHERE admin_hook_enabled = 1'
      ).all<Namespace>()
      namespaces = result.results
    }

    // Determine which instances to search
    let instanceFilter: Set<string> | null = null
    if (body.instanceIds && body.instanceIds.length > 0) {
      instanceFilter = new Set(body.instanceIds)
    }

    // Search each namespace
    for (const namespace of namespaces) {
      if (!namespace.endpoint_url) continue
      namespacesSearched++

      // Get instances for this namespace
      const instancesResult = await env.METADATA.prepare(
        'SELECT * FROM instances WHERE namespace_id = ?'
      ).bind(namespace.id).all<Instance>()

      // Search each instance
      for (const instance of instancesResult.results) {
        if (results.length >= limit) break
        if (instanceFilter && !instanceFilter.has(instance.id)) continue

        instancesSearched++
        const instanceName = instance.name ?? instance.object_id

        try {
          const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
          const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/export`

          const response = await fetch(adminUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            errors++
            continue
          }

          const exportData = await response.json() as { data?: Record<string, unknown> }
          const data = exportData.data ?? {}

          // Search through values
          for (const [key, value] of Object.entries(data)) {
            if (results.length >= limit) break
            
            const valueString = JSON.stringify(value).toLowerCase()
            if (valueString.includes(query)) {
              // Generate a preview of the matching value
              const preview = generateValuePreview(value, query)
              results.push({
                namespaceId: namespace.id,
                namespaceName: namespace.name,
                instanceId: instance.id,
                instanceName,
                key,
                matchType: 'value',
                valuePreview: preview,
              })
            }
          }
        } catch {
          errors++
        }
      }

      if (results.length >= limit) break
    }

    const summary: SearchSummary = {
      totalMatches: results.length,
      namespacesSearched,
      instancesSearched,
      errors,
    }

    await completeJob(env.METADATA, jobId, {
      query,
      total_matches: results.length,
      namespaces_searched: namespacesSearched,
      instances_searched: instancesSearched,
    })

    return jsonResponse({ results, summary }, corsHeaders)
  } catch (error) {
    logWarning(`Value search error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'search',
      operation: 'value_search',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Search failed')
    return errorResponse('Search failed', corsHeaders, 500)
  }
}

/**
 * Generate a preview of the value with context around the match
 */
function generateValuePreview(value: unknown, query: string): string {
  const str = JSON.stringify(value)
  const lowerStr = str.toLowerCase()
  const index = lowerStr.indexOf(query)
  
  if (index === -1) return str.slice(0, 100)
  
  const contextLength = 40
  const start = Math.max(0, index - contextLength)
  const end = Math.min(str.length, index + query.length + contextLength)
  
  let preview = str.slice(start, end)
  if (start > 0) preview = '...' + preview
  if (end < str.length) preview = preview + '...'
  
  return preview
}

/**
 * Mock key search for local development
 */
function mockKeySearch(
  query: string,
  limit: number,
  corsHeaders: CorsHeaders
): Response {
  const results: SearchResult[] = []

  for (const inst of MOCK_INSTANCES) {
    const data = MOCK_SEARCH_DATA[inst.id]
    if (!data) continue

    for (const key of Object.keys(data)) {
      if (results.length >= limit) break
      if (key.toLowerCase().includes(query)) {
        results.push({
          namespaceId: inst.namespaceId,
          namespaceName: inst.namespaceName,
          instanceId: inst.id,
          instanceName: inst.name,
          key,
          matchType: 'key',
        })
      }
    }
  }

  const summary: SearchSummary = {
    totalMatches: results.length,
    namespacesSearched: 2,
    instancesSearched: MOCK_INSTANCES.length,
    errors: 0,
  }

  return jsonResponse({ results, summary }, corsHeaders)
}

/**
 * Mock value search for local development
 */
function mockValueSearch(
  query: string,
  limit: number,
  corsHeaders: CorsHeaders
): Response {
  const results: SearchResult[] = []

  for (const inst of MOCK_INSTANCES) {
    const data = MOCK_SEARCH_DATA[inst.id]
    if (!data) continue

    for (const [key, value] of Object.entries(data)) {
      if (results.length >= limit) break
      const valueString = JSON.stringify(value).toLowerCase()
      if (valueString.includes(query)) {
        results.push({
          namespaceId: inst.namespaceId,
          namespaceName: inst.namespaceName,
          instanceId: inst.id,
          instanceName: inst.name,
          key,
          matchType: 'value',
          valuePreview: generateValuePreview(value, query),
        })
      }
    }
  }

  const summary: SearchSummary = {
    totalMatches: results.length,
    namespacesSearched: 2,
    instancesSearched: MOCK_INSTANCES.length,
    errors: 0,
  }

  return jsonResponse({ results, summary }, corsHeaders)
}

