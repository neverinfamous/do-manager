import type {
  Namespace,
  NamespaceColor,
  Job,
  NamespacesResponse,
  NamespaceResponse,
  CloneNamespaceResponse,
  DiscoverResponse,
  JobsResponse,
} from "../types";
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
 * Namespace API functions with caching support
 */
export const namespaceApi = {
  /**
   * List all tracked namespaces
   * @param skipCache Set true to bypass cache (e.g., on refresh)
   */
  async list(skipCache = false): Promise<Namespace[]> {
    const cacheKey = CACHE_KEYS.NAMESPACES;

    if (!skipCache) {
      const cached = getCached(cacheKey) as Namespace[] | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<NamespacesResponse>("/namespaces");
    setCache(cacheKey, data.namespaces);
    return data.namespaces;
  },

  /**
   * Discover namespaces from Cloudflare API
   * Always bypasses cache since this is an explicit refresh action
   */
  async discover(): Promise<Namespace[]> {
    const data = await apiFetch<DiscoverResponse>("/namespaces/discover");
    return data.discovered;
  },

  /**
   * Get a single namespace by ID
   * @param skipCache Set true to bypass cache
   */
  async get(id: string, skipCache = false): Promise<Namespace> {
    const cacheKey = `${CACHE_KEYS.NAMESPACE}${id}`;

    if (!skipCache) {
      const cached = getCached(cacheKey) as Namespace | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<NamespaceResponse>(`/namespaces/${id}`);
    setCache(cacheKey, data.namespace);
    return data.namespace;
  },

  /**
   * Add a namespace manually
   * Invalidates namespace cache
   */
  async add(namespace: {
    name: string;
    class_name: string;
    script_name?: string;
    storage_backend?: "sqlite" | "kv";
    endpoint_url?: string;
  }): Promise<Namespace> {
    const data = await apiFetch<NamespaceResponse>("/namespaces", {
      method: "POST",
      body: JSON.stringify(namespace),
    });
    // Invalidate list cache so next list() fetches fresh data
    invalidateCache(CACHE_KEYS.NAMESPACES);
    return data.namespace;
  },

  /**
   * Update a namespace
   * Invalidates namespace caches
   */
  async update(
    id: string,
    updates: {
      name?: string;
      endpoint_url?: string | null;
      admin_hook_enabled?: number;
      storage_backend?: "sqlite" | "kv";
    },
  ): Promise<Namespace> {
    const data = await apiFetch<NamespaceResponse>(`/namespaces/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    // Invalidate both list and individual namespace cache
    invalidateCache(CACHE_KEYS.NAMESPACES);
    invalidateCache(`${CACHE_KEYS.NAMESPACE}${id}`);
    return data.namespace;
  },

  /**
   * Delete a namespace
   * Invalidates namespace and related caches
   */
  async delete(id: string): Promise<void> {
    await apiFetch(`/namespaces/${id}`, { method: "DELETE" });
    // Invalidate namespace caches and related instance caches
    invalidateCache(CACHE_KEYS.NAMESPACES);
    invalidateCache(`${CACHE_KEYS.NAMESPACE}${id}`);
    invalidatePrefix(`${CACHE_KEYS.INSTANCES}${id}`);
  },

  /**
   * Clone a namespace with a new name
   * Invalidates namespace cache
   * @param deepClone If true, also clone all instances and their storage (requires admin hooks)
   */
  async clone(
    id: string,
    newName: string,
    deepClone?: boolean,
  ): Promise<CloneNamespaceResponse> {
    const result = await apiFetch<CloneNamespaceResponse>(
      `/namespaces/${id}/clone`,
      {
        method: "POST",
        body: JSON.stringify({ name: newName, deepClone }),
      },
    );
    // Invalidate list cache
    invalidateCache(CACHE_KEYS.NAMESPACES);
    // If deep clone, also invalidate instance caches for new namespace
    if (deepClone && result.namespace?.id) {
      invalidatePrefix(`${CACHE_KEYS.INSTANCES}${result.namespace.id}`);
    }
    return result;
  },

  /**
   * Update namespace color for visual organization
   * Invalidates namespace caches
   */
  async updateColor(id: string, color: NamespaceColor): Promise<Namespace> {
    const result = await apiFetch<{ namespace: Namespace; success: boolean }>(
      `/namespaces/${id}/color`,
      {
        method: "PUT",
        body: JSON.stringify({ color }),
      },
    );
    // Invalidate both list and individual namespace cache
    invalidateCache(CACHE_KEYS.NAMESPACES);
    invalidateCache(`${CACHE_KEYS.NAMESPACE}${id}`);
    return result.namespace;
  },
};

/**
 * Job API functions with caching support
 */
export const jobApi = {
  /**
   * List jobs with optional filters
   * @param options Filter options
   * @param skipCache Set true to bypass cache
   */
  async list(
    options?: {
      status?: string;
      namespace_id?: string;
      limit?: number;
    },
    skipCache = false,
  ): Promise<Job[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.namespace_id) params.set("namespace_id", options.namespace_id);
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    const endpoint = query ? `/jobs?${query}` : "/jobs";
    const cacheKey = `${CACHE_KEYS.JOBS}:${query}`;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | Job[]
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<JobsResponse>(endpoint);
    setCache(cacheKey, data.jobs);
    return data.jobs;
  },

  /**
   * Get a single job by ID
   */
  async get(id: string): Promise<Job> {
    const data = await apiFetch<{ job: Job }>(`/jobs/${id}`);
    return data.job;
  },
};

/**
 * Auth API functions
 */
export const authApi = {
  /**
   * Logout - redirect to Cloudflare Access logout
   */
  logout(): void {
    // In production, this would redirect to the Access logout URL
    // For now, just reload the page
    window.location.href = "/";
  },
};
