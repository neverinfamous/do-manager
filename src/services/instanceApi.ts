import type { Instance } from '../types'
import type { InstancesResponse, InstanceResponse, CreateInstanceRequest } from '../types/instance'

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

/**
 * Instance API functions
 */
export const instanceApi = {
  /**
   * List instances for a namespace
   */
  async list(
    namespaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ instances: Instance[]; total: number }> {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    
    const query = params.toString()
    const endpoint = `/namespaces/${namespaceId}/instances${query ? `?${query}` : ''}`
    return apiFetch<InstancesResponse>(endpoint)
  },

  /**
   * Get a single instance
   */
  async get(instanceId: string): Promise<Instance> {
    const data = await apiFetch<InstanceResponse>(`/instances/${instanceId}`)
    return data.instance
  },

  /**
   * Create or ping an instance
   */
  async create(
    namespaceId: string,
    data: CreateInstanceRequest
  ): Promise<{ instance: Instance; created: boolean }> {
    const result = await apiFetch<InstanceResponse>(
      `/namespaces/${namespaceId}/instances`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
    return { instance: result.instance, created: result.created ?? true }
  },

  /**
   * Delete an instance tracking record
   */
  async delete(instanceId: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}`, { method: 'DELETE' })
  },

  /**
   * Update instance last accessed time
   */
  async markAccessed(instanceId: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/accessed`, { method: 'PUT' })
  },
}

