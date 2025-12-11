/**
 * Shared API fetch utility with retry and error handling
 * Consolidates the duplicate apiFetch functions across service files
 */

import { fetchWithRetry } from './retry'

const API_BASE = '/api'

/**
 * Generic fetch wrapper with error handling and automatic retry
 * @param endpoint API endpoint (without /api prefix)
 * @param options Fetch options
 * @returns Parsed JSON response
 */
export async function apiFetch<T>(
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

    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errorData.error ?? `Request failed: ${String(response.status)}`)
    }

    return response.json() as Promise<T>
}
