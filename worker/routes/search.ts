import type { Env, CorsHeaders, Namespace, Instance } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'
import { logWarning, logError, createErrorContext } from '../utils/error-logger'

/**
 * Batch process items with concurrency limit
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param concurrency Maximum concurrent operations (default: 5)
 * @returns Array of results (successful results, errors logged internally)
 */
async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R | null>,
  concurrency = 5
): Promise<(R | null)[]> {
  const results: (R | null)[] = []

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }

  return results
}

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

interface TagSearchRequest {
  query: string
  namespaceIds?: string[]
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
  matchType: 'key' | 'value' | 'tag'
  valuePreview?: string
  tags?: string[]
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

const MOCK_INSTANCES: { id: string; namespaceId: string; namespaceName: string; name: string; tags: string[] }[] = [
  { id: 'inst-1', namespaceId: 'ns-1', namespaceName: 'ChatRooms', name: 'room-general', tags: ['production', 'priority:high'] },
  { id: 'inst-2', namespaceId: 'ns-1', namespaceName: 'ChatRooms', name: 'room-support', tags: ['staging', 'team:support'] },
  { id: 'inst-3', namespaceId: 'ns-2', namespaceName: 'Counters', name: 'counter-main', tags: [] },
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

  // POST /api/search/tags - Tag-based search (searches D1 metadata, no admin hooks required)
  if (method === 'POST' && path === '/api/search/tags') {
    return searchTags(request, env, corsHeaders, isLocalDev, userEmail)
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

    // Filter namespaces with endpoint URLs
    const validNamespaces = namespaces.filter(ns => ns.endpoint_url)
    const namespacesSearched = validNamespaces.length

    // Build namespace-to-instances index upfront (single batch query per namespace)
    const namespaceInstancesMap = new Map<string, Instance[]>()

    // Get all instances for valid namespaces in parallel batches
    await batchProcess(validNamespaces, async (namespace) => {
      const instancesResult = await env.METADATA.prepare(
        'SELECT * FROM instances WHERE namespace_id = ?'
      ).bind(namespace.id).all<Instance>()
      namespaceInstancesMap.set(namespace.id, instancesResult.results)
      return null
    }, 5)

    // Build flat list of all instances to search with their namespace info
    interface InstanceSearchItem {
      instance: Instance
      namespace: Namespace
    }

    const allInstances: InstanceSearchItem[] = []
    for (const namespace of validNamespaces) {
      const instances = namespaceInstancesMap.get(namespace.id) ?? []
      for (const instance of instances) {
        allInstances.push({ instance, namespace })
      }
    }

    const instancesSearched = allInstances.length

    // Batch process admin hook calls in parallel (max 5 concurrent)
    await batchProcess(allInstances, async ({ instance, namespace }) => {
      // Check if we've hit the limit
      if (results.length >= limit) return null

      const instanceName = instance.object_id
      const baseUrl = (namespace.endpoint_url ?? '').replace(/\/+$/, '')
      const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/list`

      try {
        const response = await fetch(adminUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          errors++
          return null
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

        return null
      } catch (err) {
        errors++
        logWarning(`Failed to fetch keys from instance`, {
          module: 'search',
          operation: 'key_search',
          namespaceId: namespace.id,
          instanceId: instance.id,
          metadata: { error: err instanceof Error ? err.message : String(err) }
        })
        return null
      }
    }, 5)

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
    const errorContext = createErrorContext('search', 'key_search', {
      ...(userEmail && { userId: userEmail }),
      metadata: { query }
    })
    await logError(env, error instanceof Error ? error : String(error), errorContext, isLocalDev, { triggerWebhook: true, ...(jobId && { jobId }) })
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

    // Filter namespaces with endpoint URLs
    const validNamespaces = namespaces.filter(ns => ns.endpoint_url)
    const namespacesSearched = validNamespaces.length

    // Determine which instances to search
    const instanceFilter: Set<string> | null = body.instanceIds && body.instanceIds.length > 0
      ? new Set(body.instanceIds)
      : null

    // Build namespace-to-instances index upfront (single batch query per namespace)
    const namespaceInstancesMap = new Map<string, Instance[]>()

    // Get all instances for valid namespaces in parallel batches
    await batchProcess(validNamespaces, async (namespace) => {
      const instancesResult = await env.METADATA.prepare(
        'SELECT * FROM instances WHERE namespace_id = ?'
      ).bind(namespace.id).all<Instance>()
      namespaceInstancesMap.set(namespace.id, instancesResult.results)
      return null
    }, 5)

    // Build flat list of all instances to search with their namespace info
    interface ValueSearchItem {
      instance: Instance
      namespace: Namespace
    }

    const allInstances: ValueSearchItem[] = []
    for (const namespace of validNamespaces) {
      const instances = namespaceInstancesMap.get(namespace.id) ?? []
      for (const instance of instances) {
        // Apply instance filter if present
        if (instanceFilter && !instanceFilter.has(instance.id)) continue
        allInstances.push({ instance, namespace })
      }
    }

    const instancesSearched = allInstances.length

    // Batch process admin hook calls in parallel (max 5 concurrent)
    await batchProcess(allInstances, async ({ instance, namespace }) => {
      // Check if we've hit the limit
      if (results.length >= limit) return null

      const instanceName = instance.object_id
      const baseUrl = (namespace.endpoint_url ?? '').replace(/\/+$/, '')
      const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/export`

      try {
        const response = await fetch(adminUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          errors++
          return null
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

        return null
      } catch (err) {
        errors++
        logWarning(`Failed to export values from instance`, {
          module: 'search',
          operation: 'value_search',
          namespaceId: namespace.id,
          instanceId: instance.id,
          metadata: { error: err instanceof Error ? err.message : String(err) }
        })
        return null
      }
    }, 5)

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
    const errorContext = createErrorContext('search', 'value_search', {
      ...(userEmail && { userId: userEmail }),
      metadata: { query }
    })
    await logError(env, error instanceof Error ? error : String(error), errorContext, isLocalDev, { triggerWebhook: true, ...(jobId && { jobId }) })
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

/**
 * Search for instances by tag (searches D1 metadata, no admin hooks required)
 */
async function searchTags(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<TagSearchRequest>(request)

  if (!body?.query || body.query.trim().length === 0) {
    return errorResponse('query is required', corsHeaders, 400)
  }

  const query = body.query.trim().toLowerCase()
  const limit = Math.min(body.limit ?? 100, 500)

  if (isLocalDev) {
    return mockTagSearch(query, limit, corsHeaders)
  }

  // Create job record
  const jobId = await createJob(env.METADATA, 'search_tags', userEmail)

  try {
    const results: SearchResult[] = []
    let namespacesSearched = 0

    // Build namespace filter if provided
    let namespaceFilter = ''
    const bindParams: (string | number)[] = [`%${query}%`, limit]
    if (body.namespaceIds && body.namespaceIds.length > 0) {
      const placeholders = body.namespaceIds.map(() => '?').join(',')
      namespaceFilter = `AND i.namespace_id IN (${placeholders})`
      bindParams.splice(1, 0, ...body.namespaceIds)
    }

    // Search instances by tag using D1 LIKE query
    // Tags are stored as JSON array, so we search for the tag string within it
    const searchQuery = `
      SELECT i.*, n.name as namespace_name
      FROM instances i
      JOIN namespaces n ON i.namespace_id = n.id
      WHERE i.tags LIKE ? ${namespaceFilter}
      LIMIT ?
    `

    const searchResult = await env.METADATA.prepare(searchQuery)
      .bind(...bindParams)
      .all<Instance & { namespace_name: string }>()

    // Count unique namespaces
    const namespaceIds = new Set<string>()

    for (const instance of searchResult.results) {
      namespaceIds.add(instance.namespace_id)

      // Parse tags and find matching ones
      let tags: string[] = []
      try {
        const parsed: unknown = JSON.parse((instance.tags as unknown as string) || '[]')
        tags = Array.isArray(parsed) ? parsed as string[] : []
      } catch {
        tags = []
      }

      const matchingTags = tags.filter(tag => tag.toLowerCase().includes(query))

      results.push({
        namespaceId: instance.namespace_id,
        namespaceName: instance.namespace_name,
        instanceId: instance.id,
        instanceName: instance.name ?? instance.object_id,
        key: '', // No key for tag search
        matchType: 'tag',
        tags: matchingTags,
      })
    }

    namespacesSearched = namespaceIds.size

    const summary: SearchSummary = {
      totalMatches: results.length,
      namespacesSearched,
      instancesSearched: results.length, // Each result is one instance
      errors: 0,
    }

    await completeJob(env.METADATA, jobId, {
      query,
      total_matches: results.length,
      namespaces_searched: namespacesSearched,
    })

    return jsonResponse({ results, summary }, corsHeaders)
  } catch (error) {
    logWarning(`Tag search error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'search',
      operation: 'tag_search',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Search failed')
    return errorResponse('Search failed', corsHeaders, 500)
  }
}

/**
 * Mock tag search for local development
 */
function mockTagSearch(
  query: string,
  limit: number,
  corsHeaders: CorsHeaders
): Response {
  const results: SearchResult[] = []

  for (const inst of MOCK_INSTANCES) {
    if (results.length >= limit) break

    const matchingTags = inst.tags.filter(tag => tag.toLowerCase().includes(query))
    if (matchingTags.length > 0) {
      results.push({
        namespaceId: inst.namespaceId,
        namespaceName: inst.namespaceName,
        instanceId: inst.id,
        instanceName: inst.name,
        key: '',
        matchType: 'tag',
        tags: matchingTags,
      })
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
