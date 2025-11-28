/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  message: string,
  corsHeaders: Record<string, string>,
  status = 500
): Response {
  return jsonResponse(
    { error: message },
    corsHeaders,
    status
  )
}

/**
 * Parse JSON body from request, returning null on failure
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Validate that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Safe JSON parse with default value
 */
export function safeJsonParse<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

/**
 * Job types for tracking user actions
 */
export type JobType = 
  | 'backup'
  | 'restore'
  | 'create_namespace'
  | 'delete_namespace'
  | 'create_instance'
  | 'delete_instance'
  | 'create_key'
  | 'delete_key'
  | 'set_alarm'
  | 'delete_alarm'

/**
 * Create a job record in the database
 * Returns null if job creation fails (non-critical)
 */
export async function createJob(
  db: D1Database,
  type: JobType,
  userEmail: string | null,
  namespaceId: string | null = null,
  instanceId: string | null = null
): Promise<string | null> {
  try {
    const jobId = generateId()
    const now = nowISO()
    
    await db.prepare(`
      INSERT INTO jobs (id, type, status, namespace_id, instance_id, user_email, progress, created_at, started_at)
      VALUES (?, ?, 'running', ?, ?, ?, 0, ?, ?)
    `).bind(jobId, type, namespaceId, instanceId, userEmail, now, now).run()
    
    return jobId
  } catch (error) {
    console.error('[Jobs] Failed to create job:', error)
    return null
  }
}

/**
 * Complete a job (success)
 * Fails silently if update fails
 */
export async function completeJob(
  db: D1Database,
  jobId: string | null,
  result?: Record<string, unknown>
): Promise<void> {
  if (!jobId) return
  try {
    await db.prepare(`
      UPDATE jobs SET status = 'completed', progress = 100, result = ?, completed_at = ?
      WHERE id = ?
    `).bind(result ? JSON.stringify(result) : null, nowISO(), jobId).run()
  } catch (error) {
    console.error('[Jobs] Failed to complete job:', error)
  }
}

/**
 * Fail a job
 * Fails silently if update fails
 */
export async function failJob(
  db: D1Database,
  jobId: string | null,
  error: string
): Promise<void> {
  if (!jobId) return
  try {
    await db.prepare(`
      UPDATE jobs SET status = 'failed', progress = 0, error = ?, completed_at = ?
      WHERE id = ?
    `).bind(error, nowISO(), jobId).run()
  } catch (err) {
    console.error('[Jobs] Failed to fail job:', err)
  }
}

