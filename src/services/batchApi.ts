import { exportApi, type ExportResponse } from './exportApi'
import type { Backup } from './backupApi'
import {
  downloadZip,
  generateTimestampedFilename,
  generateBatchExportManifest,
  type ZipFileEntry,
} from '../lib/downloadUtils'
import type { Instance, Namespace } from '../types'

const API_BASE = '/api'

/**
 * Progress callback for batch operations
 */
export type BatchProgressCallback = (progress: BatchProgress) => void

/**
 * Progress state for batch operations
 */
export interface BatchProgress {
  /** Current item being processed (0-indexed) */
  current: number
  /** Total items to process */
  total: number
  /** Percentage complete (0-100) */
  percentage: number
  /** Name of current item being processed */
  currentItemName: string
  /** Status of the operation */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** Error message if failed */
  error?: string
  /** Results for completed items */
  results: BatchItemResult[]
}

/**
 * Result for a single batch item
 */
export interface BatchItemResult {
  id: string
  name: string
  success: boolean
  error?: string
}

/**
 * Generate safe filename from instance name
 */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Log batch export instances job to server
 */
async function logBatchExportInstances(
  instanceIds: string[],
  namespaceId: string,
  namespaceName: string
): Promise<void> {
  try {
    await fetch(`${API_BASE}/batch/instances/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds, namespaceId, namespaceName }),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to log batch export job:', err)
  }
}

/**
 * Log batch export namespaces job to server
 */
async function logBatchExportNamespaces(namespaceIds: string[]): Promise<void> {
  try {
    await fetch(`${API_BASE}/batch/namespaces/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespaceIds }),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to log batch export job:', err)
  }
}

/**
 * Log batch delete keys job to server
 */
export async function logBatchDeleteKeys(params: {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  keys: string[]
  successCount: number
  failedCount: number
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/batch/keys/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to log batch delete keys job:', err)
  }
}

/**
 * Log batch export keys job to server
 */
export async function logBatchExportKeys(params: {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  keys: string[]
  exportedCount: number
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/batch/keys/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to log batch export keys job:', err)
  }
}

/**
 * Batch export instances and download as ZIP
 */
export async function batchExportInstances(
  instances: Instance[],
  namespace: Namespace,
  onProgress?: BatchProgressCallback
): Promise<void> {
  const total = instances.length
  const results: BatchItemResult[] = []
  const entries: ZipFileEntry[] = []
  const manifestInstances: {
    id: string
    name: string | null
    object_id: string
    filename: string
  }[] = []

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]
    if (!instance) continue
    
    const instanceName = instance.name ?? instance.object_id

    onProgress?.({
      current: i,
      total,
      percentage: Math.round((i / total) * 100),
      currentItemName: instanceName,
      status: 'processing',
      results,
    })

    try {
      const exportData: ExportResponse = await exportApi.exportInstance(instance.id)
      const filename = `${safeFilename(instanceName)}.json`

      entries.push({
        path: filename,
        content: exportData,
      })

      manifestInstances.push({
        id: instance.id,
        name: instance.name,
        object_id: instance.object_id,
        filename,
      })

      results.push({
        id: instance.id,
        name: instanceName,
        success: true,
      })
    } catch (err) {
      results.push({
        id: instance.id,
        name: instanceName,
        success: false,
        error: err instanceof Error ? err.message : 'Export failed',
      })
    }
  }

  // Generate manifest
  const manifest = generateBatchExportManifest(namespace, manifestInstances)

  // Create and download ZIP
  const zipFilename = generateTimestampedFilename(
    `${safeFilename(namespace.name)}-instances`,
    'zip'
  )
  downloadZip(entries, zipFilename, manifest as unknown as Record<string, unknown>)

  // Log the batch export job
  const successfulIds = results.filter((r) => r.success).map((r) => r.id)
  if (successfulIds.length > 0) {
    await logBatchExportInstances(successfulIds, namespace.id, namespace.name)
  }

  onProgress?.({
    current: total,
    total,
    percentage: 100,
    currentItemName: '',
    status: 'completed',
    results,
  })
}

/**
 * Batch export namespace configs and download as ZIP
 */
