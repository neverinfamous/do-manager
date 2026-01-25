import type { Webhook, WebhookEventType, WebhookPayload, Env } from "../types";
import { nowISO } from "./helpers";

// Note: This file uses formatted console output instead of error-logger
// due to circular dependency (error-logger imports triggerWebhooks from this file).
// Formatted to match structured log format: [LEVEL] [module] [CODE] message

/**
 * Result of sending a webhook
 */
export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Send a webhook to a configured endpoint
 */
export async function sendWebhook(
  webhook: Webhook,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<WebhookResult> {
  const payload: WebhookPayload = {
    event,
    timestamp: nowISO(),
    data,
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "DO-Manager-Webhook/1.0",
    "X-Webhook-Event": event,
  };

  // Add HMAC signature if secret is configured
  if (webhook.secret) {
    const signature = await generateSignature(body, webhook.secret);
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        statusCode: response.status,
        error: errorText.slice(0, 200),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all enabled webhooks for a specific event type
 */
export async function getWebhooksForEvent(
  db: D1Database,
  event: WebhookEventType,
): Promise<Webhook[]> {
  try {
    const result = await db
      .prepare("SELECT * FROM webhooks WHERE enabled = 1")
      .all<Webhook>();

    // Filter webhooks that are subscribed to this event
    return result.results.filter((webhook) => {
      try {
        const events = JSON.parse(webhook.events) as string[];
        return events.includes(event);
      } catch {
        return false;
      }
    });
  } catch (error) {
    // Log locally - can't use logError here due to circular dependency
    console.error(
      "[ERROR] [webhooks] [WEBHOOK_GET_FAILED]",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * Trigger webhooks for a specific event
 * This is a fire-and-forget operation - errors are logged but not propagated
 */
export async function triggerWebhooks(
  env: Env,
  event: WebhookEventType,
  data: Record<string, unknown>,
  isLocalDev: boolean,
): Promise<void> {
  if (isLocalDev) {
    // Log locally - can't use logInfo here due to circular dependency
    console.log(
      "[INFO] [webhooks] [WEBHOOK_MOCK_TRIGGER]",
      event,
      JSON.stringify(data),
    );
    return;
  }

  try {
    const webhooks = await getWebhooksForEvent(env.METADATA, event);

    if (webhooks.length === 0) {
      return;
    }

    // Log locally - can't use logInfo here due to circular dependency
    console.log(
      `[INFO] [webhooks] [WEBHOOK_TRIGGERING] Triggering ${String(webhooks.length)} webhook(s) for event: ${event}`,
    );

    // Send webhooks in parallel, don't await completion
    const promises = webhooks.map(async (webhook) => {
      try {
        const result = await sendWebhook(webhook, event, data);
        if (!result.success) {
          // Log locally - can't use logError here due to circular dependency
          console.error(
            `[ERROR] [webhooks] [WEBHOOK_SEND_FAILED] ${webhook.name}: ${result.error ?? "unknown"}`,
          );
        }
      } catch (error) {
        // Log locally - can't use logError here due to circular dependency
        console.error(
          `[ERROR] [webhooks] [WEBHOOK_SEND_ERROR] ${webhook.name}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    // Use waitUntil if available (in Cloudflare Workers context)
    // For now, we'll just fire and forget
    void Promise.all(promises);
  } catch (error) {
    // Log locally - can't use logError here due to circular dependency
    console.error(
      "[ERROR] [webhooks] [WEBHOOK_TRIGGER_ERROR]",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Helper to create standard webhook data for backup events
 */
export function createBackupWebhookData(
  backupId: string,
  instanceId: string,
  instanceName: string,
  namespaceId: string,
  namespaceName: string,
  sizeBytes: number,
  userEmail: string | null,
): Record<string, unknown> {
  return {
    backup_id: backupId,
    instance_id: instanceId,
    instance_name: instanceName,
    namespace_id: namespaceId,
    namespace_name: namespaceName,
    size_bytes: sizeBytes,
    user_email: userEmail,
  };
}

/**
 * Helper to create standard webhook data for alarm events
 */
export function createAlarmWebhookData(
  instanceId: string,
  instanceName: string,
  namespaceId: string,
  namespaceName: string,
  alarmTime: string | null,
  userEmail: string | null,
): Record<string, unknown> {
  return {
    instance_id: instanceId,
    instance_name: instanceName,
    namespace_id: namespaceId,
    namespace_name: namespaceName,
    alarm_time: alarmTime,
    user_email: userEmail,
  };
}

/**
 * Helper to create standard webhook data for job failure events
 */
export function createJobFailedWebhookData(
  jobId: string,
  jobType: string,
  error: string,
  namespaceId: string | null,
  instanceId: string | null,
  userEmail: string | null,
): Record<string, unknown> {
  return {
    job_id: jobId,
    job_type: jobType,
    error,
    namespace_id: namespaceId,
    instance_id: instanceId,
    user_email: userEmail,
  };
}

/**
 * Helper to create standard webhook data for batch complete events
 */
export function createBatchCompleteWebhookData(
  jobType: string,
  total: number,
  success: number,
  failed: number,
  userEmail: string | null,
): Record<string, unknown> {
  return {
    job_type: jobType,
    total,
    success,
    failed,
    user_email: userEmail,
  };
}
