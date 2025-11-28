import type {
  Namespace,
  Job,
  NamespacesResponse,
  NamespaceResponse,
  DiscoverResponse,
  JobsResponse,
} from '../types'

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
 * Namespace API functions
 */
export const namespaceApi = {
  /**
   * List all tracked namespaces
   */
  async list(): Promise<Namespace[]> {
    const data = await apiFetch<NamespacesResponse>('/namespaces')
    return data.namespaces
  },

  /**
   * Discover namespaces from Cloudflare API
   */
  async discover(): Promise<Namespace[]> {
    const data = await apiFetch<DiscoverResponse>('/namespaces/discover')
    return data.discovered
  },

  /**
   * Get a single namespace by ID
   */
  async get(id: string): Promise<Namespace> {
    const data = await apiFetch<NamespaceResponse>(`/namespaces/${id}`)
    return data.namespace
  },

  /**
   * Add a namespace manually
   */
  async add(namespace: {
    name: string
    class_name: string
    script_name?: string
    storage_backend?: 'sqlite' | 'kv'
    endpoint_url?: string
  }): Promise<Namespace> {
    const data = await apiFetch<NamespaceResponse>('/namespaces', {
      method: 'POST',
      body: JSON.stringify(namespace),
    })
    return data.namespace
  },

  /**
   * Delete a namespace
   */
  async delete(id: string): Promise<void> {
    await apiFetch(`/namespaces/${id}`, { method: 'DELETE' })
  },
}

/**
 * Job API functions
 */
export const jobApi = {
  /**
   * List jobs with optional filters
   */
  async list(options?: {
    status?: string
    namespace_id?: string
    limit?: number
  }): Promise<Job[]> {
    const params = new URLSearchParams()
    if (options?.status) params.set('status', options.status)
    if (options?.namespace_id) params.set('namespace_id', options.namespace_id)
    if (options?.limit) params.set('limit', String(options.limit))
    
    const query = params.toString()
    const endpoint = query ? `/jobs?${query}` : '/jobs'
    const data = await apiFetch<JobsResponse>(endpoint)
    return data.jobs
  },

  /**
   * Get a single job by ID
   */
  async get(id: string): Promise<Job> {
    const data = await apiFetch<{ job: Job }>(`/jobs/${id}`)
    return data.job
  },
}

/**
 * Auth API functions
 */
export const authApi = {
  /**
   * Logout - redirect to Cloudflare Access logout
   */
  logout(): void {
    // In production, this would redirect to the Access logout URL
    // For now, just reload the page
    window.location.href = '/'
  },
}