export async function batchExportNamespaces(
  namespaces: Namespace[],
  onProgress?: BatchProgressCallback
): Promise<void> {
  const total = namespaces.length
  const results: BatchItemResult[] = []
  const entries: ZipFileEntry[] = []

  for (let i = 0; i < namespaces.length; i++) {
    const namespace = namespaces[i]
    if (!namespace) continue

    onProgress?.({
      current: i,
      total,
      percentage: Math.round((i / total) * 100),
      currentItemName: namespace.name,
      status: 'processing',
      results,
    })

    try {
      const exportData = await exportApi.exportNamespace(namespace.id)
      const filename = `${safeFilename(namespace.name)}.json`

      entries.push({
        path: filename,
        content: exportData,
      })

      results.push({
        id: namespace.id,
        name: namespace.name,
        success: true,
      })
    } catch (err) {
      results.push({
        id: namespace.id,
        name: namespace.name,
        success: false,
        error: err instanceof Error ? err.message : 'Export failed',
      })
    }
  }

  // Create manifest
  const manifest = {
    exportedAt: new Date().toISOString(),
    totalNamespaces: results.filter((r) => r.success).length,
    namespaces: results.filter((r) => r.success).map((r) => ({
      id: r.id,
      name: r.name,
      filename: `${safeFilename(r.name)}.json`,
    })),
  }

  // Create and download ZIP
  const zipFilename = generateTimestampedFilename('namespace-configs', 'zip')
  downloadZip(entries, zipFilename, manifest as unknown as Record<string, unknown>)

  // Log the batch export job
  const successfulIds = results.filter((r) => r.success).map((r) => r.id)
  if (successfulIds.length > 0) {
    await logBatchExportNamespaces(successfulIds)
  }

  onProgress?.({
    current: total,
    total,
    percentage: 100,
    currentItemName: '',
    status: 'completed',
    results,
  })
}

/**
 * Batch delete instances via server API (tracks in job history)
 */
export async function batchDeleteInstances(
  instances: Instance[],
  onProgress?: BatchProgressCallback
): Promise<BatchItemResult[]> {
  const total = instances.length
  
  onProgress?.({
    current: 0,
    total,
    percentage: 0,
    currentItemName: 'Starting batch delete...',
    status: 'processing',
    results: [],
  })

  try {
    const response = await fetch(`${API_BASE}/batch/instances/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds: instances.map((i) => i.id) }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(errorData.error ?? 'Batch delete failed')
    }

    interface BatchDeleteResponse {
      results: BatchItemResult[]
      summary: { total: number; success: number; failed: number }
    }
    const data = await response.json() as BatchDeleteResponse

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'completed',
      results: data.results,
    })

    return data.results
  } catch (err) {
    const errorResult: BatchItemResult[] = instances.map((i) => ({
      id: i.id,
      name: i.name ?? i.object_id,
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    }))

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Batch delete failed',
      results: errorResult,
    })

    return errorResult
  }
}

/**
 * Batch delete namespaces via server API (tracks in job history)
 */
export async function batchDeleteNamespaces(
  namespaces: Namespace[],
  onProgress?: BatchProgressCallback
): Promise<BatchItemResult[]> {
  const total = namespaces.length
  
  onProgress?.({
    current: 0,
    total,
    percentage: 0,
    currentItemName: 'Starting batch delete...',
    status: 'processing',
    results: [],
  })

  try {
    const response = await fetch(`${API_BASE}/batch/namespaces/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespaceIds: namespaces.map((n) => n.id) }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(errorData.error ?? 'Batch delete failed')
    }

    interface BatchDeleteResponse {
      results: BatchItemResult[]
      summary: { total: number; success: number; failed: number }
    }
    const data = await response.json() as BatchDeleteResponse

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'completed',
      results: data.results,
    })

    return data.results
  } catch (err) {
    const errorResult: BatchItemResult[] = namespaces.map((n) => ({
      id: n.id,
      name: n.name,
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    }))

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Batch delete failed',
      results: errorResult,
    })

    return errorResult
  }
}

/**
 * Batch backup result
 */
export interface BatchBackupResult extends BatchItemResult {
  backup?: Backup
}

/**
 * Batch backup instances to R2 via server API (tracks in job history)
 */
export async function batchBackupInstances(
  instances: Instance[],
  onProgress?: BatchProgressCallback
): Promise<BatchBackupResult[]> {
  const total = instances.length
  
  onProgress?.({
    current: 0,
    total,
    percentage: 0,
    currentItemName: 'Starting batch backup...',
    status: 'processing',
    results: [],
  })

  try {
    const response = await fetch(`${API_BASE}/batch/instances/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceIds: instances.map((i) => i.id) }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(errorData.error ?? 'Batch backup failed')
    }

    interface BatchBackupResponse {
      results: BatchBackupResult[]
      summary: { total: number; success: number; failed: number }
    }
    const data = await response.json() as BatchBackupResponse

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'completed',
      results: data.results,
    })

    return data.results
  } catch (err) {
    const errorResult: BatchBackupResult[] = instances.map((i) => ({
      id: i.id,
      name: i.name ?? i.object_id,
      success: false,
      error: err instanceof Error ? err.message : 'Backup failed',
    }))

    onProgress?.({
      current: total,
      total,
      percentage: 100,
      currentItemName: '',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Batch backup failed',
      results: errorResult,
    })

    return errorResult
  }
}
