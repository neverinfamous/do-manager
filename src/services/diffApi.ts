const API_BASE = '/api'

/**
 * Diff result for comparing two instances
 */
export interface DiffResult {
  instanceA: {
    id: string
    name: string
    namespaceId: string
    namespaceName: string
  }
  instanceB: {
    id: string
    name: string
    namespaceId: string
    namespaceName: string
  }
  onlyInA: string[]
  onlyInB: string[]
  different: {
    key: string
    valueA: unknown
    valueB: unknown
  }[]
  identical: string[]
  summary: {
    totalA: number
    totalB: number
    onlyInACount: number
    onlyInBCount: number
    differentCount: number
    identicalCount: number
  }
}

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
 * Diff API functions
 */
export const diffApi = {
  /**
   * Compare storage between two instances
   */
  async compare(instanceIdA: string, instanceIdB: string): Promise<DiffResult> {
    const result = await apiFetch<{ diff: DiffResult }>('/instances/diff', {
      method: 'POST',
      body: JSON.stringify({ instanceIdA, instanceIdB }),
    })
    return result.diff
  },
}

