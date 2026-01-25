import type {
  SearchResponse,
  KeySearchOptions,
  ValueSearchOptions,
  TagSearchOptions,
} from "../types/search";
import { apiFetch } from "../lib/apiFetch";
import { getCached, setCache, CACHE_KEYS, CACHE_TTL } from "../lib/cache";

/**
 * Generate a cache key for search results
 */
function buildSearchCacheKey(
  prefix: string,
  query: string,
  namespaceIds?: string[],
  limit?: number,
): string {
  const parts = [
    prefix,
    query.toLowerCase(),
    namespaceIds?.sort().join(",") ?? "all",
    String(limit ?? 100),
  ];
  return parts.join(":");
}

/**
 * Search API functions
 * Supports caching with 5-minute TTL; bypass with skipCache param
 */
export const searchApi = {
  /**
   * Search for keys across all namespaces/instances
   * @param query Search query string
   * @param options Search options including skipCache to bypass cache
   */
  async searchKeys(
    query: string,
    options: KeySearchOptions & { skipCache?: boolean } = {},
  ): Promise<SearchResponse> {
    const cacheKey = buildSearchCacheKey(
      CACHE_KEYS.SEARCH_KEYS,
      query,
      options.namespaceIds,
      options.limit,
    );

    // Check cache unless skipCache is true
    if (!options.skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | SearchResponse
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const response = await apiFetch<SearchResponse>("/search/keys", {
      method: "POST",
      body: JSON.stringify({
        query,
        namespaceIds: options.namespaceIds,
        limit: options.limit,
      }),
    });

    // Cache the result
    setCache(cacheKey, response);
    return response;
  },

  /**
   * Search within storage values across namespaces/instances
   * @param query Search query string
   * @param options Search options including skipCache to bypass cache
   */
  async searchValues(
    query: string,
    options: ValueSearchOptions & { skipCache?: boolean } = {},
  ): Promise<SearchResponse> {
    const cacheKey = buildSearchCacheKey(
      CACHE_KEYS.SEARCH_VALUES,
      query,
      options.namespaceIds,
      options.limit,
    );

    // Check cache unless skipCache is true
    if (!options.skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | SearchResponse
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const response = await apiFetch<SearchResponse>("/search/values", {
      method: "POST",
      body: JSON.stringify({
        query,
        namespaceIds: options.namespaceIds,
        instanceIds: options.instanceIds,
        limit: options.limit,
      }),
    });

    // Cache the result
    setCache(cacheKey, response);
    return response;
  },

  /**
   * Search for instances by tag (searches D1 metadata, no admin hooks required)
   * @param query Search query string
   * @param options Search options including skipCache to bypass cache
   */
  async searchTags(
    query: string,
    options: TagSearchOptions & { skipCache?: boolean } = {},
  ): Promise<SearchResponse> {
    const cacheKey = buildSearchCacheKey(
      CACHE_KEYS.SEARCH_TAGS,
      query,
      options.namespaceIds,
      options.limit,
    );

    // Check cache unless skipCache is true
    if (!options.skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | SearchResponse
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const response = await apiFetch<SearchResponse>("/search/tags", {
      method: "POST",
      body: JSON.stringify({
        query,
        namespaceIds: options.namespaceIds,
        limit: options.limit,
      }),
    });

    // Cache the result
    setCache(cacheKey, response);
    return response;
  },
};
