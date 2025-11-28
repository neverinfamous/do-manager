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
 * Backup API functions
 */
export const backupApi = {
  /**
   * List all backups
   */
  async list(options?: {
    namespace_id?: string
    limit?: number
  }): Promise<Backup[]> {
    const params = new URLSearchParams()
    if (options?.namespace_id) params.set('namespace_id', options.namespace_id)
    if (options?.limit) params.set('limit', String(options.limit))
    
    const query = params.toString()
    const endpoint = `/backups${query ? `?${query}` : ''}`
    const data = await apiFetch<BackupsResponse>(endpoint)
    return data.backups
  },

  /**
   * List backups for an instance
   */
  async listForInstance(instanceId: string): Promise<Backup[]> {
    const data = await apiFetch<BackupsResponse>(`/instances/${instanceId}/backups`)
    return data.backups
  },

  /**
   * Create a backup
   */
  async create(instanceId: string): Promise<Backup> {
    const data = await apiFetch<BackupResponse>(`/instances/${instanceId}/backups`, {
      method: 'POST',
    })
    return data.backup
  },

  /**
   * Restore from a backup
   */
  async restore(instanceId: string, backupId: string): Promise<RestoreResponse> {
    return apiFetch<RestoreResponse>(`/instances/${instanceId}/restore/${backupId}`, {
      method: 'POST',
    })
  },

  /**
   * Delete a backup
   */
  async delete(backupId: string): Promise<void> {
    await apiFetch(`/backups/${backupId}`, { method: 'DELETE' })
  },
}

