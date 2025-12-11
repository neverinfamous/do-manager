import type { Env, CorsHeaders, Namespace, NamespaceColor } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'

/**
 * Valid namespace colors - organized by hue family
 */
const VALID_COLORS = [
  // Reds & Pinks
  'red-light', 'red', 'red-dark', 'rose', 'pink-light', 'pink',
  // Oranges & Yellows
  'orange-light', 'orange', 'amber', 'yellow-light', 'yellow', 'lime',
  // Greens & Teals
  'green-light', 'green', 'emerald', 'teal', 'cyan', 'sky',
  // Blues & Purples
  'blue-light', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  // Neutrals
  'slate', 'gray', 'zinc',
] as const

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
const MOCK_NAMESPACES: (Namespace & { instance_count: number })[] = [
  {
    id: 'ns-1',
    name: 'ChatRoom',
    script_name: 'chat-app',
    class_name: 'ChatRoom',
    storage_backend: 'sqlite',
    endpoint_url: null,
    admin_hook_enabled: 1,
    color: 'blue',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    metadata: null,
    instance_count: 3,
  },
  {
    id: 'ns-2',
    name: 'Counter',
    script_name: 'counter-app',
    class_name: 'Counter',
    storage_backend: 'sqlite',
    endpoint_url: null,
    admin_hook_enabled: 0,
    color: null,
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-02-20T14:30:00Z',
    metadata: null,
    instance_count: 1,
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
  const singleMatch = /^\/api\/namespaces\/([^/]+)$/.exec(path)
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

  // POST /api/namespaces/:id/clone - Clone namespace
  const cloneMatch = /^\/api\/namespaces\/([^/]+)\/clone$/.exec(path)
  if (method === 'POST' && cloneMatch) {
    const namespaceId = cloneMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return cloneNamespace(request, namespaceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // PUT /api/namespaces/:id/color - Update namespace color
  const colorMatch = /^\/api\/namespaces\/([^/]+)\/color$/.exec(path)
  if (method === 'PUT' && colorMatch) {
    const namespaceId = colorMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return updateNamespaceColor(request, namespaceId, env, corsHeaders, isLocalDev)
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
    // Use LEFT JOIN with COUNT to get instance counts efficiently
    // The idx_instances_namespace index makes this performant
    const result = await env.METADATA.prepare(`
      SELECT n.*, COUNT(i.id) as instance_count
      FROM namespaces n
      LEFT JOIN instances i ON n.id = i.namespace_id
      GROUP BY n.id
      ORDER BY n.created_at DESC
    `).all<Namespace & { instance_count: number }>()

    return jsonResponse({ namespaces: result.results }, corsHeaders)
  } catch (error) {
    logWarning(`List error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'list',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
      logWarning(`Cloudflare API error: ${errorText}`, {
        module: 'namespaces',
        operation: 'discover',
        metadata: { status: response.status, errorText: errorText.slice(0, 200) }
      })
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
      errors: { message: string }[]
      result: DurableObjectNs[]
    }

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
    logWarning(`Discover error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'discover',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
  if (!body?.name || !body.class_name) {
    return errorResponse('name and class_name are required', corsHeaders, 400)
  }

  // Auto-enable admin hooks if endpoint URL is provided
  const endpointUrl = body.endpoint_url?.trim() ?? null
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
      color: null,
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
    logWarning(`Add error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'add',
      metadata: { name: body.name, error: error instanceof Error ? error.message : String(error) }
    })
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
    logWarning(`Get error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'get',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
    logWarning(`Update error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'update',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
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
    logWarning(`Delete error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'delete',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Failed to delete namespace')
    return errorResponse('Failed to delete namespace', corsHeaders, 500)
  }
}

/**
 * Clone a namespace with a new name
 */
async function cloneNamespace(
  request: Request,
  sourceNamespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface CloneNamespaceBody {
    name: string
    deepClone?: boolean
  }

  const body = await parseJsonBody<CloneNamespaceBody>(request)
  if (!body?.name?.trim()) {
    return errorResponse('name is required', corsHeaders, 400)
  }

  const newName = body.name.trim()
  const deepClone = body.deepClone === true

  if (isLocalDev) {
    // Mock clone for local development
    const sourceNs = MOCK_NAMESPACES.find((n) => n.id === sourceNamespaceId)
    if (!sourceNs) {
      return errorResponse('Source namespace not found', corsHeaders, 404)
    }

    const newNs: Namespace = {
      id: generateId(),
      name: newName,
      script_name: sourceNs.script_name,
      class_name: sourceNs.class_name,
      storage_backend: sourceNs.storage_backend,
      endpoint_url: sourceNs.endpoint_url,
      admin_hook_enabled: sourceNs.admin_hook_enabled,
      color: sourceNs.color,
      created_at: nowISO(),
      updated_at: nowISO(),
      metadata: null,
    }

    return jsonResponse({
      namespace: newNs,
      clonedFrom: sourceNs.name,
      instancesCloned: deepClone ? 2 : undefined,
    }, corsHeaders, 201)
  }

  const jobId = await createJob(env.METADATA, 'clone_namespace', userEmail, sourceNamespaceId)

  // Track created resources for rollback on failure
  let newNamespaceId: string | null = null
  const createdInstanceIds: string[] = []

  try {
    // Get source namespace
    const sourceNs = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(sourceNamespaceId).first<Namespace>()

    if (!sourceNs) {
      await failJob(env.METADATA, jobId, 'Source namespace not found')
      return errorResponse('Source namespace not found', corsHeaders, 404)
    }

    // Check if name already exists
    const existing = await env.METADATA.prepare(
      'SELECT id FROM namespaces WHERE name = ?'
    ).bind(newName).first<{ id: string }>()

    if (existing) {
      await failJob(env.METADATA, jobId, 'Namespace with this name already exists')
      return errorResponse('Namespace with this name already exists', corsHeaders, 409)
    }

    // For deep clone, verify admin hooks are enabled
    if (deepClone && (!sourceNs.endpoint_url || sourceNs.admin_hook_enabled !== 1)) {
      await failJob(env.METADATA, jobId, 'Deep clone requires admin hooks to be enabled')
      return errorResponse(
        'Deep clone requires admin hooks to be enabled on the source namespace',
        corsHeaders,
        400
      )
    }

    // Create cloned namespace
    const newId = generateId()
    newNamespaceId = newId
    const now = nowISO()

    await env.METADATA.prepare(`
      INSERT INTO namespaces (id, name, script_name, class_name, storage_backend, endpoint_url, admin_hook_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      newName,
      sourceNs.script_name,
      sourceNs.class_name,
      sourceNs.storage_backend,
      sourceNs.endpoint_url,
      sourceNs.admin_hook_enabled,
      now,
      now
    ).run()

    let instancesCloned = 0
    const warnings: string[] = []

    // Deep clone: TWO-PHASE APPROACH for atomicity
    // Phase 1: Clone all instance storage first (no D1 records yet)
    // Phase 2: Batch insert D1 records only after all storage clones succeed
    if (deepClone && sourceNs.endpoint_url) {
      // Get all instances for source namespace
      interface Instance {
        id: string
        name: string | null
        object_id: string
        color: string | null
      }
      const instancesResult = await env.METADATA.prepare(
        'SELECT id, name, object_id, color FROM instances WHERE namespace_id = ?'
      ).bind(sourceNamespaceId).all<Instance>()

      const instances = instancesResult.results
      const baseUrl = sourceNs.endpoint_url.replace(/\/+$/, '')

      // Track successfully cloned instances for Phase 2
      interface ClonedInstance {
        originalName: string | null
        newObjectId: string
        color: string | null
      }
      const successfullyClonedInstances: ClonedInstance[] = []
      const failedInstances: string[] = []

      // PHASE 1: Clone all instance storage (DO-to-DO)
      for (const instance of instances) {
        const instanceName = instance.name ?? instance.object_id

        try {
          // Step 1: Export storage from source instance
          const exportResponse = await fetch(
            `${baseUrl}/admin/${encodeURIComponent(instance.object_id)}/export`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          )

          if (!exportResponse.ok) {
            const errorText = await exportResponse.text().catch(() => 'Unknown error')
            warnings.push(`Failed to export instance "${instanceName}": ${errorText.slice(0, 50)}`)
            failedInstances.push(instanceName)
            continue
          }

          interface ExportData { data: Record<string, unknown> }
          const exportData: ExportData = await exportResponse.json()

          // Step 2: Import storage to new instance (creates DO if needed)
          const newInstanceName = instanceName
          const importResponse = await fetch(
            `${baseUrl}/admin/${encodeURIComponent(newInstanceName)}/import`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: exportData.data }),
            }
          )

          if (!importResponse.ok) {
            const errorText = await importResponse.text().catch(() => 'Unknown error')
            warnings.push(`Failed to import to instance "${newInstanceName}": ${errorText.slice(0, 50)}`)
            failedInstances.push(instanceName)
            continue
          }

          // Storage clone succeeded - track for Phase 2
          successfullyClonedInstances.push({
            originalName: instance.name,
            newObjectId: newInstanceName,
            color: instance.color,
          })
        } catch (err) {
          warnings.push(`Error cloning instance "${instanceName}": ${err instanceof Error ? err.message : String(err)}`)
          failedInstances.push(instanceName)
        }
      }

      // PHASE 2: Batch insert D1 records only after all storage clones complete
      // This ensures no orphaned D1 records if we fail during Phase 1
      if (successfullyClonedInstances.length > 0) {
        const instanceNow = nowISO()

        // Use D1 batch for atomic insert of all instance records
        const statements = successfullyClonedInstances.map((cloned) => {
          const newInstanceId = generateId()
          createdInstanceIds.push(newInstanceId)

          return env.METADATA.prepare(`
            INSERT INTO instances (id, namespace_id, name, object_id, color, last_accessed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newInstanceId,
            newId,
            cloned.originalName,
            cloned.newObjectId,
            cloned.color,
            instanceNow,
            instanceNow,
            instanceNow
          )
        })

        // Execute all inserts as a batch (D1 handles as transaction)
        await env.METADATA.batch(statements)
        instancesCloned = successfullyClonedInstances.length
      }

      // Add summary warning if some instances failed
      if (failedInstances.length > 0) {
        warnings.unshift(`${String(failedInstances.length)} of ${String(instances.length)} instances had issues during cloning`)
      }
    }

    const newNs = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(newId).first<Namespace>()

    await completeJob(env.METADATA, jobId, {
      source_namespace_id: sourceNamespaceId,
      new_namespace_id: newId,
      name: newName,
      deep_clone: deepClone,
      instances_cloned: instancesCloned,
      warnings: warnings.length > 0 ? warnings : undefined,
    })

    return jsonResponse({
      namespace: newNs,
      clonedFrom: sourceNs.name,
      ...(deepClone ? { instancesCloned } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    }, corsHeaders, 201)
  } catch (error) {
    // Rollback: delete any created instances and namespace on failure
    if (createdInstanceIds.length > 0 || newNamespaceId) {
      try {
        // Delete created instances first
        for (const instId of createdInstanceIds) {
          await env.METADATA.prepare('DELETE FROM instances WHERE id = ?').bind(instId).run()
        }
        // Delete namespace
        if (newNamespaceId) {
          await env.METADATA.prepare('DELETE FROM namespaces WHERE id = ?').bind(newNamespaceId).run()
        }
        logWarning('Rolled back partial clone due to error', {
          module: 'namespaces',
          operation: 'clone_rollback',
          namespaceId: sourceNamespaceId,
          metadata: {
            rolledBackInstances: createdInstanceIds.length,
            rolledBackNamespace: newNamespaceId !== null
          }
        })
      } catch (rollbackError) {
        logWarning(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`, {
          module: 'namespaces',
          operation: 'clone_rollback',
          namespaceId: sourceNamespaceId,
          metadata: {
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            orphanedNamespace: newNamespaceId,
            orphanedInstances: createdInstanceIds
          }
        })
      }
    }

    logWarning(`Clone error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'clone',
      namespaceId: sourceNamespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Clone failed')
    return errorResponse(
      `Failed to clone namespace: ${error instanceof Error ? error.message : 'Unknown error'}`,
      corsHeaders,
      500
    )
  }
}

/**
 * Update namespace color for visual organization
 */
async function updateNamespaceColor(
  request: Request,
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  interface UpdateColorBody {
    color: string | null
  }

  const body = await parseJsonBody<UpdateColorBody>(request)

  // Validate color
  const color = body?.color
  if (color !== null && color !== undefined) {
    if (!VALID_COLORS.includes(color as typeof VALID_COLORS[number])) {
      return errorResponse(
        `Invalid color. Valid options: ${VALID_COLORS.join(', ')} or null`,
        corsHeaders,
        400
      )
    }
  }

  if (isLocalDev) {
    const namespace = MOCK_NAMESPACES.find((n) => n.id === namespaceId)
    if (!namespace) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }
    // Update mock namespace color - cast is safe after validation
    namespace.color = (color ?? null) as NamespaceColor
    return jsonResponse({ namespace, success: true }, corsHeaders)
  }

  try {
    const now = nowISO()
    await env.METADATA.prepare(`
      UPDATE namespaces SET color = ?, updated_at = ? WHERE id = ?
    `).bind(color ?? null, now, namespaceId).run()

    const updated = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(namespaceId).first<Namespace>()

    if (!updated) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    return jsonResponse({ namespace: updated, success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Update color error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'namespaces',
      operation: 'update_color',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to update namespace color', corsHeaders, 500)
  }
}
