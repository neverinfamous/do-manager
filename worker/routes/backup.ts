import type { Env, CorsHeaders, Instance, Namespace, Backup } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO } from '../utils/helpers'

/**
 * Helper to update job status
 */
async function updateJobStatus(
  env: Env,
  jobId: string,
  status: 'completed' | 'failed' | 'cancelled',
  error?: string | null,
  result?: string | null
): Promise<void> {
  try {
    await env.METADATA.prepare(`
      UPDATE jobs SET status = ?, progress = ?, error = ?, result = ?, completed_at = ?
      WHERE id = ?
    `).bind(status, status === 'completed' ? 100 : 0, error ?? null, result ?? null, nowISO(), jobId).run()
  } catch (updateError) {
    console.error('[Jobs] Failed to update status:', updateError)
  }
}

/**
 * Mock backups for local development
 */
const MOCK_BACKUPS: Backup[] = [
  {
    id: 'backup-1',
    instance_id: 'inst-1',
    namespace_id: 'ns-1',
    r2_key: 'backups/ns-1/inst-1/2024-03-01T10-00-00.json',
    size_bytes: 1024,
    storage_type: 'sqlite',
    created_by: 'dev@localhost',
    created_at: '2024-03-01T10:00:00Z',
    metadata: JSON.stringify({ keys: 3, tables: 2 }),
  },
  {
    id: 'backup-2',
    instance_id: 'inst-1',
    namespace_id: 'ns-1',
    r2_key: 'backups/ns-1/inst-1/2024-03-02T14-30-00.json',
    size_bytes: 2048,
    storage_type: 'sqlite',
    created_by: 'dev@localhost',
    created_at: '2024-03-02T14:30:00Z',
    metadata: JSON.stringify({ keys: 5, tables: 2 }),
  },
]

/**
 * Handle backup routes
 */
