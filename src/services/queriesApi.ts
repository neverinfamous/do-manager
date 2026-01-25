import type { SavedQuery } from "../types";
import { apiFetch } from "../lib/apiFetch";

/**
 * Create saved query request
 */
export interface CreateQueryRequest {
  name: string;
  description?: string;
  query: string;
}

/**
 * Update saved query request
 */
export interface UpdateQueryRequest {
  name?: string;
  description?: string;
  query?: string;
}

/**
 * Saved queries API functions
 */
export const queriesApi = {
  /**
   * List saved queries for a namespace
   */
  async list(namespaceId: string): Promise<SavedQuery[]> {
    const data = await apiFetch<{ queries: SavedQuery[] }>(
      `/namespaces/${namespaceId}/queries`,
    );
    return data.queries;
  },

  /**
   * Create a new saved query
   */
  async create(
    namespaceId: string,
    data: CreateQueryRequest,
  ): Promise<SavedQuery> {
    const result = await apiFetch<{ query: SavedQuery }>(
      `/namespaces/${namespaceId}/queries`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return result.query;
  },

  /**
   * Update a saved query
   */
  async update(queryId: string, data: UpdateQueryRequest): Promise<SavedQuery> {
    const result = await apiFetch<{ query: SavedQuery }>(
      `/queries/${queryId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return result.query;
  },

  /**
   * Delete a saved query
   */
  async delete(queryId: string): Promise<void> {
    await apiFetch(`/queries/${queryId}`, { method: "DELETE" });
  },
};
