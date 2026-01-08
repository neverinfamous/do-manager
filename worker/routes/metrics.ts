/**
 * DO Metrics Route Handler
 *
 * Provides access to Cloudflare Durable Objects analytics via the GraphQL Analytics API.
 * Queries all 4 DO datasets for comprehensive metrics:
 * - durableObjectsInvocationsAdaptiveGroups (requests, errors, latency)
 * - durableObjectsPeriodicGroups (CPU time, active time)
 * - durableObjectsStorageGroups (storage bytes/keys)
 * - durableObjectsSubrequestsAdaptiveGroups (external subrequests)
 */

import type {
  Env,
  CorsHeaders,
  DOMetricsTimeRange,
  DOMetricsResponse,
  DOInvocationDataPoint,
  DOStorageDataPoint,
  DOSubrequestDataPoint,
  DONamespaceMetrics,
  DOAnalyticsResult,
  GraphQLAnalyticsResponse
} from '../types'
import { logInfo, logError, logWarning } from '../utils/error-logger'

// ============================================================================
// CONSTANTS
// ============================================================================

const GRAPHQL_API = 'https://api.cloudflare.com/client/v4/graphql'
const METRICS_CACHE_TTL = 2 * 60 * 1000 // 2 minutes per project standards

// Rate limiting constants per DO Manager rules
const RATE_LIMIT = {
  INITIAL_BACKOFF: 2000,
  MAX_BACKOFF: 8000,
  BACKOFF_MULTIPLIER: 2,
  RETRY_CODES: [429, 503, 504],
}

// ============================================================================
// CACHING (Map<key, {data, timestamp}> pattern)
// ============================================================================

const metricsCache = new Map<string, { data: DOMetricsResponse; timestamp: number }>()

function getCacheKey(accountId: string, scriptName: string | null, timeRange: DOMetricsTimeRange): string {
  return `do-metrics:${accountId}:${scriptName ?? 'all'}:${timeRange}`
}

function getFromCache(key: string): DOMetricsResponse | null {
  const cached = metricsCache.get(key)
  if (cached && Date.now() - cached.timestamp < METRICS_CACHE_TTL) {
    return cached.data
  }
  metricsCache.delete(key)
  return null
}

