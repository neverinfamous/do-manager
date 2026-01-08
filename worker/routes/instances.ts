import type { Env, CorsHeaders, Instance, InstanceColor, Namespace } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO, parseJsonBody, createJob, completeJob, failJob } from '../utils/helpers'
import { logWarning } from '../utils/error-logger'
import { triggerWebhooks, createInstanceWebhookData } from '../utils/webhooks'
import { detectCompletedAlarms } from './health'

/**
 * Valid instance colors - organized by hue family
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
 * Mock instances for local development
 */
const MOCK_INSTANCES: Instance[] = [
  {
    id: 'inst-1',
    namespace_id: 'ns-1',
    name: 'room-general',
    object_id: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    last_accessed: '2024-03-01T10:00:00Z',
    storage_size_bytes: 1024,
    has_alarm: 1,
    color: 'blue',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-03-01T10:00:00Z',
    metadata: null,
    tags: ['production', 'priority:high'],
  },
  {
    id: 'inst-2',
    namespace_id: 'ns-1',
    name: 'room-support',
    object_id: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7',
    last_accessed: '2024-03-02T14:30:00Z',
    storage_size_bytes: 2048,
    has_alarm: 0,
    color: 'green',
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-03-02T14:30:00Z',
    metadata: null,
    tags: ['staging', 'team:support'],
  },
  {
    id: 'inst-3',
    namespace_id: 'ns-2',
    name: 'counter-main',
    object_id: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
    last_accessed: '2024-03-03T09:15:00Z',
    storage_size_bytes: 512,
    has_alarm: 0,
    color: null,
    created_at: '2024-02-25T09:00:00Z',
    updated_at: '2024-03-03T09:15:00Z',
    metadata: null,
    tags: [],
  },
]

/**
 * Handle instance routes
 */
