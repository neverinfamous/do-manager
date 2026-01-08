import { apiFetch } from '../lib/apiFetch'
import { getCached, setCache, CACHE_KEYS, CACHE_TTL } from '../lib/cache'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Time range options for metrics queries
 */
export type DOMetricsTimeRange = '24h' | '7d' | '30d'

/**
 * Overall metrics summary
 */
export interface DOMetricsSummary {
  timeRange: DOMetricsTimeRange
  startDate: string
  endDate: string
  totalRequests: number
  totalErrors: number
  totalCpuTimeMs: number
  totalStorageBytes: number
  totalStorageKeys?: number
  totalSubrequests: number
  avgLatencyMs?: {
    p50: number
    p90: number
    p99: number
  }
  namespaceCount: number
}

/**
 * Per-namespace metrics breakdown
 */
export interface DONamespaceMetrics {
  scriptName: string
  namespaceName?: string
  totalRequests: number
  totalErrors: number
  totalCpuTimeMs: number
  currentStorageBytes: number
  currentStorageKeys?: number
  p50LatencyMs?: number
  p90LatencyMs?: number
  p99LatencyMs?: number
}

/**
 * Time series data point for invocations
 */
export interface DOInvocationDataPoint {
  date: string
  scriptName?: string
  requests: number
  errors: number
  responseBodySize: number
  wallTimeP50?: number
  wallTimeP90?: number
  wallTimeP99?: number
}

/**
 * Time series data point for storage
 */
export interface DOStorageDataPoint {
  date: string
  scriptName?: string
  storedBytes: number
  storedKeys?: number
}

/**
 * Time series data point for subrequests
 */
export interface DOSubrequestDataPoint {
  date: string
  scriptName?: string
  requests: number
  responseBodySize: number
}

/**
 * Complete metrics response from API
 */
export interface DOMetricsResponse {
  summary: DOMetricsSummary
  byNamespace: DONamespaceMetrics[]
  invocationsSeries: DOInvocationDataPoint[]
  storageSeries: DOStorageDataPoint[]
  subrequestsSeries: DOSubrequestDataPoint[]
  warning?: string
}

// Legacy type alias for backwards compatibility
export interface MetricsData {
  invocations: {
    total: number
    success: number
    errors: number
    byDay: { date: string; requests: number }[]
  }
  storage: {
    totalBytes: number
    maxBytes: number
  }
  duration: {
    p50: number
    p95: number
    p99: number
    totalMs?: number
  }
  warning?: string
}

// ============================================================================
// API SERVICE
// ============================================================================

/**
 * Metrics API functions with caching support
 */
export const metricsApi = {
  /**
   * Get DO metrics with full GraphQL analytics
   * Uses 2-minute TTL for metrics data
   * @param timeRange Time range: 24h, 7d, or 30d (default: 7d)
   * @param scriptName Optional script name to filter by
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async getMetrics(
    timeRange: DOMetricsTimeRange = '7d',
    scriptName?: string,
    skipCache = false
  ): Promise<DOMetricsResponse> {
    const cacheKey = `${CACHE_KEYS.METRICS}:${timeRange}:${scriptName ?? 'all'}`

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.METRICS) as DOMetricsResponse | undefined
      if (cached) {
        return cached
      }
    }

    const params = new URLSearchParams({ range: timeRange })
    if (scriptName) {
      params.set('scriptName', scriptName)
    }
    if (skipCache) {
      params.set('skipCache', 'true')
    }

    const response = await apiFetch<{ result: DOMetricsResponse; success: boolean }>(
      `/metrics?${params.toString()}`
    )

    if (response.result !== undefined && response.result !== null) {
      setCache(cacheKey, response.result)
      return response.result
    }

    throw new Error('Failed to fetch metrics')

  },

  /**
   * Get account-level metrics (legacy API - converts to new format)
   * Uses 2-minute TTL for metrics data
   * @param days Number of days to fetch (default: 7)
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   * @deprecated Use getMetrics() instead
   */
  async getAccountMetrics(days = 7, skipCache = false): Promise<MetricsData> {
    // Map days to time range
    const timeRange: DOMetricsTimeRange = days <= 1 ? '24h' : days <= 7 ? '7d' : '30d'

    const newMetrics = await this.getMetrics(timeRange, undefined, skipCache)

    // Convert new format to legacy format
    return convertToLegacyFormat(newMetrics)
  },

  /**
   * Get namespace-level metrics (legacy API - converts to new format)
   * Uses 2-minute TTL for metrics data
   * @param namespaceId Namespace ID (not currently used for filtering)
   * @param days Number of days to fetch (default: 7)
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   * @deprecated Use getMetrics() with scriptName instead
   */
  async getNamespaceMetrics(
    _namespaceId: string,
    days = 7,
    skipCache = false
  ): Promise<MetricsData> {
    // For now, return account-level metrics
    // Map days to time range (inlined to avoid calling deprecated getAccountMetrics)
    const timeRange: DOMetricsTimeRange = days <= 1 ? '24h' : days <= 7 ? '7d' : '30d'

    const newMetrics = await this.getMetrics(timeRange, undefined, skipCache)

    // Convert new format to legacy format
    return convertToLegacyFormat(newMetrics)
  },
}


/**
 * Convert new DOMetricsResponse to legacy MetricsData format
 */
function convertToLegacyFormat(metrics: DOMetricsResponse): MetricsData {
  // Aggregate invocations by date
  const byDayMap = new Map<string, number>()
  for (const point of metrics.invocationsSeries) {
    const existing = byDayMap.get(point.date) ?? 0
    byDayMap.set(point.date, existing + point.requests)
  }

  const byDay = Array.from(byDayMap.entries())
    .map(([date, requests]) => ({ date, requests }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const result: MetricsData = {
    invocations: {
      total: metrics.summary.totalRequests,
      success: metrics.summary.totalRequests - metrics.summary.totalErrors,
      errors: metrics.summary.totalErrors,
      byDay,
    },
    storage: {
      totalBytes: metrics.summary.totalStorageBytes,
      maxBytes: 10737418240, // 10 GB limit
    },
    duration: {
      p50: metrics.summary.avgLatencyMs?.p50 ?? 0,
      p95: metrics.summary.avgLatencyMs?.p90 ?? 0, // Using p90 as p95 approximation
      p99: metrics.summary.avgLatencyMs?.p99 ?? 0,
      totalMs: metrics.summary.totalCpuTimeMs,
    },
  }

  if (metrics.warning !== undefined) {
    result.warning = metrics.warning
  }

  return result
}

