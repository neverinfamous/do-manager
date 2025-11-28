import type { Env, CorsHeaders } from '../types'
import { jsonResponse, errorResponse } from '../utils/helpers'

/**
 * Mock metrics for local development
 */
const MOCK_METRICS = {
  invocations: {
    total: 15234,
    success: 14890,
    errors: 344,
    byDay: [
      { date: '2024-03-01', requests: 2100 },
      { date: '2024-03-02', requests: 2450 },
      { date: '2024-03-03', requests: 2200 },
      { date: '2024-03-04', requests: 2800 },
      { date: '2024-03-05', requests: 2684 },
      { date: '2024-03-06', requests: 1500 },
      { date: '2024-03-07', requests: 1500 },
    ],
  },
  storage: {
    totalBytes: 1048576, // 1 MB
    maxBytes: 10737418240, // 10 GB
  },
  duration: {
    p50: 12,
    p95: 45,
    p99: 120,
  },
}

/**
 * Handle metrics routes
 */
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

  // GET /api/metrics - Get account-level DO metrics
  if (method === 'GET' && path === '/api/metrics') {
    return getAccountMetrics(env, url, corsHeaders, isLocalDev)
  }

  // GET /api/namespaces/:id/metrics - Get namespace-level metrics
  const nsMatch = path.match(/^\/api\/namespaces\/([^/]+)\/metrics$/)
  if (method === 'GET' && nsMatch) {
    const namespaceId = nsMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return getNamespaceMetrics(namespaceId, env, url, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * Get account-level Durable Object metrics via GraphQL
 */
async function getAccountMetrics(
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '7', 10), 31)

  if (isLocalDev) {
    return jsonResponse(MOCK_METRICS, corsHeaders)
  }

  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const query = `
      query GetDurableObjectMetrics($accountTag: string!, $startDate: Date!, $endDate: Date!) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            durableObjectsInvocationsAdaptiveGroups(
              filter: {date_geq: $startDate, date_leq: $endDate}
              limit: 1000
            ) {
              sum {
                requests
                responseBodySize
              }
              dimensions {
                date
              }
            }
            durableObjectsStorageGroups(
              filter: {date_geq: $startDate, date_leq: $endDate}
              limit: 1000
            ) {
              max {
                storedBytes
              }
            }
            durableObjectsPeriodicGroups(
              filter: {date_geq: $startDate, date_leq: $endDate}
              limit: 1000
            ) {
              quantiles {
                cpuTimeP50
                cpuTimeP95
                cpuTimeP99
              }
            }
          }
        }
      }
    `

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: env.ACCOUNT_ID,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Metrics] GraphQL error:', errorText)
      return errorResponse('Failed to fetch metrics', corsHeaders, response.status)
    }

    interface GraphQLResponse {
      data?: {
        viewer?: {
          accounts?: Array<{
            durableObjectsInvocationsAdaptiveGroups?: Array<{
              sum?: { requests?: number; responseBodySize?: number }
              dimensions?: { date?: string }
            }>
            durableObjectsStorageGroups?: Array<{
              max?: { storedBytes?: number }
            }>
            durableObjectsPeriodicGroups?: Array<{
              quantiles?: { cpuTimeP50?: number; cpuTimeP95?: number; cpuTimeP99?: number }
            }>
          }>
        }
      }
      errors?: Array<{ message: string }>
    }

    const data = await response.json() as GraphQLResponse

    if (data.errors?.length) {
      console.error('[Metrics] GraphQL errors:', data.errors)
      return errorResponse(data.errors[0]?.message ?? 'GraphQL error', corsHeaders, 500)
    }

    const account = data.data?.viewer?.accounts?.[0]

    // Process invocations
    const invocations = account?.durableObjectsInvocationsAdaptiveGroups ?? []
    const totalRequests = invocations.reduce(
      (sum, item) => sum + (item.sum?.requests ?? 0),
      0
    )
    const byDay = invocations.map((item) => ({
      date: item.dimensions?.date ?? '',
      requests: item.sum?.requests ?? 0,
    }))

    // Process storage
    const storage = account?.durableObjectsStorageGroups ?? []
    const maxStoredBytes = storage.reduce(
      (max, item) => Math.max(max, item.max?.storedBytes ?? 0),
      0
    )

    // Process duration/CPU time
    const periodic = account?.durableObjectsPeriodicGroups ?? []
    const quantiles = periodic[0]?.quantiles ?? {}

    return jsonResponse({
      invocations: {
        total: totalRequests,
        success: totalRequests, // GraphQL doesn't separate this
        errors: 0,
        byDay,
      },
      storage: {
        totalBytes: maxStoredBytes,
        maxBytes: 10737418240, // 10 GB limit
      },
      duration: {
        p50: quantiles.cpuTimeP50 ?? 0,
        p95: quantiles.cpuTimeP95 ?? 0,
        p99: quantiles.cpuTimeP99 ?? 0,
      },
    }, corsHeaders)
  } catch (error) {
    console.error('[Metrics] Error:', error)
    return errorResponse('Failed to fetch metrics', corsHeaders, 500)
  }
}

/**
 * Get namespace-level metrics
 */
async function getNamespaceMetrics(
  namespaceId: string,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  // For now, return mock data or account-level metrics
  // Cloudflare's GraphQL API supports filtering by scriptName
  
  if (isLocalDev) {
    return jsonResponse({
      ...MOCK_METRICS,
      namespace_id: namespaceId,
    }, corsHeaders)
  }

  // In production, would query with namespace filter
  return getAccountMetrics(env, url, corsHeaders, isLocalDev)
}