export async function handleBackupRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/backups - List all backups
  if (method === 'GET' && path === '/api/backups') {
    return listBackups(env, url, corsHeaders, isLocalDev)
  }

  // GET /api/instances/:id/backups - List backups for instance
  const instanceBackupsMatch = path.match(/^\/api\/instances\/([^/]+)\/backups$/)
  if (method === 'GET' && instanceBackupsMatch) {
    const instanceId = instanceBackupsMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return listInstanceBackups(instanceId, env, corsHeaders, isLocalDev)
  }

  // POST /api/instances/:id/backup - Create backup
  if (method === 'POST' && instanceBackupsMatch) {
    const instanceId = instanceBackupsMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return createBackup(instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // POST /api/instances/:id/restore/:backupId - Restore from backup
  const restoreMatch = path.match(/^\/api\/instances\/([^/]+)\/restore\/([^/]+)$/)
  if (method === 'POST' && restoreMatch) {
    const instanceId = restoreMatch[1]
    const backupId = restoreMatch[2]
    if (!instanceId || !backupId) {
      return errorResponse('Instance ID and Backup ID required', corsHeaders, 400)
    }
    return restoreBackup(instanceId, backupId, env, corsHeaders, isLocalDev, userEmail)
  }

  // DELETE /api/backups/:id - Delete backup
  const deleteMatch = path.match(/^\/api\/backups\/([^/]+)$/)
  if (method === 'DELETE' && deleteMatch) {
    const backupId = deleteMatch[1]
    if (!backupId) {
      return errorResponse('Backup ID required', corsHeaders, 400)
    }
    return deleteBackup(backupId, env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * List all backups
 */
async function listBackups(
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  const namespaceId = url.searchParams.get('namespace_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

  if (isLocalDev) {
    let filtered = [...MOCK_BACKUPS]
    if (namespaceId) {
      filtered = filtered.filter((b) => b.namespace_id === namespaceId)
    }
    return jsonResponse({ backups: filtered.slice(0, limit) }, corsHeaders)
  }

  try {
    let query = 'SELECT * FROM backups WHERE 1=1'
    const params: (string | number)[] = []

    if (namespaceId) {
      query += ' AND namespace_id = ?'
      params.push(namespaceId)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const result = await env.METADATA.prepare(query).bind(...params).all<Backup>()

    return jsonResponse({ backups: result.results }, corsHeaders)
  } catch (error) {
    console.error('[Backups] List error:', error)
    return errorResponse('Failed to list backups', corsHeaders, 500)
  }
}

/**
 * List backups for a specific instance
 */
async function listInstanceBackups(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const filtered = MOCK_BACKUPS.filter((b) => b.instance_id === instanceId)
    return jsonResponse({ backups: filtered }, corsHeaders)
  }

  try {
    const result = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE instance_id = ? ORDER BY created_at DESC'
    ).bind(instanceId).all<Backup>()

    return jsonResponse({ backups: result.results }, corsHeaders)
  } catch (error) {
    console.error('[Backups] List instance error:', error)
    return errorResponse('Failed to list backups', corsHeaders, 500)
  }
}

/**
 * Create a backup
 */
async function createBackup(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    const newBackup: Backup = {
      id: generateId(),
      instance_id: instanceId,
      namespace_id: 'ns-1',
      r2_key: `backups/ns-1/${instanceId}/${new Date().toISOString().replace(/:/g, '-')}.json`,
      size_bytes: Math.floor(Math.random() * 10000),
      storage_type: 'sqlite',
      created_by: userEmail,
      created_at: nowISO(),
      metadata: JSON.stringify({ keys: Math.floor(Math.random() * 10), tables: 2 }),
    }
    MOCK_BACKUPS.unshift(newBackup)
    return jsonResponse({ backup: newBackup }, corsHeaders, 201)
  }

  // Create job record
  const jobId = generateId()
  const now = nowISO()

  try {
    await env.METADATA.prepare(`
      INSERT INTO jobs (id, type, status, namespace_id, instance_id, user_email, progress, created_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(jobId, 'backup', 'running', null, instanceId, userEmail, 0, now, now).run()
  } catch (jobError) {
    console.error('[Backups] Failed to create job:', jobError)
  }

  try {
    // Get instance info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      await updateJobStatus(env, jobId, 'failed', 'Instance not found')
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      await updateJobStatus(env, jobId, 'failed', 'Namespace endpoint not configured')
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Update job with namespace info
    await env.METADATA.prepare(
      'UPDATE jobs SET namespace_id = ?, progress = ? WHERE id = ?'
    ).bind(instance.namespace_id, 25, jobId).run()

    // Fetch storage data from DO (use name if available, otherwise object_id)
    const instanceName = instance.name || instance.object_id
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const storageResponse = await fetch(
      `${baseUrl}/admin/${encodeURIComponent(instanceName)}/export`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!storageResponse.ok) {
      const errorText = await storageResponse.text().catch(() => 'Unknown error')
      await updateJobStatus(env, jobId, 'failed', `Export failed: ${String(storageResponse.status)} - ${errorText.slice(0, 100)}`)
      return errorResponse('Failed to export storage from DO', corsHeaders, storageResponse.status)
    }

    // Update progress
    await env.METADATA.prepare(
      'UPDATE jobs SET progress = ? WHERE id = ?'
    ).bind(50, jobId).run()

    const storageData = await storageResponse.text()
    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const r2Key = `backups/${instance.namespace_id}/${instanceId}/${timestamp}.json`

    // Store in R2
    await env.BACKUP_BUCKET.put(r2Key, storageData, {
      customMetadata: {
        instanceId,
        namespaceId: instance.namespace_id,
        createdBy: userEmail ?? 'unknown',
        storageBackend: namespace.storage_backend,
      },
    })

    // Update progress
    await env.METADATA.prepare(
      'UPDATE jobs SET progress = ? WHERE id = ?'
    ).bind(75, jobId).run()

    // Record backup in D1
    const backupId = generateId()

    await env.METADATA.prepare(`
      INSERT INTO backups (id, instance_id, namespace_id, r2_key, size_bytes, storage_type, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      backupId,
      instanceId,
      instance.namespace_id,
      r2Key,
      storageData.length,
      namespace.storage_backend,
      userEmail,
      nowISO()
    ).run()

    const backup = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE id = ?'
    ).bind(backupId).first<Backup>()

    // Mark job complete
    await updateJobStatus(env, jobId, 'completed', null, JSON.stringify({ backup_id: backupId, size: storageData.length }))

    return jsonResponse({ backup }, corsHeaders, 201)
  } catch (error) {
    console.error('[Backups] Create error:', error)
    await updateJobStatus(env, jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse('Failed to create backup', corsHeaders, 500)
  }
}

/**
 * Restore from backup
 */
async function restoreBackup(
  instanceId: string,
  backupId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({
      success: true,
      message: 'Restore completed (mock mode)',
    }, corsHeaders)
  }

  // Create job record
  const jobId = generateId()
  const now = nowISO()

  try {
    await env.METADATA.prepare(`
      INSERT INTO jobs (id, type, status, namespace_id, instance_id, user_email, progress, created_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(jobId, 'restore', 'running', null, instanceId, userEmail, 0, now, now).run()
  } catch (jobError) {
    console.error('[Backups] Failed to create job:', jobError)
  }

  try {
    // Get backup info
    const backup = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE id = ?'
    ).bind(backupId).first<Backup>()

    if (!backup) {
      await updateJobStatus(env, jobId, 'failed', 'Backup not found')
      return errorResponse('Backup not found', corsHeaders, 404)
    }

    // Get instance info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      await updateJobStatus(env, jobId, 'failed', 'Instance not found')
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      await updateJobStatus(env, jobId, 'failed', 'Namespace endpoint not configured')
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Update job with namespace info
    await env.METADATA.prepare(
      'UPDATE jobs SET namespace_id = ?, progress = ? WHERE id = ?'
    ).bind(instance.namespace_id, 25, jobId).run()

    // Fetch backup data from R2
    const r2Object = await env.BACKUP_BUCKET.get(backup.r2_key)
    if (!r2Object) {
      await updateJobStatus(env, jobId, 'failed', 'Backup file not found in R2')
      return errorResponse('Backup file not found in R2', corsHeaders, 404)
    }

    // Update progress
    await env.METADATA.prepare(
      'UPDATE jobs SET progress = ? WHERE id = ?'
    ).bind(50, jobId).run()

    const backupData = await r2Object.text()

    // Send restore request to DO (use name if available, otherwise object_id)
    const instanceName = instance.name || instance.object_id
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const restoreResponse = await fetch(
      `${baseUrl}/admin/${encodeURIComponent(instanceName)}/import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: backupData,
      }
    )

    if (!restoreResponse.ok) {
      const errorText = await restoreResponse.text().catch(() => 'Unknown error')
      await updateJobStatus(env, jobId, 'failed', `Import failed: ${String(restoreResponse.status)} - ${errorText.slice(0, 100)}`)
      return errorResponse('Failed to restore storage to DO', corsHeaders, restoreResponse.status)
    }

    // Mark job complete
    await updateJobStatus(env, jobId, 'completed', null, JSON.stringify({ backup_id: backupId }))

    return jsonResponse({
      success: true,
      message: 'Restore completed successfully',
    }, corsHeaders)
  } catch (error) {
    console.error('[Backups] Restore error:', error)
    await updateJobStatus(env, jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse('Failed to restore backup', corsHeaders, 500)
  }
}

/**
 * Delete a backup
 */
async function deleteBackup(
  backupId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const index = MOCK_BACKUPS.findIndex((b) => b.id === backupId)
    if (index >= 0) {
      MOCK_BACKUPS.splice(index, 1)
    }
    return jsonResponse({ success: true }, corsHeaders)
  }

  try {
    // Get backup info
    const backup = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE id = ?'
    ).bind(backupId).first<Backup>()

    if (!backup) {
      return errorResponse('Backup not found', corsHeaders, 404)
    }

    // Delete from R2
    await env.BACKUP_BUCKET.delete(backup.r2_key)

    // Delete from D1
    await env.METADATA.prepare(
      'DELETE FROM backups WHERE id = ?'
    ).bind(backupId).run()

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    console.error('[Backups] Delete error:', error)
    return errorResponse('Failed to delete backup', corsHeaders, 500)
  }
}

