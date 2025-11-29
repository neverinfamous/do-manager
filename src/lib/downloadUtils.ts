import { zipSync, strToU8 } from 'fflate'

/**
 * Browser download utility functions
 */

/**
 * Download data as a JSON file
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, filename)
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate a filename with timestamp
 */
export function generateTimestampedFilename(base: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${base}-${timestamp}.${extension}`
}

/**
 * File entry for ZIP creation
 */
export interface ZipFileEntry {
  /** Path within the ZIP (e.g., "instance-name.json") */
  path: string
  /** Content as string or object (will be JSON stringified) */
  content: unknown
}

/**
 * Create and download a ZIP file from multiple file entries
 * @param entries Array of file entries to include in the ZIP
 * @param zipFilename Name of the ZIP file
 * @param manifest Optional manifest data to include as manifest.json
 */
export function downloadZip(
  entries: ZipFileEntry[],
  zipFilename: string,
  manifest?: Record<string, unknown>
): void {
  // Build the files object for fflate
  const files: Record<string, Uint8Array> = {}

  // Add manifest if provided
  if (manifest) {
    const manifestJson = JSON.stringify(manifest, null, 2)
    files['manifest.json'] = strToU8(manifestJson)
  }

  // Add each entry
  for (const entry of entries) {
    const content = typeof entry.content === 'string'
      ? entry.content
      : JSON.stringify(entry.content, null, 2)
    files[entry.path] = strToU8(content)
  }

  // Create the ZIP synchronously
  const zipped = zipSync(files, {
    level: 6, // Compression level (0-9, 6 is default)
  })

  // Download the ZIP - create a new Uint8Array copy for Blob compatibility
  const zipData = new Uint8Array(zipped)
  const blob = new Blob([zipData], { type: 'application/zip' })
  downloadBlob(blob, zipFilename)
}

/**
 * Create a manifest for batch export
 */
export interface BatchExportManifest {
  exportedAt: string
  namespace: {
    id: string
    name: string
    className: string
    storageBackend: string
  }
  instances: Array<{
    id: string
    name: string | null
    objectId: string
    filename: string
  }>
  totalInstances: number
}

/**
 * Generate a batch export manifest
 */
export function generateBatchExportManifest(
  namespace: {
    id: string
    name: string
    class_name: string
    storage_backend: string
  },
  instances: Array<{
    id: string
    name: string | null
    object_id: string
    filename: string
  }>
): BatchExportManifest {
  return {
    exportedAt: new Date().toISOString(),
    namespace: {
      id: namespace.id,
      name: namespace.name,
      className: namespace.class_name,
      storageBackend: namespace.storage_backend,
    },
    instances: instances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      objectId: inst.object_id,
      filename: inst.filename,
    })),
    totalInstances: instances.length,
  }
}
