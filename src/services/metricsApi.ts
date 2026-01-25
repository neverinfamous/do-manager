import { apiFetch } from "../lib/apiFetch";
import { getCached, setCache, CACHE_KEYS, CACHE_TTL } from "../lib/cache";

export interface MetricsData {
  invocations: {
    total: number;
    success: number;
    errors: number;
    byDay: { date: string; requests: number }[];
  };
  storage: {
    totalBytes: number;
    maxBytes: number;
  };
  duration: {
    p50: number;
    p95: number;
    p99: number;
    totalMs?: number;
  };
  warning?: string;
}

/**
 * Metrics API functions with caching support
 */
export const metricsApi = {
  /**
   * Get account-level metrics
   * Uses 2-minute TTL for metrics data
   * @param days Number of days to fetch (default: 7)
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async getAccountMetrics(days = 7, skipCache = false): Promise<MetricsData> {
    const cacheKey = `${CACHE_KEYS.METRICS}:${String(days)}`;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.METRICS) as
        | MetricsData
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<MetricsData>(`/metrics?days=${String(days)}`);
    setCache(cacheKey, data);
    return data;
  },

  /**
   * Get namespace-level metrics
   * Uses 2-minute TTL for metrics data
   * @param namespaceId Namespace ID
   * @param days Number of days to fetch (default: 7)
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async getNamespaceMetrics(
    namespaceId: string,
    days = 7,
    skipCache = false,
  ): Promise<MetricsData> {
    const cacheKey = `${CACHE_KEYS.METRICS_NS}${namespaceId}:${String(days)}`;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.METRICS) as
        | MetricsData
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<MetricsData>(
      `/namespaces/${namespaceId}/metrics?days=${String(days)}`,
    );
    setCache(cacheKey, data);
    return data;
  },
};
