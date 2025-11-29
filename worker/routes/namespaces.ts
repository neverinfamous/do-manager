import type { Env, CorsHeaders, Namespace } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'

/**
 * System DO namespaces to filter from discovery
 * These are internal DOs used by management apps that shouldn't be modified
 */
const SYSTEM_DO_PATTERNS = [
  // KV Manager internal DOs
  'kv-manager_ImportExportDO',
  'kv-manager_BulkOperationDO',
  // D1 Manager internal DOs (if any)
  'd1-manager_',
  // DO Manager internal DOs (if any)
  'do-manager_',
]

/**
 * Check if a namespace name matches a system pattern
 */
function isSystemNamespace(name: string): boolean {
  return SYSTEM_DO_PATTERNS.some((pattern) => 
    name === pattern || name.startsWith(pattern)
  )
}

/**
 * Mock namespaces for local development
 */
const MOCK_NAMESPACES: Namespace[] = [
  {
    id: 'ns-1',
    name: 'ChatRoom',
    script_name: 'chat-app',
    class_name: 'ChatRoom',
    storage_backend: 'sqlite',
    endpoint_url: null,
    admin_hook_enabled: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    metadata: null,
  },
  {
    id: 'ns-2',
    name: 'Counter',
    script_name: 'counter-app',
    class_name: 'Counter',
    storage_backend: 'sqlite',
    endpoint_url: null,
    admin_hook_enabled: 0,
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-02-20T14:30:00Z',
    metadata: null,
  },
]

/**
 * Handle namespace routes
 */
export async function handleNamespaceRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/namespaces - List all namespaces
  if (method === 'GET' && path === '/api/namespaces') {
    return listNamespaces(env, corsHeaders, isLocalDev)
  }

  // GET /api/namespaces/discover - Auto-discover from Cloudflare API
  if (method === 'GET' && path === '/api/namespaces/discover') {
    return discoverNamespaces(env, corsHeaders, isLocalDev)
  }

  // POST /api/namespaces - Add namespace manually
  if (method === 'POST' && path === '/api/namespaces') {
    return addNamespace(request, env, corsHeaders, isLocalDev, userEmail)
  }

  // GET /api/namespaces/:id - Get single namespace
  const singleMatch = path.match(/^\/api\/namespaces\/([^/]+)$/)
  if (method === 'GET' && singleMatch) {
    const namespaceId = singleMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return getNamespace(namespaceId, env, corsHeaders, isLocalDev)
  }

  // PUT /api/namespaces/:id - Update namespace
  if (method === 'PUT' && singleMatch) {
    const namespaceId = singleMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return updateNamespace(request, namespaceId, env, corsHeaders, isLocalDev)
  }

  // DELETE /api/namespaces/:id - Delete namespace
  if (method === 'DELETE' && singleMatch) {
    const namespaceId = singleMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return deleteNamespace(namespaceId, env, corsHeaders, isLocalDev, userEmail)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List all tracked namespaces from D1
 */
async function listNamespaces(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ namespaces: MOCK_NAMESPACES }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(
      'SELECT * FROM namespaces ORDER BY created_at DESC'
    ).all<Namespace>()

    return jsonResponse({ namespaces: result.results }, corsHeaders)
  } catch (error) {
    console.error('[Namespaces] List error:', error)
    return errorResponse('Failed to list namespaces', corsHeaders, 500)
  }
}

/**
 * Discover Durable Object namespaces from Cloudflare API
 */
