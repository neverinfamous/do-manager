import { apiFetch } from '../lib/apiFetch'
import { getCached, setCache, invalidatePrefix, CACHE_KEYS, CACHE_TTL } from '../lib/cache'

export interface Backup {
  id: string
  instance_id: string
  namespace_id: string
  r2_key: string
  size_bytes: number | null
  storage_type: string
  created_by: string | null
  created_at: string
  metadata: string | null
}

export interface BackupsResponse {
  backups: Backup[]
}

export interface BackupResponse {
  backup: Backup
}

export interface RestoreResponse {
  success: boolean
  message: string
}

/**
 * Backup API functions with caching support
 */
export const backupApi = {
  /**
   * List all backups
   * @param options Filter options
   * @param skipCache Set true to bypass cache
   */
  async list(options?: {
    namespace_id?: string
    limit?: number
  }, skipCache = false): Promise<Backup[]> {
    const params = new URLSearchParams()
    if (options?.namespace_id) params.set('namespace_id', options.namespace_id)
    if (options?.limit) params.set('limit', String(options.limit))

    const query = params.toString()
    const endpoint = `/backups${query ? `?${query}` : ''}`
    const cacheKey = `${CACHE_KEYS.BACKUPS}list:${query}`

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as Backup[] | undefined
      if (cached) {
        return cached
      }
    }

    const data = await apiFetch<BackupsResponse>(endpoint)
    setCache(cacheKey, data.backups)
    return data.backups
  },

  /**
   * List backups for an instance
   * @param instanceId Instance ID
   * @param skipCache Set true to bypass cache
   */
  async listForInstance(instanceId: string, skipCache = false): Promise<Backup[]> {
    const cacheKey = `${CACHE_KEYS.BACKUPS}instance:${instanceId}`

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as Backup[] | undefined
      if (cached) {
        return cached
      }
    }

    const data = await apiFetch<BackupsResponse>(`/instances/${instanceId}/backups`)
    setCache(cacheKey, data.backups)
    return data.backups
  },

  /**
   * Create a backup
   * Invalidates backup caches
   */
  async create(instanceId: string): Promise<Backup> {
    const data = await apiFetch<BackupResponse>(`/instances/${instanceId}/backups`, {
      method: 'POST',
    })
    // Invalidate backup caches
    invalidatePrefix(CACHE_KEYS.BACKUPS)
    return data.backup
  },

  /**
   * Restore from a backup
   * Invalidates backup caches
   */
  async restore(instanceId: string, backupId: string): Promise<RestoreResponse> {
    const result = await apiFetch<RestoreResponse>(`/instances/${instanceId}/restore/${backupId}`, {
      method: 'POST',
    })
    // Invalidate backup caches
    invalidatePrefix(CACHE_KEYS.BACKUPS)
    return result
  },

  /**
   * Delete a backup
   * Invalidates backup caches
   */
  async delete(backupId: string): Promise<void> {
    await apiFetch(`/backups/${backupId}`, { method: 'DELETE' })
    // Invalidate backup caches
    invalidatePrefix(CACHE_KEYS.BACKUPS)
  },
}
