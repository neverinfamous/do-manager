import type {
  SearchResponse,
  KeySearchOptions,
  ValueSearchOptions,
} from '../types/search'

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
 * Search API functions
 */
export const searchApi = {
  /**
   * Search for keys across all namespaces/instances
   */
  async searchKeys(
    query: string,
    options: KeySearchOptions = {}
  ): Promise<SearchResponse> {
    return apiFetch<SearchResponse>('/search/keys', {
      method: 'POST',
      body: JSON.stringify({
        query,
        namespaceIds: options.namespaceIds,
        limit: options.limit,
      }),
    })
  },

  /**
   * Search within storage values across namespaces/instances
   */
  async searchValues(
    query: string,
    options: ValueSearchOptions = {}
  ): Promise<SearchResponse> {
    return apiFetch<SearchResponse>('/search/values', {
      method: 'POST',
      body: JSON.stringify({
        query,
        namespaceIds: options.namespaceIds,
        instanceIds: options.instanceIds,
        limit: options.limit,
      }),
    })
  },
}

