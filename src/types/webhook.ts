/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'backup_complete'
  | 'restore_complete'
  | 'alarm_set'
  | 'alarm_deleted'
  | 'job_failed'
  | 'batch_complete'
  | 'storage_create'
  | 'storage_update'
  | 'storage_delete'
  | 'instance_create'
  | 'instance_delete'
  | 'import_complete'
  | 'export_complete'

/**
 * Webhook from API
 */
export interface Webhook {
  id: string
  name: string
  url: string
  secret: string | null
  events: string // JSON array of WebhookEventType
  enabled: number
  created_at: string
  updated_at: string
}

/**
 * Webhook create/update request
 */
export interface WebhookInput {
  name: string
  url: string
  secret?: string | null
  events: WebhookEventType[]
  enabled?: boolean
}

/**
 * Webhook test result
 */
export interface WebhookTestResult {
  success: boolean
  message: string
  statusCode?: number
  error?: string
}

/**
 * API response types
 */
export interface WebhooksResponse {
  webhooks: Webhook[]
}

export interface WebhookResponse {
  webhook: Webhook
}

/**
 * Event type labels for UI display
 */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  backup_complete: 'Backup Complete',
  restore_complete: 'Restore Complete',
  alarm_set: 'Alarm Set',
  alarm_deleted: 'Alarm Deleted',
  job_failed: 'Job Failed',
  batch_complete: 'Batch Operation Complete',
  storage_create: 'Storage Key Created',
  storage_update: 'Storage Key Updated',
  storage_delete: 'Storage Key Deleted',
  instance_create: 'Instance Created',
  instance_delete: 'Instance Deleted',
  import_complete: 'Import Complete',
  export_complete: 'Export Complete',
}

/**
 * All available webhook event types
 */
export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  'storage_create',
  'storage_update',
  'storage_delete',
  'instance_create',
  'instance_delete',
  'import_complete',
  'export_complete',
  'backup_complete',
  'restore_complete',
  'alarm_set',
  'alarm_deleted',
  'job_failed',
  'batch_complete',
]

