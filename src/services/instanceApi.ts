import type { Instance, InstanceColor } from "../types";
import type {
  InstancesResponse,
  InstanceResponse,
  CreateInstanceRequest,
  CloneInstanceResponse,
} from "../types/instance";
import { apiFetch } from "../lib/apiFetch";
import {
  getCached,
  setCache,
  invalidateCache,
  invalidatePrefix,
  CACHE_KEYS,
  CACHE_TTL,
} from "../lib/cache";

/**
 * Instance API functions with caching support
 */
export const instanceApi = {
  /**
   * List instances for a namespace
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async list(
    namespaceId: string,
    options?: { limit?: number; offset?: number },
    skipCache = false,
  ): Promise<{ instances: Instance[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));

    const query = params.toString();
    const endpoint = `/namespaces/${namespaceId}/instances${query ? `?${query}` : ""}`;
    const cacheKey = `${CACHE_KEYS.INSTANCES}${namespaceId}:${query}`;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | { instances: Instance[]; total: number }
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<InstancesResponse>(endpoint);
    const result = { instances: data.instances, total: data.total };
    setCache(cacheKey, result);
    return result;
  },

  /**
   * Get a single instance
   * @param skipCache Set true to bypass cache
   */
  async get(instanceId: string, skipCache = false): Promise<Instance> {
    const cacheKey = `${CACHE_KEYS.INSTANCE}${instanceId}`;

    if (!skipCache) {
      const cached = getCached(cacheKey) as Instance | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<InstanceResponse>(`/instances/${instanceId}`);
    setCache(cacheKey, data.instance);
    return data.instance;
  },

  /**
   * Create or ping an instance
   * Invalidates instance cache
   */
  async create(
    namespaceId: string,
    data: CreateInstanceRequest,
  ): Promise<{ instance: Instance; created: boolean }> {
    const result = await apiFetch<InstanceResponse>(
      `/namespaces/${namespaceId}/instances`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    // Invalidate instances list cache for this namespace
    invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    return { instance: result.instance, created: result.created ?? true };
  },

  /**
   * Delete an instance tracking record
   * Invalidates instance caches
   */
  async delete(instanceId: string, namespaceId?: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}`, { method: "DELETE" });
    // Invalidate individual instance cache
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`);
    // Invalidate instances list cache if namespace known
    if (namespaceId) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    }
  },

  /**
   * Update instance last accessed time
   */
  async markAccessed(instanceId: string): Promise<void> {
    await apiFetch(`/instances/${instanceId}/accessed`, { method: "PUT" });
    // Invalidate individual instance cache
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`);
  },

  /**
   * Clone an instance to a new name
   * Invalidates instance caches
   */
  async clone(
    instanceId: string,
    newName: string,
    namespaceId?: string,
  ): Promise<CloneInstanceResponse> {
    const result = await apiFetch<CloneInstanceResponse>(
      `/instances/${instanceId}/clone`,
      {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      },
    );
    // Invalidate instances list cache
    if (namespaceId) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    }
    return result;
  },

  /**
   * Update instance color for visual organization
   * Invalidates instance cache
   */
  async updateColor(
    instanceId: string,
    color: InstanceColor,
    namespaceId?: string,
  ): Promise<Instance> {
    const result = await apiFetch<{ instance: Instance; success: boolean }>(
      `/instances/${instanceId}/color`,
      {
        method: "PUT",
        body: JSON.stringify({ color }),
      },
    );
    // Invalidate caches
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`);
    if (namespaceId) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    }
    return result.instance;
  },

  /**
   * Rename an instance
   * Invalidates instance caches
   */
  async rename(
    instanceId: string,
    name: string,
    namespaceId?: string,
  ): Promise<Instance> {
    const result = await apiFetch<{ instance: Instance; success: boolean }>(
      `/instances/${instanceId}/rename`,
      {
        method: "PUT",
        body: JSON.stringify({ name }),
      },
    );
    // Invalidate caches
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`);
    if (namespaceId) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    }
    return result.instance;
  },

  /**
   * Update instance tags for organization and search
   * Invalidates instance caches
   */
  async updateTags(
    instanceId: string,
    tags: string[],
    namespaceId?: string,
  ): Promise<Instance> {
    const result = await apiFetch<{ instance: Instance; success: boolean }>(
      `/instances/${instanceId}/tags`,
      {
        method: "PUT",
        body: JSON.stringify({ tags }),
      },
    );
    // Invalidate caches
    invalidateCache(`${CACHE_KEYS.INSTANCE}${instanceId}`);
    if (namespaceId) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${namespaceId}`);
    }
    return result.instance;
  },
};
