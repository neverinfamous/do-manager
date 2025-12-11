import { apiFetch } from '../lib/apiFetch'

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
