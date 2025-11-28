/**
 * Namespace from API
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
 * Instance from API
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
 * Job from API
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
 * API response types
 */
export interface NamespacesResponse {
  namespaces: Namespace[]
}

export interface NamespaceResponse {
  namespace: Namespace
}

export interface DiscoverResponse {
  discovered: Namespace[]
}

export interface JobsResponse {
  jobs: Job[]
}

export interface JobResponse {
  job: Job
}

export interface ErrorResponse {
  error: string
}

