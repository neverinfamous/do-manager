const API_BASE = '/api'

/**
 * Active alarm info in health summary
 */
export interface ActiveAlarmInfo {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  scheduledTime: string
  createdAt: string
}

/**
 * Completed alarm info in health summary
 */
export interface CompletedAlarmInfo {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  scheduledTime: string
  completedAt: string
  status: 'completed' | 'cancelled'
}

/**
 * Stale instance info in health summary
 */
export interface StaleInstance {
  id: string
  name: string
  namespaceId: string
  namespaceName: string
  lastAccessed: string | null
  daysSinceAccess: number
}

/**
 * High storage instance info in health summary
 */
export interface HighStorageInstance {
  id: string
  name: string
  namespaceId: string
  namespaceName: string
  storageSizeBytes: number
  percentUsed: number
  level: 'warning' | 'critical'
}

/**
 * Storage quota constants (10GB DO limit)
 */
export const STORAGE_QUOTA = {
  MAX_BYTES: 10 * 1024 * 1024 * 1024, // 10GB
  WARNING_THRESHOLD: 0.8, // 80%
  CRITICAL_THRESHOLD: 0.9, // 90%
}

/**
 * Health summary data
 */
export interface HealthSummary {
  namespaces: {
    total: number
    withEndpoint: number
  }
  instances: {
    total: number
    withAlarms: number
    stale: number
    highStorage: number
  }
  storage: {
    totalBytes: number
    avgPerInstance: number
  }
  activeAlarms: ActiveAlarmInfo[]
  completedAlarms: CompletedAlarmInfo[]
  staleInstances: StaleInstance[]
  highStorageInstances: HighStorageInstance[]
  recentJobs: {
    last24h: number
    last7d: number
    failedLast24h: number
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (options.headers) {
    const optHeaders = options.headers instanceof Headers
      ? options.headers
      : new Headers(options.headers as Record<string, string>)
    optHeaders.forEach((value, key) => headers.set(key, value))
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(errorData.error ?? `Request failed: ${String(response.status)}`)
  }

  return response.json() as Promise<T>
}

/**
 * Health API functions
 */
export const healthApi = {
  /**
   * Get health summary
   */
  async getSummary(): Promise<HealthSummary> {
    return apiFetch<HealthSummary>('/health')
  },
}
