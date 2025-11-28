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
  created_at: string
  updated_at: string
  metadata: string | null
}

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
  created_at: string
  updated_at: string
  metadata: string | null
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
 * Cloudflare API response wrapper
 */
export interface CloudflareApiResponse<T> {
  success: boolean
  errors: Array<{ code: number; message: string }>
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

