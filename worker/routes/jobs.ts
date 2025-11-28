import type { Env, CorsHeaders, Job } from '../types'
import { jsonResponse, errorResponse } from '../utils/helpers'

/**
 * Mock jobs for local development
 */
const MOCK_JOBS: Job[] = [
  {
    id: 'job-1',
    type: 'backup',
    status: 'completed',
    namespace_id: 'ns-1',
    instance_id: 'inst-1',
    user_email: 'dev@localhost',
    progress: 100,
    result: JSON.stringify({ backup_id: 'backup-123' }),
    error: null,
    created_at: '2024-03-01T10:00:00Z',
    started_at: '2024-03-01T10:00:01Z',
    completed_at: '2024-03-01T10:00:05Z',
  },
  {
    id: 'job-2',
    type: 'bulk_delete',
    status: 'failed',
    namespace_id: 'ns-2',
    instance_id: null,
    user_email: 'dev@localhost',
    progress: 50,
    result: null,
    error: 'Connection timeout',
    created_at: '2024-03-02T14:30:00Z',
    started_at: '2024-03-02T14:30:01Z',
    completed_at: '2024-03-02T14:30:10Z',
  },
]

/**
 * Handle job routes
 */
export async function handleJobRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/jobs - List all jobs
  if (method === 'GET' && path === '/api/jobs') {
    return listJobs(env, url, corsHeaders, isLocalDev)
  }

  // GET /api/jobs/:id - Get single job
  const singleMatch = path.match(/^\/api\/jobs\/([^/]+)$/)
  if (method === 'GET' && singleMatch) {
    const jobId = singleMatch[1]
    if (!jobId) {
      return errorResponse('Job ID required', corsHeaders, 400)
    }
    return getJob(jobId, env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List jobs with optional filters
 */
async function listJobs(
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const status = url.searchParams.get('status')
  const namespaceId = url.searchParams.get('namespace_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

  if (isLocalDev) {
    let filtered = [...MOCK_JOBS]
    if (status) {
      filtered = filtered.filter((j) => j.status === status)
    }
    if (namespaceId) {
      filtered = filtered.filter((j) => j.namespace_id === namespaceId)
    }
    return jsonResponse({ jobs: filtered.slice(0, limit) }, corsHeaders)
  }

  try {
    let query = 'SELECT * FROM jobs WHERE 1=1'
    const params: (string | number)[] = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (namespaceId) {
      query += ' AND namespace_id = ?'
      params.push(namespaceId)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const result = await env.METADATA.prepare(query).bind(...params).all<Job>()

    return jsonResponse({ jobs: result.results }, corsHeaders)
  } catch (error) {
    console.error('[Jobs] List error:', error)
    return errorResponse('Failed to list jobs', corsHeaders, 500)
  }
}

/**
 * Get a single job by ID
 */
async function getJob(
  jobId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const job = MOCK_JOBS.find((j) => j.id === jobId)
    if (!job) {
      return errorResponse('Job not found', corsHeaders, 404)
    }
    return jsonResponse({ job }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(
      'SELECT * FROM jobs WHERE id = ?'
    ).bind(jobId).first<Job>()

    if (!result) {
      return errorResponse('Job not found', corsHeaders, 404)
    }

    return jsonResponse({ job: result }, corsHeaders)
  } catch (error) {
    console.error('[Jobs] Get error:', error)
    return errorResponse('Failed to get job', corsHeaders, 500)
  }
}

