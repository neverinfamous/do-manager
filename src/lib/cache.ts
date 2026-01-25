/**
 * Centralized caching utility for API responses
 * Pattern: Map<key, {data, timestamp}> with configurable TTL
 */

/** Cache entry with data and timestamp */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** TTL constants in milliseconds */
export const CACHE_TTL = {
  /** Default TTL for general data (5 minutes) */
  DEFAULT: 5 * 60 * 1000,
  /** Shorter TTL for metrics data (2 minutes) */
  METRICS: 2 * 60 * 1000,
  /** TTL for health data (2 minutes) */
  HEALTH: 2 * 60 * 1000,
} as const;

/** Cache key prefixes for organization */
export const CACHE_KEYS = {
  NAMESPACES: "namespaces",
  NAMESPACE: "namespace:",
  INSTANCES: "instances:",
  INSTANCE: "instance:",
  METRICS: "metrics",
  METRICS_NS: "metrics:ns:",
  HEALTH: "health",
  JOBS: "jobs",
  BACKUPS: "backups:",
  WEBHOOKS: "webhooks",
  SEARCH_KEYS: "search:keys:",
  SEARCH_VALUES: "search:values:",
  SEARCH_TAGS: "search:tags:",
} as const;

/** Internal cache storage */
const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data if it exists and hasn't expired
 * @param key Cache key
 * @param ttl Time-to-live in milliseconds (default: 5 minutes)
 * @returns Cached data or undefined if not found/expired
 */
export function getCached(
  key: string,
  ttl: number = CACHE_TTL.DEFAULT,
): unknown {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    // Entry expired, remove it
    cache.delete(key);
    return undefined;
  }

  return entry.data;
}

/**
 * Store data in cache with current timestamp
 * @param key Cache key
 * @param data Data to cache
 */
export function setCache(key: string, data: unknown): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate a specific cache entry
 * @param key Cache key to invalidate
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache entries with a given prefix
 * @param prefix Key prefix to match
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
