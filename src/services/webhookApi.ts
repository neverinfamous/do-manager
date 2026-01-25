import type {
  Webhook,
  WebhookInput,
  WebhooksResponse,
  WebhookResponse,
  WebhookTestResult,
} from "../types/webhook";
import { apiFetch } from "../lib/apiFetch";
import {
  getCached,
  setCache,
  invalidateCache,
  CACHE_KEYS,
  CACHE_TTL,
} from "../lib/cache";

/**
 * Webhook API functions with caching support
 */
export const webhookApi = {
  /**
   * List all webhooks
   * @param skipCache Set true to bypass cache
   */
  async list(skipCache = false): Promise<Webhook[]> {
    const cacheKey = CACHE_KEYS.WEBHOOKS;

    if (!skipCache) {
      const cached = getCached(cacheKey, CACHE_TTL.DEFAULT) as
        | Webhook[]
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const data = await apiFetch<WebhooksResponse>("/webhooks");
    setCache(cacheKey, data.webhooks);
    return data.webhooks;
  },

  /**
   * Get a single webhook by ID
   */
  async get(id: string): Promise<Webhook> {
    const data = await apiFetch<WebhookResponse>(`/webhooks/${id}`);
    return data.webhook;
  },

  /**
   * Create a new webhook
   * Invalidates webhook cache
   */
  async create(input: WebhookInput): Promise<Webhook> {
    const data = await apiFetch<WebhookResponse>("/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    invalidateCache(CACHE_KEYS.WEBHOOKS);
    return data.webhook;
  },

  /**
   * Update an existing webhook
   * Invalidates webhook cache
   */
  async update(id: string, input: Partial<WebhookInput>): Promise<Webhook> {
    const data = await apiFetch<WebhookResponse>(`/webhooks/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    invalidateCache(CACHE_KEYS.WEBHOOKS);
    return data.webhook;
  },

  /**
   * Delete a webhook
   * Invalidates webhook cache
   */
  async delete(id: string): Promise<void> {
    await apiFetch(`/webhooks/${id}`, { method: "DELETE" });
    invalidateCache(CACHE_KEYS.WEBHOOKS);
  },

  /**
   * Test a webhook by sending a test payload
   */
  async test(id: string): Promise<WebhookTestResult> {
    return apiFetch<WebhookTestResult>(`/webhooks/${id}/test`, {
      method: "POST",
    });
  },
};
