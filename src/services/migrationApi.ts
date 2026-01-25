/**
 * Migration API Service
 *
 * Frontend API functions for database migration operations.
 */

import { apiFetch } from "../lib/apiFetch";
import type {
  MigrationStatus,
  MigrationResult,
  MigrationStatusResponse,
  MigrationResultResponse,
} from "../types";

/**
 * Migration API functions
 */
export const migrationApi = {
  /**
   * Get current migration status
   * Always bypasses cache since migration status should be fresh
   */
  async getStatus(): Promise<MigrationStatus> {
    const data = await apiFetch<MigrationStatusResponse>("/migrations/status");
    return data.result;
  },

  /**
   * Apply all pending migrations
   */
  async apply(): Promise<MigrationResult> {
    const data = await apiFetch<MigrationResultResponse>("/migrations/apply", {
      method: "POST",
    });
    return data.result;
  },

  /**
   * Mark migrations as applied for legacy installations
   * @param version The version up to which to mark as applied
   */
  async markLegacy(version: number): Promise<{ markedUpTo: number }> {
    const data = await apiFetch<{
      result: { markedUpTo: number };
      success: boolean;
    }>("/migrations/mark-legacy", {
      method: "POST",
      body: JSON.stringify({ version }),
    });
    return data.result;
  },
};
