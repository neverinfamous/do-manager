const API_BASE = '/api'

/**
 * Import request options
 */
export interface ImportKeysRequest {
  /** Key-value data to import */
  data: Record<string, unknown>
  /** How to handle existing keys: 'merge' (default) or 'replace' */
  mergeMode?: 'merge' | 'replace'
}

/**
 * Import response from API
 */
export interface ImportKeysResponse {
  success: boolean
  imported: number
  mergeMode: 'merge' | 'replace'
}

/**
 * Parsed import file data
 */
export interface ParsedImportData {
  data: Record<string, unknown>
  keyCount: number
  keys: string[]
  /** Original file metadata if from export */
  exportedAt?: string
  /** Source instance info if from export */
  sourceInstance?: {
    id?: string
    name?: string
    objectId?: string
  }
}

/**
 * Import API functions
 */
export const importApi = {
  /**
   * Import keys into instance storage
   */
  async importKeys(
    instanceId: string,
    data: Record<string, unknown>,
    mergeMode: 'merge' | 'replace' = 'merge'
  ): Promise<ImportKeysResponse> {
    const response = await fetch(`${API_BASE}/instances/${instanceId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mergeMode }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(errorData.error ?? `Import failed: ${String(response.status)}`)
    }

    return response.json() as Promise<ImportKeysResponse>
  },

  /**
   * Parse and validate a JSON file for import
   * Accepts both raw data objects and export file format
   */
  parseImportFile(jsonContent: string): ParsedImportData {
    let parsed: unknown

    try {
      parsed = JSON.parse(jsonContent)
    } catch {
      throw new Error('Invalid JSON format')
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('JSON must be an object')
    }

    const obj = parsed as Record<string, unknown>

    // Check if it's an export file format (has 'data' property)
    if ('data' in obj && obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>
      const keys = Object.keys(data)

      if (keys.length === 0) {
        throw new Error('No keys found in data object')
      }

      return {
        data,
        keyCount: keys.length,
        keys,
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
        sourceInstance: obj.instance && typeof obj.instance === 'object'
          ? obj.instance as ParsedImportData['sourceInstance']
          : undefined,
      }
    }

    // Treat the entire object as key-value data
    const keys = Object.keys(obj)

    if (keys.length === 0) {
      throw new Error('No keys found in JSON object')
    }

    return {
      data: obj,
      keyCount: keys.length,
      keys,
    }
  },

  /**
   * Read a File object and parse it as import data
   */
  async readAndParseFile(file: File): Promise<ParsedImportData> {
    if (!file.name.endsWith('.json')) {
      throw new Error('File must be a .json file')
    }

    const content = await file.text()
    return this.parseImportFile(content)
  },
}

