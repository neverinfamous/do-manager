import type { Env, CorsHeaders, Instance, Namespace, Backup } from '../types'
import { jsonResponse, errorResponse, generateId, nowISO, parseJsonBody } from '../utils/helpers'

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
    return restoreBackup(instanceId, backupId, env, corsHeaders, isLocalDev)
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

  try {
    // Get instance info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Fetch storage data from DO
    const storageResponse = await fetch(
      `${namespace.endpoint_url}/admin/${instance.object_id}/export`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!storageResponse.ok) {
      return errorResponse('Failed to export storage from DO', corsHeaders, storageResponse.status)
    }

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

    // Record backup in D1
    const backupId = generateId()
    const now = nowISO()

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
      now
    ).run()

    const backup = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE id = ?'
    ).bind(backupId).first<Backup>()

    return jsonResponse({ backup }, corsHeaders, 201)
  } catch (error) {
    console.error('[Backups] Create error:', error)
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
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse({
      success: true,
      message: 'Restore completed (mock mode)',
    }, corsHeaders)
  }

  try {
    // Get backup info
    const backup = await env.METADATA.prepare(
      'SELECT * FROM backups WHERE id = ?'
    ).bind(backupId).first<Backup>()

    if (!backup) {
      return errorResponse('Backup not found', corsHeaders, 404)
    }

    // Get instance info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    // Get namespace info
    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Fetch backup data from R2
    const r2Object = await env.BACKUP_BUCKET.get(backup.r2_key)
    if (!r2Object) {
      return errorResponse('Backup file not found in R2', corsHeaders, 404)
    }

    const backupData = await r2Object.text()

    // Send restore request to DO
    const restoreResponse = await fetch(
      `${namespace.endpoint_url}/admin/${instance.object_id}/import`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: backupData,
      }
    )

    if (!restoreResponse.ok) {
      return errorResponse('Failed to restore storage to DO', corsHeaders, restoreResponse.status)
    }

    return jsonResponse({
      success: true,
      message: 'Restore completed successfully',
    }, corsHeaders)
  } catch (error) {
    console.error('[Backups] Restore error:', error)
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

