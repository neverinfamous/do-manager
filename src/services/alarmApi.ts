const API_BASE = '/api'

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

export interface AlarmResponse {
  alarm: number | null
  hasAlarm: boolean
  alarmDate: string | null
  warning?: string
  error?: string
  details?: string
  admin_hook_required?: boolean
}

export interface SetAlarmResponse {
  success: boolean
  alarm: number
  alarmDate: string
}

/**
 * Alarm API functions
 */
export const alarmApi = {
  /**
   * Get current alarm for an instance
   */
  async get(instanceId: string): Promise<AlarmResponse> {
    return apiFetch<AlarmResponse>(`/instances/${instanceId}/alarm`)
  },

  /**
   * Set alarm for an instance
   */
  async set(instanceId: string, timestamp: number): Promise<SetAlarmResponse> {
    return apiFetch<SetAlarmResponse>(`/instances/${instanceId}/alarm`, {
      method: 'PUT',
      body: JSON.stringify({ timestamp }),
    })
  },

  /**
   * Delete alarm for an instance
   */
  async delete(instanceId: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/alarm`, { method: 'DELETE' })
  },
}

