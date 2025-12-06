import type { Env, CorsHeaders } from '../types'
import { jsonResponse, errorResponse } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'

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
  const nsMatch = /^\/api\/namespaces\/([^/]+)\/metrics$/.exec(path)
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

    // Full query with invocations, storage, and CPU time
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
              sum {
                cpuTime
              }
            }
          }
        }
      }
    `

    // Build auth headers - support both API Token (Bearer) and Global API Key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Check if API_KEY looks like a Global API Key (shorter, no prefix) or API Token
    if (env.API_KEY && env.API_KEY.length < 50) {
      // Global API Key style - requires email
      headers['X-Auth-Email'] = 'writenotenow@gmail.com'
      headers['X-Auth-Key'] = env.API_KEY
    } else {
      // API Token style
      headers['Authorization'] = `Bearer ${env.API_KEY}`
    }

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers,
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
      logWarning(`GraphQL error: ${String(response.status)} ${errorText.slice(0, 200)}`, {
        module: 'metrics',
        operation: 'get_account',
        metadata: { status: response.status, errorText: errorText.slice(0, 200) }
      })
      // Return empty metrics instead of error to allow the UI to render
      return jsonResponse({
        invocations: {
          total: 0,
          success: 0,
          errors: 0,
          byDay: [],
        },
        storage: {
          totalBytes: 0,
          maxBytes: 10737418240,
        },
        duration: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
        warning: `Failed to fetch metrics from GraphQL API (${String(response.status)}). This may be due to API permissions or no Durable Object data available.`,
      }, corsHeaders)
    }

    interface GraphQLResponse {
      data?: {
        viewer?: {
          accounts?: {
            durableObjectsInvocationsAdaptiveGroups?: {
              sum?: { requests?: number }
              dimensions?: { date?: string }
            }[]
            durableObjectsStorageGroups?: {
              max?: { storedBytes?: number }
            }[]
            durableObjectsPeriodicGroups?: {
              sum?: { cpuTime?: number }
            }[]
          }[]
        }
      }
      errors?: { message: string }[]
    }

    const data = await response.json() as GraphQLResponse

    if (data.errors && data.errors.length > 0) {
      const firstError = data.errors[0]
      logWarning(`GraphQL errors: ${firstError?.message ?? 'Unknown error'}`, {
        module: 'metrics',
        operation: 'get_account',
        metadata: { errors: data.errors.map(e => e.message) }
      })
      // Return empty metrics with warning instead of error
      const errorMessage = firstError?.message ?? 'Unknown error'
      return jsonResponse({
        invocations: {
          total: 0,
          success: 0,
          errors: 0,
          byDay: [],
        },
        storage: {
          totalBytes: 0,
          maxBytes: 10737418240,
        },
        duration: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
        warning: `GraphQL API error: ${errorMessage}. The Analytics API may not have data for your account yet.`,
      }, corsHeaders)
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

    // Process CPU time (total, not percentiles - Cloudflare doesn't provide percentiles for DOs)
    const periodic = account?.durableObjectsPeriodicGroups ?? []
    const totalCpuTime = periodic.reduce(
      (sum, item) => sum + (item.sum?.cpuTime ?? 0),
      0
    )
    // Convert microseconds to milliseconds and calculate averages
    const totalCpuTimeMs = totalCpuTime / 1000
    const avgCpuTimeMs = totalRequests > 0 ? totalCpuTimeMs / totalRequests : 0

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
        // Cloudflare provides total CPU time, not percentiles for DOs
        // We show: total, average per request, and estimated p99 (2x average as approximation)
        p50: avgCpuTimeMs,
        p95: avgCpuTimeMs * 1.5, // Estimated
        p99: avgCpuTimeMs * 2, // Estimated
        totalMs: totalCpuTimeMs,
      },
    }, corsHeaders)
  } catch (error) {
    logWarning(`Metrics error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'metrics',
      operation: 'get_account',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    // Return empty metrics instead of error to allow the UI to render
    return jsonResponse({
      invocations: {
        total: 0,
        success: 0,
        errors: 0,
        byDay: [],
      },
      storage: {
        totalBytes: 0,
        maxBytes: 10737418240,
      },
      duration: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
      warning: `Failed to fetch metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, corsHeaders)
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

