/**
 * Retry utility with exponential backoff for rate limit protection
 * Handles 429 (Too Many Requests), 503 (Service Unavailable), 504 (Gateway Timeout)
 */

import { logger } from "./logger";

/** Status codes that trigger retry */
const RETRYABLE_STATUS_CODES = [429, 503, 504];

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 2000, // 2 seconds
  maxDelayMs: 8000, // 8 seconds
};

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 2000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 8000) */
  maxDelayMs?: number;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * Pattern: 2s → 4s → 8s
 */
function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
): number {
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Check if a response status code is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(status);
}

/**
 * Fetch with automatic retry on rate limit errors
 * @param input Fetch input (URL or Request)
 * @param init Fetch init options
 * @param config Retry configuration
 * @returns Fetch response
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  config?: RetryConfig,
): Promise<Response> {
  const { maxRetries, initialDelayMs, maxDelayMs } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (!isRetryableStatus(response.status)) {
        return response;
      }

      lastResponse = response;

      // Don't retry after last attempt
      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, initialDelayMs, maxDelayMs);
        logger.warn(
          `[RETRY] ${response.status} response, attempt ${String(attempt + 1)}/${String(maxRetries)}, ` +
            `waiting ${String(delay)}ms before retry`,
        );
        await sleep(delay);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry network errors after last attempt
      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, initialDelayMs, maxDelayMs);
        logger.warn(
          `[RETRY] Network error, attempt ${String(attempt + 1)}/${String(maxRetries)}, ` +
            `waiting ${String(delay)}ms before retry: ${lastError.message}`,
        );
        await sleep(delay);
      }
    }
  }

  // Return last response if we have one
  if (lastResponse) {
    logger.error(
      `[RETRY_EXHAUSTED] Failed after ${String(maxRetries)} retries, returning last response`,
    );
    return lastResponse;
  }

  // Otherwise throw last error
  logger.error(`[RETRY_EXHAUSTED] Failed after ${String(maxRetries)} retries`);
  throw lastError ?? new Error("Fetch failed after retries");
}
