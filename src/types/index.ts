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
  color: NamespaceColor
  created_at: string
  updated_at: string
  metadata: string | null
  /** Number of tracked instances in this namespace */
  instance_count?: number
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
  color: InstanceColor
  created_at: string
  updated_at: string
  metadata: string | null
  tags: string[]
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

export interface CloneNamespaceResponse {
  namespace: Namespace
  clonedFrom: string
  instancesCloned?: number
  warnings?: string[]
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

/**
 * Saved SQL query
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
 * Migration types for database upgrade system
 */
export interface Migration {
  version: number
  name: string
  description: string
}

export interface AppliedMigration {
  version: number
  migration_name: string
  applied_at: string
}

export interface LegacyInstallationInfo {
  isLegacy: boolean
  existingTables: string[]
  suggestedVersion: number
}

export interface MigrationStatus {
  currentVersion: number
  latestVersion: number
  pendingMigrations: Migration[]
  appliedMigrations: AppliedMigration[]
  isUpToDate: boolean
  legacy?: LegacyInstallationInfo
}

export interface MigrationResult {
  success: boolean
  migrationsApplied: number
  currentVersion: number
  errors: string[]
}

export interface MigrationStatusResponse {
  result: MigrationStatus
  success: boolean
}

export interface MigrationResultResponse {
  result: MigrationResult
  success: boolean
}
