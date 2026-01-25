import { apiFetch } from "../lib/apiFetch";
import { getCached, setCache, CACHE_KEYS, CACHE_TTL } from "../lib/cache";

/**
 * Active alarm info in health summary
 */
export interface ActiveAlarmInfo {
  instanceId: string;
  instanceName: string;
  namespaceId: string;
  namespaceName: string;
  scheduledTime: string;
  createdAt: string;
}

/**
 * Completed alarm info in health summary
 */
export interface CompletedAlarmInfo {
  instanceId: string;
  instanceName: string;
  namespaceId: string;
  namespaceName: string;
  scheduledTime: string;
  completedAt: string;
  status: "completed" | "cancelled";
}

/**
 * Stale instance info in health summary
 */
export interface StaleInstance {
  id: string;
  name: string;
  namespaceId: string;
  namespaceName: string;
  lastAccessed: string | null;
  daysSinceAccess: number;
}

/**
 * High storage instance info in health summary
 */
export interface HighStorageInstance {
  id: string;
  name: string;
  namespaceId: string;
  namespaceName: string;
  storageSizeBytes: number;
  percentUsed: number;
  level: "warning" | "critical";
}

/**
 * Storage quota constants (10GB DO limit)
 */
export const STORAGE_QUOTA = {
  MAX_BYTES: 10 * 1024 * 1024 * 1024, // 10GB
  WARNING_THRESHOLD: 0.8, // 80%
  CRITICAL_THRESHOLD: 0.9, // 90%
};

/**
 * Health summary data
 */
export interface HealthSummary {
  namespaces: {
    total: number;
    withEndpoint: number;
  };
  instances: {
    total: number;
    withAlarms: number;
    stale: number;
    highStorage: number;
  };
  storage: {
    totalBytes: number;
    avgPerInstance: number;
  };
  activeAlarms: ActiveAlarmInfo[];
  completedAlarms: CompletedAlarmInfo[];
  staleInstances: StaleInstance[];
  highStorageInstances: HighStorageInstance[];
  recentJobs: {
    last24h: number;
    last7d: number;
    failedLast24h: number;
  };
}

/**
 * Health API functions with caching support
 */
export const healthApi = {
  /**
   * Get health summary
   * Uses 2-minute TTL for health data
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async getSummary(skipCache = false): Promise<HealthSummary> {
    const cacheKey = CACHE_KEYS.HEALTH;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.HEALTH) as
        | HealthSummary
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<HealthSummary>("/health");
    setCache(cacheKey, data);
    return data;
  },
};
