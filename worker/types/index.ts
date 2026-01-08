/**
 * Worker environment bindings
 */
export interface Env {
  // D1 database for metadata
  METADATA: D1Database

  // R2 bucket for backups
  BACKUP_BUCKET: R2Bucket

  // Static assets
  ASSETS: Fetcher

  // Secrets
  ACCOUNT_ID: string
  API_KEY: string
  TEAM_DOMAIN: string
  POLICY_AUD: string

  // Optional vars
  ENVIRONMENT?: string
}

/**
 * Namespace color options for visual organization
 * Organized in rows by hue family for intuitive selection
 */
export type NamespaceColor =
  | 'red' | 'red-light' | 'red-dark'
  | 'orange' | 'orange-light' | 'amber'
  | 'yellow' | 'yellow-light' | 'lime'
  | 'green' | 'green-light' | 'emerald'
  | 'teal' | 'cyan' | 'sky'
  | 'blue' | 'blue-light' | 'indigo'
  | 'purple' | 'violet' | 'fuchsia'
  | 'pink' | 'rose' | 'pink-light'
  | 'gray' | 'slate' | 'zinc'
  | null

/**
 * Namespace record from D1
 */
export interface Namespace {
  id: string
  name: string
  script_name: string | null
  class_name: string
  storage_backend: 'sqlite' | 'kv'
  endpoint_url: string | null
  admin_hook_enabled: number
  color: NamespaceColor
  created_at: string
  updated_at: string
  metadata: string | null
}

/**
 * Instance color options for visual organization
 * Organized in rows by hue family for intuitive selection
 */
export type InstanceColor =
  | 'red' | 'red-light' | 'red-dark'
  | 'orange' | 'orange-light' | 'amber'
  | 'yellow' | 'yellow-light' | 'lime'
  | 'green' | 'green-light' | 'emerald'
  | 'teal' | 'cyan' | 'sky'
  | 'blue' | 'blue-light' | 'indigo'
  | 'purple' | 'violet' | 'fuchsia'
  | 'pink' | 'rose' | 'pink-light'
  | 'gray' | 'slate' | 'zinc'
  | null

/**
 * Instance record from D1
 */
export interface Instance {
  id: string
  namespace_id: string
  name: string | null
  object_id: string
  last_accessed: string | null
  storage_size_bytes: number | null
  has_alarm: number
  color: InstanceColor
  created_at: string
  updated_at: string
  metadata: string | null
  tags: string[]
}

/**
 * Job record from D1
 */
export interface Job {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  namespace_id: string | null
  instance_id: string | null
  user_email: string | null
  progress: number
  result: string | null
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

/**
 * Audit log record from D1
 */
export interface AuditLog {
  id: string
  action: string
  user_email: string | null
  namespace_id: string | null
  instance_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

/**
 * Backup record from D1
 */
export interface Backup {
  id: string
  instance_id: string
  namespace_id: string
  r2_key: string
  size_bytes: number | null
  storage_type: string
  created_by: string | null
  created_at: string
  metadata: string | null
}

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
 * Webhook record from D1
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
 * Webhook payload sent to endpoints
 */
export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  data: Record<string, unknown>
}

/**
 * Saved SQL query record from D1
 */
export interface SavedQuery {
  id: string
  namespace_id: string
  name: string
  description: string | null
  query: string
  created_at: string
  updated_at: string
}

/**
 * Cloudflare API response wrapper
 */
export interface CloudflareApiResponse<T> {
  success: boolean
  errors: { code: number; message: string }[]
  messages: string[]
  result: T
  result_info?: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }
}

/**
 * Worker script from Cloudflare API
 */
export interface WorkerScript {
  id: string
  tag: string
  created_on: string
  modified_on: string
  usage_model: string
  handlers: string[]
  last_deployed_from?: string
}

/**
 * Durable Object namespace from Cloudflare API
 */
export interface DurableObjectNamespaceInfo {
  id: string
  name: string
  script: string
  class: string
}

/**
 * CORS headers type
 */
export type CorsHeaders = Record<string, string>

/**
 * Error context for structured logging
 */
