import { downloadJson, generateTimestampedFilename } from '../lib/downloadUtils'

const API_BASE = '/api'

/**
 * Export response from API
 */
export interface ExportResponse {
  data: Record<string, unknown>
  exportedAt: string
  keyCount: number
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  storageBackend: string
}

/**
 * Export API functions
 */
export const exportApi = {
  /**
   * Export instance storage data
   */
  async exportInstance(instanceId: string): Promise<ExportResponse> {
    const response = await fetch(`${API_BASE}/instances/${instanceId}/export`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(errorData.error ?? `Export failed: ${String(response.status)}`)
    }

    return response.json() as Promise<ExportResponse>
  },

  /**
   * Export and download instance as JSON file
   */
  async downloadInstance(instanceId: string, instanceName: string): Promise<void> {
    const exportData = await this.exportInstance(instanceId)
    const filename = generateTimestampedFilename(`instance-${instanceName}`, 'json')
    downloadJson(exportData, filename)
  },
}

