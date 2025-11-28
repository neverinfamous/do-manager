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
   * Execute SQL query
   */
  async sql(instanceId: string, query: string): Promise<SqlResponse> {
    return apiFetch<SqlResponse>(`/instances/${instanceId}/sql`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
}

