/**
 * Search result item returned from the API
 */
export interface SearchResult {
  namespaceId: string
  namespaceName: string
  instanceId: string
  instanceName: string
  key: string
  matchType: 'key' | 'value'
  valuePreview?: string
}

/**
 * Summary of search operation
 */
export interface SearchSummary {
  totalMatches: number
  namespacesSearched: number
  instancesSearched: number
  errors: number
}

/**
 * Full search response from API
 */
export interface SearchResponse {
  results: SearchResult[]
  summary: SearchSummary
}

/**
 * Options for key search
 */
export interface KeySearchOptions {
  namespaceIds?: string[]
  limit?: number
}

/**
 * Options for value search
 */
export interface ValueSearchOptions {
  namespaceIds?: string[]
  instanceIds?: string[]
  limit?: number
}