function setCache(key: string, data: DOMetricsResponse): void {
  metricsCache.set(key, { data, timestamp: Date.now() })
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(data: unknown, corsHeaders: CorsHeaders, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

function errorResponse(message: string, corsHeaders: CorsHeaders, status = 500): Response {
  return jsonResponse({ error: message, success: false }, corsHeaders, status)
}

// ============================================================================
// DATE RANGE CALCULATION
// ============================================================================

function getDateRange(timeRange: DOMetricsTimeRange): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (timeRange) {
    case '24h':
      start.setHours(start.getHours() - 24)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
  }

  return {
    start: start.toISOString().split('T')[0] ?? '',
    end: end.toISOString().split('T')[0] ?? ''
  }
}

// ============================================================================
// RATE LIMITING & FETCH
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null
  let backoff = RATE_LIMIT.INITIAL_BACKOFF

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (!RATE_LIMIT.RETRY_CODES.includes(response.status)) {
        return response
      }

      if (attempt < maxRetries) {
        await sleep(backoff)
        backoff = Math.min(backoff * RATE_LIMIT.BACKOFF_MULTIPLIER, RATE_LIMIT.MAX_BACKOFF)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries) {
        await sleep(backoff)
        backoff = Math.min(backoff * RATE_LIMIT.BACKOFF_MULTIPLIER, RATE_LIMIT.MAX_BACKOFF)
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

// ============================================================================
// GRAPHQL QUERY BUILDER
// ============================================================================

/**
 * Build GraphQL query for all 4 DO analytics datasets
 * Note: DO analytics doesn't expose scriptName/namespaceId dimensions like D1 does,
 * so we query aggregate metrics across all namespaces.
 * 
 * Fields are based on Cloudflare's official documentation:
 * https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/
 */
function buildAnalyticsQuery(
  accountId: string,
  start: string,
  end: string,
  _scriptName?: string // Reserved for future use if Cloudflare adds namespace filtering
): string {
  // Note: Using only documented fields to avoid GraphQL errors
  // Fields based on working Grafana dashboard example:
  // https://github.com/TimoWilhelm/grafana-do-dashboard
  // 
  // Documented datasets:
  // - durableObjectsInvocationsAdaptiveGroups: requests, responseBodySize, errors, wallTime
  // - durableObjectsPeriodicGroups: cpuTime
  // - durableObjectsStorageGroups: storedBytes
  // Note: durableObjectsSubrequestsAdaptiveGroups removed as it may not exist in schema

  return `query DurableObjectMetrics {
  viewer {
    accounts(filter: {accountTag: "${accountId}"}) {
      durableObjectsInvocationsAdaptiveGroups(
        limit: 10000
        filter: {date_geq: "${start}", date_leq: "${end}"}
        orderBy: [date_DESC]
      ) {
        sum {
          requests
          responseBodySize
        }
        dimensions {
          date
        }
      }
      durableObjectsPeriodicGroups(
        limit: 10000
        filter: {date_geq: "${start}", date_leq: "${end}"}
        orderBy: [date_DESC]
      ) {
        sum {
          cpuTime
        }
        dimensions {
          date
        }
      }
      durableObjectsStorageGroups(
        limit: 10000
        filter: {date_geq: "${start}", date_leq: "${end}"}
        orderBy: [date_DESC]
      ) {
        max {
          storedBytes
        }
        dimensions {
          date
        }
      }
    }
  }
}`
}




// ============================================================================
// GRAPHQL EXECUTION
// ============================================================================

async function executeGraphQLQuery(
  env: Env,
  query: string,
  isLocalDev: boolean
): Promise<DOAnalyticsResult | null> {
  // Build auth headers - support both API Token and Global API Key
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (env.API_KEY && env.API_KEY.length < 50) {
    // Global API Key style - requires email
    headers['X-Auth-Email'] = 'writenotenow@gmail.com'
    headers['X-Auth-Key'] = env.API_KEY
  } else {
    // API Token style
    headers['Authorization'] = `Bearer ${env.API_KEY}`
  }

  try {
    logInfo('Executing GraphQL analytics query', {
      module: 'metrics',
      operation: 'graphql_query'
    })

    const response = await fetchWithBackoff(GRAPHQL_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      const errorText = await response.text()
      await logError(env, `GraphQL API error: ${errorText}`, {
        module: 'metrics',
        operation: 'graphql_query',
        metadata: { status: response.status }
      }, isLocalDev)
      return null
    }

    const result: GraphQLAnalyticsResponse<DOAnalyticsResult> = await response.json()

    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map(e => e.message).join(', ')
      await logError(env, `GraphQL errors: ${errorMessages}`, {
        module: 'metrics',
        operation: 'graphql_query',
        metadata: { errors: result.errors }
      }, isLocalDev)
      return null
    }

    return result.data ?? null
  } catch (err) {
    await logError(env, err instanceof Error ? err : String(err), {
      module: 'metrics',
      operation: 'graphql_query'
    }, isLocalDev)
    return null
  }
}

// ============================================================================
// METRICS PROCESSING
// ============================================================================

function processMetricsData(
  data: DOAnalyticsResult,
  timeRange: DOMetricsTimeRange,
  startDate: string,
  endDate: string
): DOMetricsResponse {
  const accounts = data.viewer.accounts
  const account = accounts[0]

  if (!account) {
    return createEmptyMetrics(timeRange, startDate, endDate)
  }

  const invocationsGroups = account.durableObjectsInvocationsAdaptiveGroups ?? []
  const periodicGroups = account.durableObjectsPeriodicGroups ?? []
  const storageGroups = account.durableObjectsStorageGroups ?? []
  const subrequestsGroups = account.durableObjectsSubrequestsAdaptiveGroups ?? []

  // Build invocations time series (aggregate across all namespaces)
  // Note: Only using fields documented in Cloudflare's GraphQL API
  const invocationsSeries: DOInvocationDataPoint[] = invocationsGroups.map(group => ({
    date: group.dimensions?.date ?? '',
    scriptName: undefined, // Not available in DO GraphQL schema
    requests: group.sum?.requests ?? 0,
    errors: 0, // Not available in DO GraphQL schema - hardcoded to 0
    responseBodySize: group.sum?.responseBodySize ?? 0,
    wallTimeP50: undefined, // Not available in DO GraphQL schema
    wallTimeP90: undefined, // Not available in DO GraphQL schema
    wallTimeP99: undefined  // Not available in DO GraphQL schema
  }))


  // Build storage time series (aggregate across all namespaces)
  const storageSeries: DOStorageDataPoint[] = storageGroups.map(group => ({
    date: group.dimensions?.date ?? '',
    scriptName: undefined, // Not available in DO GraphQL schema
    storedBytes: group.max?.storedBytes ?? 0,
    storedKeys: group.max?.storedKeys
  }))

  // Build subrequests time series (aggregate across all namespaces)
  const subrequestsSeries: DOSubrequestDataPoint[] = subrequestsGroups.map(group => ({
    date: group.dimensions?.date ?? '',
    scriptName: undefined, // Not available in DO GraphQL schema
    requests: group.sum?.requests ?? 0,
    responseBodySize: group.sum?.responseBodySize ?? 0
  }))

  // Aggregate all metrics (DO GraphQL doesn't expose per-namespace breakdown)
  // Note: We create a single "All Namespaces" entry for aggregate metrics
  const aggregateKey = 'all-namespaces'
  const byNamespaceMap = new Map<string, DONamespaceMetrics>()

  // Process invocations - aggregate all
  // Note: errors and latency quantiles are not available in DO GraphQL schema
  let totalRequests = 0
  for (const group of invocationsGroups) {
    totalRequests += group.sum?.requests ?? 0
  }

  // Process periodic (CPU time) - aggregate all
  let totalCpuTimeMs = 0
  for (const group of periodicGroups) {
    // Convert microseconds to milliseconds
    totalCpuTimeMs += (group.sum?.cpuTime ?? 0) / 1000
  }

  // Get latest storage (first entry since ordered DESC)
  let totalStorageBytes = 0
  let totalStorageKeys: number | undefined = undefined
  if (storageGroups.length > 0) {
    const latestStorage = storageGroups[0]
    totalStorageBytes = latestStorage?.max?.storedBytes ?? 0
    totalStorageKeys = latestStorage?.max?.storedKeys
  }

  // Sum subrequests
  let totalSubrequests = 0
  for (const group of subrequestsGroups) {
    totalSubrequests += group.sum?.requests ?? 0
  }

  // Note: latency percentiles not available in DO GraphQL schema
  const avgLatencyMs = undefined
  const totalErrors = 0 // Not available in DO GraphQL schema

  // Create single aggregate entry for byNamespace
  byNamespaceMap.set(aggregateKey, {
    scriptName: 'all-namespaces',
    namespaceName: 'All Durable Objects',
    totalRequests,
    totalErrors,
    totalCpuTimeMs,
    currentStorageBytes: totalStorageBytes,
    currentStorageKeys: totalStorageKeys,
    p50LatencyMs: undefined,
    p90LatencyMs: undefined,
    p99LatencyMs: undefined
  })


  const byNamespace = Array.from(byNamespaceMap.values())

  return {
    summary: {
      timeRange,
      startDate,
      endDate,
      totalRequests,
      totalErrors,
      totalCpuTimeMs,
      totalStorageBytes,
      totalStorageKeys,
      totalSubrequests,
      avgLatencyMs,
      namespaceCount: byNamespace.length
    },
    byNamespace,
    invocationsSeries,
    storageSeries,
    subrequestsSeries
  }
}


function createEmptyMetrics(
  timeRange: DOMetricsTimeRange,
  startDate: string,
  endDate: string
): DOMetricsResponse {
  return {
    summary: {
      timeRange,
      startDate,
      endDate,
      totalRequests: 0,
      totalErrors: 0,
      totalCpuTimeMs: 0,
      totalStorageBytes: 0,
      totalSubrequests: 0,
      namespaceCount: 0
    },
    byNamespace: [],
    invocationsSeries: [],
    storageSeries: [],
    subrequestsSeries: []
  }
}

// ============================================================================
// MOCK DATA FOR LOCAL DEVELOPMENT
// ============================================================================

function generateMockMetrics(timeRange: DOMetricsTimeRange): DOMetricsResponse {
  const { start, end } = getDateRange(timeRange)

  const mockScripts = [
    { name: 'my-worker', displayName: 'My Worker DO' },
    { name: 'chat-app', displayName: 'Chat App DO' }
  ]

  const invocationsSeries: DOInvocationDataPoint[] = []
  const storageSeries: DOStorageDataPoint[] = []
  const subrequestsSeries: DOSubrequestDataPoint[] = []

  const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30
  const endDate = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0] ?? ''

    for (const script of mockScripts) {
      // Generate invocations data
      invocationsSeries.push({
        date: dateStr,
        scriptName: script.name,
        requests: Math.floor(Math.random() * 5000) + 500,
        errors: Math.floor(Math.random() * 50),
        responseBodySize: Math.floor(Math.random() * 1024 * 1024),
        wallTimeP50: Math.random() * 10 + 2,
        wallTimeP90: Math.random() * 30 + 10,
        wallTimeP99: Math.random() * 100 + 30
      })

      // Generate storage data
      const baseBytes = script.name === 'my-worker' ? 50 * 1024 * 1024 : 10 * 1024 * 1024
      storageSeries.push({
        date: dateStr,
        scriptName: script.name,
        storedBytes: baseBytes + Math.floor(Math.random() * 1024 * 1024) - i * 100000,
        storedKeys: undefined // Not always available
      })

      // Generate subrequests data
      subrequestsSeries.push({
        date: dateStr,
        scriptName: script.name,
        requests: Math.floor(Math.random() * 1000) + 50,
        responseBodySize: Math.floor(Math.random() * 512 * 1024)
      })
    }
  }

  // Build namespace summaries
  const byNamespace: DONamespaceMetrics[] = mockScripts.map(script => ({
    scriptName: script.name,
    namespaceName: script.displayName,
    totalRequests: Math.floor(Math.random() * 50000) + 5000,
    totalErrors: Math.floor(Math.random() * 500),
    totalCpuTimeMs: Math.floor(Math.random() * 10000) + 1000,
    currentStorageBytes: script.name === 'my-worker' ? 52428800 : 10485760,
    p50LatencyMs: Math.random() * 8 + 2,
    p90LatencyMs: Math.random() * 25 + 10,
    p99LatencyMs: Math.random() * 80 + 30
  }))


  const totalRequests = byNamespace.reduce((sum, ns) => sum + ns.totalRequests, 0)
  const totalErrors = byNamespace.reduce((sum, ns) => sum + ns.totalErrors, 0)
  const totalCpuTimeMs = byNamespace.reduce((sum, ns) => sum + ns.totalCpuTimeMs, 0)
  const totalStorageBytes = byNamespace.reduce((sum, ns) => sum + ns.currentStorageBytes, 0)
  const totalSubrequests = subrequestsSeries.reduce((sum, s) => sum + s.requests, 0)

  return {
    summary: {
      timeRange,
      startDate: start,
      endDate: end,
      totalRequests,
      totalErrors,
      totalCpuTimeMs,
      totalStorageBytes,
      totalSubrequests,
      avgLatencyMs: {
        p50: 5.5,
        p90: 18.0,
        p99: 55.0
      },
      namespaceCount: mockScripts.length
    },
    byNamespace,
    invocationsSeries,
    storageSeries,
    subrequestsSeries
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function handleMetricsRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/metrics - Get DO metrics with optional namespace filter
  if (method === 'GET' && path === '/api/metrics') {
    // Parse parameters
    const rangeParam = url.searchParams.get('range') ?? '7d'
    const scriptName = url.searchParams.get('scriptName') ?? undefined
    const skipCache = url.searchParams.get('skipCache') === 'true'

    // Validate time range
    const validRanges: DOMetricsTimeRange[] = ['24h', '7d', '30d']
    if (!validRanges.includes(rangeParam as DOMetricsTimeRange)) {
      return errorResponse('Invalid time range. Must be one of: 24h, 7d, 30d', corsHeaders, 400)
    }

    const timeRange = rangeParam as DOMetricsTimeRange

    logInfo(`Fetching DO metrics for range: ${timeRange}${scriptName ? ` (filtered to ${scriptName})` : ''}`, {
      module: 'metrics',
      operation: 'get_metrics',
      metadata: { timeRange, scriptName }
    })

    // Return mock data for local development
    if (isLocalDev || !env.ACCOUNT_ID || !env.API_KEY) {
      logInfo('Using mock metrics data for local development', {
        module: 'metrics',
        operation: 'get_metrics'
      })

      return jsonResponse({
        result: generateMockMetrics(timeRange),
        success: true
      }, corsHeaders)
    }

    // Check cache (unless skip requested)
    const cacheKey = getCacheKey(env.ACCOUNT_ID, scriptName ?? null, timeRange)
    if (!skipCache) {
      const cached = getFromCache(cacheKey)
      if (cached) {
        logInfo('Returning cached metrics', {
          module: 'metrics',
          operation: 'get_metrics'
        })
        return jsonResponse({
          result: cached,
          success: true
        }, corsHeaders)
      }
    }

    const { start, end } = getDateRange(timeRange)
    const query = buildAnalyticsQuery(env.ACCOUNT_ID, start, end, scriptName)

    const analyticsData = await executeGraphQLQuery(env, query, isLocalDev)

    if (!analyticsData) {
      logWarning('Failed to fetch metrics from GraphQL API', {
        module: 'metrics',
        operation: 'get_metrics'
      })

      // Return empty metrics with warning instead of error
      return jsonResponse({
        result: {
          ...createEmptyMetrics(timeRange, start, end),
          warning: 'Failed to fetch metrics from Cloudflare GraphQL API. This may be a permissions issue or no Durable Object data is available yet.'
        },
        success: true
      }, corsHeaders)
    }

    const metrics = processMetricsData(analyticsData, timeRange, start, end)

    // Cache the result
    setCache(cacheKey, metrics)

    logInfo('Successfully retrieved DO metrics', {
      module: 'metrics',
      operation: 'get_metrics',
      metadata: {
        namespaceCount: metrics.summary.namespaceCount,
        totalRequests: metrics.summary.totalRequests,
        hasStorageData: metrics.storageSeries.length > 0
      }
    })

    return jsonResponse({
      result: metrics,
      success: true
    }, corsHeaders)
  }

  // GET /api/namespaces/:id/metrics - Get namespace-level metrics (legacy support)
  const nsMatch = /^\/api\/namespaces\/([^/]+)\/metrics$/.exec(path)
  if (method === 'GET' && nsMatch) {
    const namespaceId = nsMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }

    // Redirect to main metrics endpoint with scriptName filter
    // Note: We'd need to look up the scriptName from the namespace ID
    // For now, return account-level metrics
    const rangeParam = url.searchParams.get('range') ?? '7d'
    const newUrl = new URL(url)
    newUrl.pathname = '/api/metrics'
    newUrl.searchParams.set('range', rangeParam)

    return handleMetricsRoutes(
      new Request(newUrl, request),
      env,
      newUrl,
      corsHeaders,
      isLocalDev,
      _userEmail
    )
  }

  return errorResponse('Not Found', corsHeaders, 404)
}
