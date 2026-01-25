import { STORAGE_QUOTA } from "../services/healthApi";

/**
 * Get storage quota status based on bytes used
 */
export function getStorageQuotaStatus(storageSizeBytes: number): {
  level: "normal" | "warning" | "critical";
  percentUsed: number;
} {
  const percentUsed = (storageSizeBytes / STORAGE_QUOTA.MAX_BYTES) * 100;

  if (percentUsed >= STORAGE_QUOTA.CRITICAL_THRESHOLD * 100) {
    return { level: "critical", percentUsed };
  }
  if (percentUsed >= STORAGE_QUOTA.WARNING_THRESHOLD * 100) {
    return { level: "warning", percentUsed };
  }
  return { level: "normal", percentUsed };
}

/**
 * Format bytes to human readable string
 */
export function formatStorageSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${String(bytes)} B`;
}
