const API_BASE = '/api'

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(errorData.error ?? `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export interface MetricsData {
  invocations: {
    total: number
    success: number
    errors: number
    byDay: Array<{ date: string; requests: number }>
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

/**
 * Metrics API functions
 */
export const metricsApi = {
  /**
   * Get account-level metrics
   */
  async getAccountMetrics(days = 7): Promise<MetricsData> {
    return apiFetch<MetricsData>(`/metrics?days=${days}`)
  },

  /**
   * Get namespace-level metrics
   */
  async getNamespaceMetrics(namespaceId: string, days = 7): Promise<MetricsData> {
    return apiFetch<MetricsData>(`/namespaces/${namespaceId}/metrics?days=${days}`)
  },
}