export interface ErrorContext {
  module: string
  operation: string
  namespaceId?: string
  instanceId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * Structured error for consistent logging
 */
export interface StructuredError {
  timestamp: string
  level: ErrorSeverity
  code: string
  message: string
  context: ErrorContext
  stack?: string
}

// Migration Types (for API responses)
export interface MigrationStatusResponse {
  currentVersion: number
  latestVersion: number
  pendingMigrations: { version: number; name: string; description: string }[]
  appliedMigrations: { version: number; migration_name: string; applied_at: string }[]
  isUpToDate: boolean
  legacy?: LegacyInstallationInfoResponse
}

export interface LegacyInstallationInfoResponse {
  isLegacy: boolean
  existingTables: string[]
  suggestedVersion: number
}

export interface MigrationResultResponse {
  success: boolean
  migrationsApplied: number
  currentVersion: number
  errors: string[]
}

// ============================================================================
// METRICS TYPES
// ============================================================================

/**
 * Time range options for metrics queries
 */
export type DOMetricsTimeRange = '24h' | '7d' | '30d'

/**
 * GraphQL Analytics API response wrapper
 */
export interface GraphQLAnalyticsResponse<T> {
  data?: T
  errors?: { message: string; path?: string[] }[]
}

/**
 * Root GraphQL analytics result
 */
export interface DOAnalyticsResult {
  viewer: {
    accounts: DOAccountMetrics[]
  }
}

/**
 * Account-level metrics from all 4 DO datasets
 */
export interface DOAccountMetrics {
  durableObjectsInvocationsAdaptiveGroups?: DOInvocationGroup[]
  durableObjectsPeriodicGroups?: DOPeriodicGroup[]
  durableObjectsStorageGroups?: DOStorageGroup[]
  durableObjectsSubrequestsAdaptiveGroups?: DOSubrequestGroup[]
}

/**
 * Invocation metrics from durableObjectsInvocationsAdaptiveGroups
 */
export interface DOInvocationGroup {
  sum: {
    requests: number
    responseBodySize: number
    errors: number
    wallTime: number
  }
  quantiles?: {
    wallTimeP50?: number
    wallTimeP90?: number
    wallTimeP99?: number
  }
  dimensions: {
    date: string
    scriptName?: string
  }
}

/**
 * Periodic metrics from durableObjectsPeriodicGroups (CPU time, WebSocket messages)
 */
export interface DOPeriodicGroup {
  sum: {
    cpuTime: number
    activeTime?: number
    subrequests?: number
  }
  dimensions: {
    date: string
    scriptName?: string
  }
}

/**
 * Storage metrics from durableObjectsStorageGroups
 */
export interface DOStorageGroup {
  max: {
    storedBytes: number
    storedKeys?: number
  }
  dimensions: {
    date: string
    scriptName?: string
  }
}

/**
 * Subrequest metrics from durableObjectsSubrequestsAdaptiveGroups
 */
export interface DOSubrequestGroup {
  sum: {
    requests: number
    responseBodySize: number
  }
  dimensions: {
    date: string
    scriptName?: string
  }
}

/**
 * Processed metrics response returned to frontend
 */
export interface DOMetricsResponse {
  summary: DOMetricsSummary
  byNamespace: DONamespaceMetrics[]
  invocationsSeries: DOInvocationDataPoint[]
  storageSeries: DOStorageDataPoint[]
  subrequestsSeries: DOSubrequestDataPoint[]
}

/**
 * Overall metrics summary
 */
export interface DOMetricsSummary {
  timeRange: DOMetricsTimeRange
  startDate: string
  endDate: string
  totalRequests: number
  totalErrors: number
  totalCpuTimeMs: number
  totalStorageBytes: number
  totalStorageKeys?: number | undefined
  totalSubrequests: number
  avgLatencyMs?: {
    p50: number
    p90: number
    p99: number
  } | undefined
  namespaceCount: number
}

/**
 * Per-namespace metrics breakdown
 */
export interface DONamespaceMetrics {
  scriptName: string
  namespaceName?: string
  totalRequests: number
  totalErrors: number
  totalCpuTimeMs: number
  currentStorageBytes: number
  currentStorageKeys?: number | undefined
  p50LatencyMs?: number | undefined
  p90LatencyMs?: number | undefined
  p99LatencyMs?: number | undefined
}

/**
 * Time series data point for invocations
 */
export interface DOInvocationDataPoint {
  date: string
  scriptName?: string | undefined
  requests: number
  errors: number
  responseBodySize: number
  wallTimeP50?: number | undefined
  wallTimeP90?: number | undefined
  wallTimeP99?: number | undefined
}

/**
 * Time series data point for storage
 */
export interface DOStorageDataPoint {
  date: string
  scriptName?: string | undefined
  storedBytes: number
  storedKeys?: number | undefined
}

/**
 * Time series data point for subrequests
 */
export interface DOSubrequestDataPoint {
  date: string
  scriptName?: string | undefined
  requests: number
  responseBodySize: number
}
