import { apiFetch } from '../lib/apiFetch'
import { invalidateCache, invalidatePrefix, CACHE_KEYS } from '../lib/cache'

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
   * Invalidates health and instance caches since alarm state changes
   */
  async set(instanceId: string, timestamp: number): Promise<SetAlarmResponse> {
    const result = await apiFetch<SetAlarmResponse>(`/instances/${instanceId}/alarm`, {
      method: 'PUT',
      body: JSON.stringify({ timestamp }),
    })
    // Invalidate health cache since it shows active alarms
    invalidateCache(CACHE_KEYS.HEALTH)
    // Invalidate instance cache since has_alarm changes
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`)
    // Invalidate all instances lists to refresh alarm indicators
    invalidatePrefix(CACHE_KEYS.INSTANCES)
    return result
  },

  /**
   * Delete alarm for an instance
   * Invalidates health and instance caches since alarm state changes
   */
  async delete(instanceId: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/alarm`, { method: 'DELETE' })
    // Invalidate health cache since it shows active alarms
    invalidateCache(CACHE_KEYS.HEALTH)
    // Invalidate instance cache since has_alarm changes
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`)
    // Invalidate all instances lists to refresh alarm indicators
    invalidatePrefix(CACHE_KEYS.INSTANCES)
  },
}