async function discoverNamespaces(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ discovered: MOCK_NAMESPACES }, corsHeaders)
  }

  try {
    // Fetch DO namespaces from Cloudflare API
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/workers/durable_objects/namespaces`
    
    // Build auth headers - support both API Token (Bearer) and Global API Key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Check if API_KEY looks like a Global API Key (shorter, no prefix) or API Token
    if (env.API_KEY && env.API_KEY.length < 50) {
      // Global API Key style - requires email
      headers['X-Auth-Email'] = 'writenotenow@gmail.com'
      headers['X-Auth-Key'] = env.API_KEY
    } else {
      // API Token style
      headers['Authorization'] = `Bearer ${env.API_KEY}`
    }
    
    const response = await fetch(apiUrl, { headers })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Namespaces] Cloudflare API error:', errorText)
      return errorResponse('Failed to fetch from Cloudflare API', corsHeaders, response.status)
    }

    interface DurableObjectNs {
      id: string
      name: string
      script: string
      class: string
    }
    interface CloudflareResponse {
      success: boolean
      errors: Array<{ message: string }>
      result: DurableObjectNs[]
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const data = await response.json() as CloudflareResponse
    
    if (!data.success) {
      const firstError = data.errors[0]
      const errorMessage = firstError?.message ?? 'API error'
      return errorResponse(errorMessage, corsHeaders, 500)
    }

    // Filter out system namespaces and transform to our format
    const discovered = data.result
      .filter((ns) => !isSystemNamespace(ns.name))
      .map((ns) => ({
        id: ns.id,
        name: ns.name,
        script_name: ns.script,
        class_name: ns.class,
        storage_backend: 'sqlite' as const,
        endpoint_url: null,
        admin_hook_enabled: 0,
        created_at: nowISO(),
        updated_at: nowISO(),
        metadata: null,
      }))

    return jsonResponse({ discovered }, corsHeaders)
  } catch (error) {
    console.error('[Namespaces] Discover error:', error)
    return errorResponse('Failed to discover namespaces', corsHeaders, 500)
  }
}

/**
 * Add a namespace manually
 */
async function addNamespace(
  request: Request,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface AddNamespaceBody {
    name: string
    class_name: string
    script_name?: string
    storage_backend?: 'sqlite' | 'kv'
    endpoint_url?: string
  }

  const body = await parseJsonBody<AddNamespaceBody>(request)
  if (!body || !body.name || !body.class_name) {
    return errorResponse('name and class_name are required', corsHeaders, 400)
  }

  // Auto-enable admin hooks if endpoint URL is provided
  const endpointUrl = body.endpoint_url?.trim() || null
  const hasEndpoint = endpointUrl !== null && endpointUrl.length > 0

  if (isLocalDev) {
    const newNs: Namespace = {
      id: generateId(),
      name: body.name,
      script_name: body.script_name ?? null,
      class_name: body.class_name,
      storage_backend: body.storage_backend ?? 'sqlite',
      endpoint_url: endpointUrl,
      admin_hook_enabled: hasEndpoint ? 1 : 0,
      created_at: nowISO(),
      updated_at: nowISO(),
      metadata: null,
    }
    return jsonResponse({ namespace: newNs }, corsHeaders, 201)
  }

  const jobId = await createJob(env.METADATA, 'create_namespace', userEmail)

  try {
    const id = generateId()
    const now = nowISO()

    await env.METADATA.prepare(`
      INSERT INTO namespaces (id, name, script_name, class_name, storage_backend, endpoint_url, admin_hook_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name,
      body.script_name ?? null,
      body.class_name,
      body.storage_backend ?? 'sqlite',
      endpointUrl,
      hasEndpoint ? 1 : 0,
      now,
      now
    ).run()

    const result = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(id).first<Namespace>()

    // Update job with namespace ID and complete
    if (jobId) {
      await env.METADATA.prepare('UPDATE jobs SET namespace_id = ? WHERE id = ?').bind(id, jobId).run()
    }
    await completeJob(env.METADATA, jobId, { namespace_id: id, name: body.name })

    return jsonResponse({ namespace: result }, corsHeaders, 201)
  } catch (error) {
    console.error('[Namespaces] Add error:', error)
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Failed to add namespace')
    return errorResponse('Failed to add namespace', corsHeaders, 500)
  }
}

/**
 * Get a single namespace by ID
 */
async function getNamespace(
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const ns = MOCK_NAMESPACES.find((n) => n.id === namespaceId)
    if (!ns) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }
    return jsonResponse({ namespace: ns }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(namespaceId).first<Namespace>()

    if (!result) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    return jsonResponse({ namespace: result }, corsHeaders)
  } catch (error) {
    console.error('[Namespaces] Get error:', error)
    return errorResponse('Failed to get namespace', corsHeaders, 500)
  }
}

/**
 * Update a namespace
 */
async function updateNamespace(
  request: Request,
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  interface UpdateNamespaceBody {
    name?: string
    endpoint_url?: string | null
    admin_hook_enabled?: number
    storage_backend?: 'sqlite' | 'kv'
  }

  const body = await parseJsonBody<UpdateNamespaceBody>(request)
  if (!body) {
    return errorResponse('Invalid request body', corsHeaders, 400)
  }

  if (isLocalDev) {
    const ns = MOCK_NAMESPACES.find((n) => n.id === namespaceId)
    if (!ns) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }
    const updated: Namespace = {
      ...ns,
      name: body.name ?? ns.name,
      endpoint_url: body.endpoint_url !== undefined ? body.endpoint_url : ns.endpoint_url,
      admin_hook_enabled: body.admin_hook_enabled ?? ns.admin_hook_enabled,
      storage_backend: body.storage_backend ?? ns.storage_backend,
      updated_at: nowISO(),
    }
    return jsonResponse({ namespace: updated }, corsHeaders)
  }

  try {
    // Build dynamic update query
    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (body.name !== undefined) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.endpoint_url !== undefined) {
      updates.push('endpoint_url = ?')
      values.push(body.endpoint_url)
    }
    if (body.admin_hook_enabled !== undefined) {
      updates.push('admin_hook_enabled = ?')
      values.push(body.admin_hook_enabled)
    }
    if (body.storage_backend !== undefined) {
      updates.push('storage_backend = ?')
      values.push(body.storage_backend)
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', corsHeaders, 400)
    }

    updates.push('updated_at = ?')
    values.push(nowISO())
    values.push(namespaceId)

    await env.METADATA.prepare(
      `UPDATE namespaces SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    const result = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(namespaceId).first<Namespace>()

    if (!result) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    return jsonResponse({ namespace: result }, corsHeaders)
  } catch (error) {
    console.error('[Namespaces] Update error:', error)
    return errorResponse('Failed to update namespace', corsHeaders, 500)
  }
}

/**
 * Delete a namespace
 */
async function deleteNamespace(
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ success: true }, corsHeaders)
  }

  const jobId = await createJob(env.METADATA, 'delete_namespace', userEmail, namespaceId)

  try {
    // Get namespace name before deletion for job result
    const ns = await env.METADATA.prepare('SELECT name FROM namespaces WHERE id = ?').bind(namespaceId).first<{ name: string }>()

    await env.METADATA.prepare(
      'DELETE FROM namespaces WHERE id = ?'
    ).bind(namespaceId).run()

    await completeJob(env.METADATA, jobId, { namespace_id: namespaceId, name: ns?.name })
    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    console.error('[Namespaces] Delete error:', error)
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Failed to delete namespace')
    return errorResponse('Failed to delete namespace', corsHeaders, 500)
  }
}

