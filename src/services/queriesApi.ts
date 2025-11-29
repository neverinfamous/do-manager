import type { SavedQuery } from '../types'

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

/**
 * Create saved query request
 */
export interface CreateQueryRequest {
  name: string
  description?: string
  query: string
}

/**
 * Update saved query request
 */
export interface UpdateQueryRequest {
  name?: string
  description?: string
  query?: string
}

/**
 * Saved queries API functions
 */
export const queriesApi = {
  /**
   * List saved queries for a namespace
   */
  async list(namespaceId: string): Promise<SavedQuery[]> {
    const data = await apiFetch<{ queries: SavedQuery[] }>(
      `/namespaces/${namespaceId}/queries`
    )
    return data.queries
  },

  /**
   * Create a new saved query
   */
  async create(namespaceId: string, data: CreateQueryRequest): Promise<SavedQuery> {
    const result = await apiFetch<{ query: SavedQuery }>(
      `/namespaces/${namespaceId}/queries`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
    return result.query
  },

  /**
   * Update a saved query
   */
  async update(queryId: string, data: UpdateQueryRequest): Promise<SavedQuery> {
    const result = await apiFetch<{ query: SavedQuery }>(
      `/queries/${queryId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
    return result.query
  },

  /**
   * Delete a saved query
   */
  async delete(queryId: string): Promise<void> {
    await apiFetch(`/queries/${queryId}`, { method: 'DELETE' })
  },
}

