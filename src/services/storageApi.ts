import { apiFetch } from '../lib/apiFetch'

export interface StorageListResponse {
  keys?: string[]
  tables?: string[]
  error?: string
  warning?: string
  details?: string
  admin_hook_required?: boolean
}

export interface StorageValueResponse {
  key: string
  value: unknown
}

export interface SqlResponse {
  results: unknown[]
  rowCount: number
  message?: string
}

/**
 * Storage API functions
 * Note: Storage operations are not cached as they interact with
 * live Durable Object storage that may change frequently
 */
export const storageApi = {
  /**
   * List storage keys and tables
   */
  async list(instanceId: string): Promise<StorageListResponse> {
    return apiFetch<StorageListResponse>(`/instances/${instanceId}/storage`)
  },

  /**
   * Get a storage value
   */
  async get(instanceId: string, key: string): Promise<StorageValueResponse> {
    return apiFetch<StorageValueResponse>(
      `/instances/${instanceId}/storage/${encodeURIComponent(key)}`
    )
  },

  /**
   * Set a storage value
   */
  async set(instanceId: string, key: string, value: unknown): Promise<void> {
    await apiFetch(`/instances/${instanceId}/storage/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  },

  /**
   * Delete a storage value
   */
  async delete(instanceId: string, key: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    })
  },

  /**
   * Rename a storage key
   */
  async renameKey(instanceId: string, oldKey: string, newKey: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/storage/rename`, {
      method: 'POST',
      body: JSON.stringify({ oldKey, newKey }),
    })
  },

  /**
   * Execute SQL query
   */
  async sql(instanceId: string, query: string): Promise<SqlResponse> {
    return apiFetch<SqlResponse>(`/instances/${instanceId}/sql`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
}