export async function handleInstanceRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/namespaces/:nsId/instances - List instances for namespace
  const listMatch = /^\/api\/namespaces\/([^/]+)\/instances$/.exec(path)
  if (method === 'GET' && listMatch) {
    const namespaceId = listMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return listInstances(namespaceId, env, url, corsHeaders, isLocalDev)
  }

  // POST /api/namespaces/:nsId/instances - Create/ping instance
  if (method === 'POST' && listMatch) {
    const namespaceId = listMatch[1]
    if (!namespaceId) {
      return errorResponse('Namespace ID required', corsHeaders, 400)
    }
    return createInstance(request, namespaceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // GET /api/instances/:id - Get single instance
  const singleMatch = /^\/api\/instances\/([^/]+)$/.exec(path)
  if (method === 'GET' && singleMatch) {
    const instanceId = singleMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return getInstance(instanceId, env, corsHeaders, isLocalDev)
  }

  // DELETE /api/instances/:id - Delete instance tracking
  if (method === 'DELETE' && singleMatch) {
    const instanceId = singleMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return deleteInstance(instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // PUT /api/instances/:id/accessed - Update last accessed time
  const accessedMatch = /^\/api\/instances\/([^/]+)\/accessed$/.exec(path)
  if (method === 'PUT' && accessedMatch) {
    const instanceId = accessedMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return updateInstanceAccessed(instanceId, env, corsHeaders, isLocalDev)
  }

  // POST /api/instances/:id/clone - Clone instance
  const cloneMatch = /^\/api\/instances\/([^/]+)\/clone$/.exec(path)
  if (method === 'POST' && cloneMatch) {
    const instanceId = cloneMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return cloneInstance(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // PUT /api/instances/:id/color - Update instance color
  const colorMatch = /^\/api\/instances\/([^/]+)\/color$/.exec(path)
  if (method === 'PUT' && colorMatch) {
    const instanceId = colorMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return updateInstanceColor(request, instanceId, env, corsHeaders, isLocalDev)
  }

  // PUT /api/instances/:id/rename - Rename instance
  const renameMatch = /^\/api\/instances\/([^/]+)\/rename$/.exec(path)
  if (method === 'PUT' && renameMatch) {
    const instanceId = renameMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return renameInstance(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // PUT /api/instances/:id/tags - Update instance tags
  const tagsMatch = /^\/api\/instances\/([^/]+)\/tags$/.exec(path)
  if (method === 'PUT' && tagsMatch) {
    const instanceId = tagsMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return updateInstanceTags(request, instanceId, env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List instances for a namespace
 */
async function listInstances(
  namespaceId: string,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  if (isLocalDev) {
    const filtered = MOCK_INSTANCES.filter((i) => i.namespace_id === namespaceId)
    return jsonResponse({
      instances: filtered.slice(offset, offset + limit),
      total: filtered.length,
    }, corsHeaders)
  }

  try {
    // Detect any completed alarms before fetching instances
    // This ensures has_alarm flags and Job History are up-to-date
    await detectCompletedAlarms(env)

    // Batch parallel D1 queries for performance
    const [countResult, result] = await Promise.all([
      env.METADATA.prepare(
        'SELECT COUNT(*) as count FROM instances WHERE namespace_id = ?'
      ).bind(namespaceId).first<{ count: number }>(),

      env.METADATA.prepare(`
        SELECT * FROM instances 
        WHERE namespace_id = ? 
        ORDER BY last_accessed DESC NULLS LAST, created_at DESC
        LIMIT ? OFFSET ?
      `).bind(namespaceId, limit, offset).all<Instance>(),
    ])

    return jsonResponse({
      instances: result.results,
      total: countResult?.count ?? 0,
    }, corsHeaders)
  } catch (error) {
    logWarning(`List error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'list',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to list instances', corsHeaders, 500)
  }
}

/**
 * Create or track an instance
 */
async function createInstance(
  request: Request,
  namespaceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface CreateInstanceBody {
    name?: string
    object_id: string
  }

  const body = await parseJsonBody<CreateInstanceBody>(request)
  if (!body?.object_id) {
    return errorResponse('object_id is required', corsHeaders, 400)
  }

  if (isLocalDev) {
    const newInstance: Instance = {
      id: generateId(),
      namespace_id: namespaceId,
      name: body.name ?? null,
      object_id: body.object_id,
      last_accessed: nowISO(),
      storage_size_bytes: null,
      has_alarm: 0,
      color: null,
      created_at: nowISO(),
      updated_at: nowISO(),
      metadata: null,
      tags: [],
    }
    return jsonResponse({ instance: newInstance }, corsHeaders, 201)
  }

  // Create job record first
  const jobId = await createJob(env.METADATA, 'create_instance', userEmail, namespaceId)

  try {
    // Check if instance already exists
    const existing = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE namespace_id = ? AND object_id = ?'
    ).bind(namespaceId, body.object_id).first<Instance>()

    if (existing) {
      // Update last accessed
      await env.METADATA.prepare(`
        UPDATE instances SET last_accessed = ?, updated_at = ? WHERE id = ?
      `).bind(nowISO(), nowISO(), existing.id).run()

      const updated = await env.METADATA.prepare(
        'SELECT * FROM instances WHERE id = ?'
      ).bind(existing.id).first<Instance>()

      // Complete job even for existing instance (just updated access time)
      await completeJob(env.METADATA, jobId, { instance_id: existing.id, name: existing.name ?? existing.object_id, already_existed: true })
      return jsonResponse({ instance: updated, created: false }, corsHeaders)
    }

    // Create new instance record
    const id = generateId()
    const now = nowISO()

    await env.METADATA.prepare(`
      INSERT INTO instances (id, namespace_id, name, object_id, last_accessed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      namespaceId,
      body.name ?? null,
      body.object_id,
      now,
      now,
      now
    ).run()

    const result = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(id).first<Instance>()

    // Update job with instance ID and complete
    if (jobId) {
      await env.METADATA.prepare('UPDATE jobs SET instance_id = ? WHERE id = ?').bind(id, jobId).run()
    }
    await completeJob(env.METADATA, jobId, { instance_id: id, name: body.name ?? body.object_id })

    // Trigger instance_create webhook for newly created instances
    // Get namespace name for webhook payload
    const namespace = await env.METADATA.prepare(
      'SELECT name FROM namespaces WHERE id = ?'
    ).bind(namespaceId).first<{ name: string }>()

    void triggerWebhooks(
      env,
      'instance_create',
      createInstanceWebhookData(
        id,
        body.name ?? body.object_id,
        namespaceId,
        namespace?.name ?? namespaceId,
        userEmail
      ),
      isLocalDev
    )

    return jsonResponse({ instance: result, created: true }, corsHeaders, 201)
  } catch (error) {
    logWarning(`Create error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'create',
      namespaceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Failed to create instance')
    return errorResponse('Failed to create instance', corsHeaders, 500)
  }
}

/**
 * Get a single instance by ID
 */
async function getInstance(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const instance = MOCK_INSTANCES.find((i) => i.id === instanceId)
    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    return jsonResponse({ instance }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!result) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    return jsonResponse({ instance: result }, corsHeaders)
  } catch (error) {
    logWarning(`Get error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'get',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to get instance', corsHeaders, 500)
  }
}

/**
 * Delete an instance tracking record
 */
async function deleteInstance(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ success: true }, corsHeaders)
  }

  try {
    // Get instance info before deletion
    const inst = await env.METADATA.prepare('SELECT * FROM instances WHERE id = ?').bind(instanceId).first<Instance>()
    const jobId = await createJob(env.METADATA, 'delete_instance', userEmail, inst?.namespace_id ?? null, instanceId)

    await env.METADATA.prepare(
      'DELETE FROM instances WHERE id = ?'
    ).bind(instanceId).run()

    await completeJob(env.METADATA, jobId, { instance_id: instanceId, name: inst?.name ?? inst?.object_id })

    // Trigger instance_delete webhook
    if (inst) {
      // Get namespace name for webhook payload
      const namespace = await env.METADATA.prepare(
        'SELECT name FROM namespaces WHERE id = ?'
      ).bind(inst.namespace_id).first<{ name: string }>()

      void triggerWebhooks(
        env,
        'instance_delete',
        createInstanceWebhookData(
          instanceId,
          inst.name ?? inst.object_id,
          inst.namespace_id,
          namespace?.name ?? inst.namespace_id,
          userEmail
        ),
        isLocalDev
      )
    }

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Delete error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'delete',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to delete instance', corsHeaders, 500)
  }
}

/**
 * Update instance last accessed time
 */
async function updateInstanceAccessed(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({ success: true }, corsHeaders)
  }

  try {
    const now = nowISO()
    await env.METADATA.prepare(`
      UPDATE instances SET last_accessed = ?, updated_at = ? WHERE id = ?
    `).bind(now, now, instanceId).run()

    return jsonResponse({ success: true, last_accessed: now }, corsHeaders)
  } catch (error) {
    logWarning(`Update accessed error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'update_accessed',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to update instance', corsHeaders, 500)
  }
}

/**
 * Clone an instance to a new name
 */
async function cloneInstance(
  request: Request,
  sourceInstanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface CloneInstanceBody {
    name: string
  }

  const body = await parseJsonBody<CloneInstanceBody>(request)
  if (!body?.name?.trim()) {
    return errorResponse('name is required', corsHeaders, 400)
  }

  const newName = body.name.trim()

  if (isLocalDev) {
    // Mock clone for local development
    const sourceInstance = MOCK_INSTANCES.find((i) => i.id === sourceInstanceId)
    if (!sourceInstance) {
      return errorResponse('Source instance not found', corsHeaders, 404)
    }

    const newInstance: Instance = {
      id: generateId(),
      namespace_id: sourceInstance.namespace_id,
      name: newName,
      object_id: newName,
      last_accessed: nowISO(),
      storage_size_bytes: sourceInstance.storage_size_bytes,
      has_alarm: 0,
      color: sourceInstance.color,
      created_at: nowISO(),
      updated_at: nowISO(),
      metadata: null,
      tags: [],
    }

    return jsonResponse({
      instance: newInstance,
      clonedFrom: sourceInstance.name ?? sourceInstance.object_id,
    }, corsHeaders, 201)
  }

  // Create job record
  const jobId = await createJob(env.METADATA, 'clone_instance', userEmail)

  try {
    // Get source instance info
    const sourceInstance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(sourceInstanceId).first<Instance>()

    if (!sourceInstance) {
      await failJob(env.METADATA, jobId, 'Source instance not found')
      return errorResponse('Source instance not found', corsHeaders, 404)
    }

    // Update job with namespace info
    await env.METADATA.prepare(
      'UPDATE jobs SET namespace_id = ?, instance_id = ? WHERE id = ?'
    ).bind(sourceInstance.namespace_id, sourceInstanceId, jobId).run()

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(sourceInstance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      await failJob(env.METADATA, jobId, 'Namespace endpoint not configured')
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Check if target name already exists
    const existing = await env.METADATA.prepare(
      'SELECT id FROM instances WHERE namespace_id = ? AND (name = ? OR object_id = ?)'
    ).bind(sourceInstance.namespace_id, newName, newName).first<{ id: string }>()

    if (existing) {
      await failJob(env.METADATA, jobId, 'Instance with this name already exists')
      return errorResponse('Instance with this name already exists', corsHeaders, 409)
    }

    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const sourceInstanceName = sourceInstance.name ?? sourceInstance.object_id

    // Step 1: Export data from source instance
    const exportResponse = await fetch(
      `${baseUrl}/admin/${encodeURIComponent(sourceInstanceName)}/export`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!exportResponse.ok) {
      const errorText = await exportResponse.text().catch(() => 'Unknown error')
      await failJob(env.METADATA, jobId, `Export failed: ${String(exportResponse.status)}`)
      return errorResponse(
        `Failed to export source instance: ${errorText.slice(0, 100)}`,
        corsHeaders,
        exportResponse.status
      )
    }

    interface ExportData { data: Record<string, unknown> }
    const exportData: ExportData = await exportResponse.json()

    // Step 2: Import data to new instance (this creates the DO if it doesn't exist)
    const importResponse = await fetch(
      `${baseUrl}/admin/${encodeURIComponent(newName)}/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: exportData.data }),
      }
    )

    if (!importResponse.ok) {
      const errorText = await importResponse.text().catch(() => 'Unknown error')
      await failJob(env.METADATA, jobId, `Import failed: ${String(importResponse.status)}`)
      return errorResponse(
        `Failed to import to new instance: ${errorText.slice(0, 100)}`,
        corsHeaders,
        importResponse.status
      )
    }

    // Step 3: Create tracking record for new instance
    const newId = generateId()
    const now = nowISO()

    await env.METADATA.prepare(`
      INSERT INTO instances (id, namespace_id, name, object_id, last_accessed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      sourceInstance.namespace_id,
      newName,
      newName,
      now,
      now,
      now
    ).run()

    const newInstance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(newId).first<Instance>()

    await completeJob(env.METADATA, jobId, {
      source_instance_id: sourceInstanceId,
      new_instance_id: newId,
      name: newName,
    })

    return jsonResponse({
      instance: newInstance,
      clonedFrom: sourceInstanceName,
    }, corsHeaders, 201)
  } catch (error) {
    logWarning(`Clone error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'clone',
      instanceId: sourceInstanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Clone failed')
    return errorResponse(
      `Failed to clone instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      corsHeaders,
      500
    )
  }
}

/**
 * Update instance color for visual organization
 */
async function updateInstanceColor(
  request: Request,
  instanceId: string,
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
    const instance = MOCK_INSTANCES.find((i) => i.id === instanceId)
    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    // Update mock instance color - cast is safe after validation
    instance.color = (color ?? null) as InstanceColor
    return jsonResponse({ instance, success: true }, corsHeaders)
  }

  try {
    const now = nowISO()
    await env.METADATA.prepare(`
      UPDATE instances SET color = ?, updated_at = ? WHERE id = ?
    `).bind(color ?? null, now, instanceId).run()

    const updated = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!updated) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    return jsonResponse({ instance: updated, success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Update color error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'update_color',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to update instance color', corsHeaders, 500)
  }
}

/**
 * Rename an instance
 */
async function renameInstance(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  interface RenameInstanceBody {
    name: string
  }

  const body = await parseJsonBody<RenameInstanceBody>(request)
  if (!body?.name?.trim()) {
    return errorResponse('name is required', corsHeaders, 400)
  }

  const newName = body.name.trim()

  if (isLocalDev) {
    const instance = MOCK_INSTANCES.find((i) => i.id === instanceId)
    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    // Update mock instance name
    instance.name = newName
    return jsonResponse({ instance, success: true }, corsHeaders)
  }

  // Create job record
  const jobId = await createJob(env.METADATA, 'rename_instance', userEmail)

  try {
    // Get existing instance
    const existing = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!existing) {
      await failJob(env.METADATA, jobId, 'Instance not found')
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Update job with namespace info
    await env.METADATA.prepare(
      'UPDATE jobs SET namespace_id = ?, instance_id = ? WHERE id = ?'
    ).bind(existing.namespace_id, instanceId, jobId).run()

    const oldName = existing.name ?? existing.object_id

    // Update instance name in D1
    const now = nowISO()
    await env.METADATA.prepare(`
      UPDATE instances SET name = ?, updated_at = ? WHERE id = ?
    `).bind(newName, now, instanceId).run()

    const updated = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    await completeJob(env.METADATA, jobId, {
      instance_id: instanceId,
      old_name: oldName,
      new_name: newName,
    })

    return jsonResponse({ instance: updated, success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Rename error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'instances',
      operation: 'rename',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    await failJob(env.METADATA, jobId, error instanceof Error ? error.message : 'Failed to rename instance')
    return errorResponse('Failed to rename instance', corsHeaders, 500)
  }
}

/**
 * Update instance tags for organization and search
 */
async function updateInstanceTags(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  interface UpdateTagsBody {
    tags: string[]
  }

  const body = await parseJsonBody<UpdateTagsBody>(request)

  // Validate tags
  if (!body || !Array.isArray(body.tags)) {
    return errorResponse('tags must be an array of strings', corsHeaders, 400)
  }

  // Validate each tag
  const MAX_TAGS = 20
  const MAX_TAG_LENGTH = 50

  if (body.tags.length > MAX_TAGS) {
    return errorResponse(`Maximum ${MAX_TAGS} tags allowed`, corsHeaders, 400)
  }

  const validatedTags: string[] = []
  for (const tag of body.tags) {
    if (typeof tag !== 'string') {
      return errorResponse('Each tag must be a string', corsHeaders, 400)
    }
    const trimmed = tag.trim()
    if (trimmed.length === 0) {
      continue // Skip empty tags
    }
    if (trimmed.length > MAX_TAG_LENGTH) {
      return errorResponse(`Each tag must be ${MAX_TAG_LENGTH} characters or less`, corsHeaders, 400)
    }
    if (!validatedTags.includes(trimmed)) {
      validatedTags.push(trimmed) // Deduplicate
    }
  }

  if (isLocalDev) {
    const instance = MOCK_INSTANCES.find((i) => i.id === instanceId)
    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }
    // Update mock instance tags
    instance.tags = validatedTags
    return jsonResponse({ instance, success: true }, corsHeaders)
  }

  try {
    const now = nowISO()
    const tagsJson = JSON.stringify(validatedTags)

    await env.METADATA.prepare(`
      UPDATE instances SET tags = ?, updated_at = ? WHERE id = ?
    `).bind(tagsJson, now, instanceId).run()

    const updated = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!updated) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    return jsonResponse({ instance: updated, success: true }, corsHeaders)
  } catch (error) {
    logWarning(`Update tags error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'tags',
      operation: 'update',
      instanceId,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to update instance tags', corsHeaders, 500)
  }
}
