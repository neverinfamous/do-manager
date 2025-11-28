import type { Env, CorsHeaders, Instance, Namespace } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, nowISO, createJob, completeJob, failJob } from '../utils/helpers'

/**
 * Mock alarm data for local development
 */
const MOCK_ALARMS: Record<string, number | null> = {
  'inst-1': Date.now() + 3600000, // 1 hour from now
  'inst-2': null,
  'inst-3': null,
}

/**
 * Handle alarm routes
 */
export async function handleAlarmRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/instances/:id/alarm - Get current alarm
  const alarmMatch = path.match(/^\/api\/instances\/([^/]+)\/alarm$/)
  if (method === 'GET' && alarmMatch) {
    const instanceId = alarmMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return getAlarm(instanceId, env, corsHeaders, isLocalDev)
  }

  // PUT /api/instances/:id/alarm - Set alarm
  if (method === 'PUT' && alarmMatch) {
    const instanceId = alarmMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return setAlarm(request, instanceId, env, corsHeaders, isLocalDev, userEmail)
  }

  // DELETE /api/instances/:id/alarm - Delete alarm
  if (method === 'DELETE' && alarmMatch) {
    const instanceId = alarmMatch[1]
    if (!instanceId) {
      return errorResponse('Instance ID required', corsHeaders, 400)
    }
    return deleteAlarm(instanceId, env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * Get current alarm
 */
async function getAlarm(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    const alarm = MOCK_ALARMS[instanceId]
    return jsonResponse({
      alarm: alarm ?? null,
      hasAlarm: alarm !== null && alarm !== undefined,
      alarmDate: alarm ? new Date(alarm).toISOString() : null,
    }, corsHeaders)
  }

  try {
    // Get instance and namespace info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace) {
      return errorResponse('Namespace not found', corsHeaders, 404)
    }

    if (!namespace.endpoint_url) {
      return jsonResponse({
        alarm: null,
        hasAlarm: false,
        alarmDate: null,
        warning: 'Admin hook endpoint not configured. Go to namespace settings to configure the endpoint URL pointing to your Worker with admin hooks enabled.',
        admin_hook_required: true,
      }, corsHeaders)
    }

    if (namespace.admin_hook_enabled !== 1) {
      return jsonResponse({
        alarm: null,
        hasAlarm: false,
        alarmDate: null,
        warning: 'Admin hook is not enabled for this namespace. Enable it in namespace settings after adding admin hook methods to your DO class.',
        admin_hook_required: true,
      }, corsHeaders)
    }

    // Normalize endpoint URL (remove trailing slash)
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/alarm`

    console.log('[Alarms] Calling admin hook:', adminUrl)

    // Call the DO's admin hook
    const response = await fetch(adminUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[Alarms] Admin hook error:', response.status, errorText)
      return jsonResponse({
        alarm: null,
        hasAlarm: false,
        alarmDate: null,
        error: `Admin hook returned ${response.status}. Ensure your DO class has alarm admin hook methods.`,
        details: errorText.slice(0, 200),
      }, corsHeaders)
    }

    const data = await response.json() as { alarm: number | null }
    return jsonResponse({
      alarm: data.alarm,
      hasAlarm: data.alarm !== null,
      alarmDate: data.alarm ? new Date(data.alarm).toISOString() : null,
    }, corsHeaders)
  } catch (error) {
    console.error('[Alarms] Get error:', error)
    return jsonResponse({
      alarm: null,
      hasAlarm: false,
      alarmDate: null,
      error: `Failed to connect to admin hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, corsHeaders)
  }
}

/**
 * Set alarm
 */
async function setAlarm(
  request: Request,
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null
): Promise<Response> {
  const body = await parseJsonBody<{ timestamp: number }>(request)
  if (!body?.timestamp || typeof body.timestamp !== 'number') {
    return errorResponse('timestamp (number) is required', corsHeaders, 400)
  }

  if (body.timestamp < Date.now()) {
    return errorResponse('Alarm timestamp must be in the future', corsHeaders, 400)
  }

  if (isLocalDev) {
    MOCK_ALARMS[instanceId] = body.timestamp

    // Update has_alarm in mock
    return jsonResponse({
      success: true,
      alarm: body.timestamp,
      alarmDate: new Date(body.timestamp).toISOString(),
    }, corsHeaders)
  }

  try {
    // Get instance and namespace info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse(
        'Admin hook not configured or enabled. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    const jobId = await createJob(env.METADATA, 'set_alarm', userEmail, instance.namespace_id, instanceId)

    // Normalize endpoint URL and build admin URL
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/alarm`

    // Call the DO's admin hook
    const response = await fetch(adminUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timestamp: body.timestamp }),
    })

    if (!response.ok) {
      await failJob(env.METADATA, jobId, `Failed to set alarm: ${response.status}`)
      return errorResponse('Failed to set alarm on DO', corsHeaders, response.status)
    }

    // Update has_alarm in metadata
    await env.METADATA.prepare(
      'UPDATE instances SET has_alarm = 1, updated_at = ? WHERE id = ?'
    ).bind(nowISO(), instanceId).run()

    await completeJob(env.METADATA, jobId, { timestamp: body.timestamp, alarmDate: new Date(body.timestamp).toISOString() })
    return jsonResponse({
      success: true,
      alarm: body.timestamp,
      alarmDate: new Date(body.timestamp).toISOString(),
    }, corsHeaders)
  } catch (error) {
    console.error('[Alarms] Set error:', error)
    return errorResponse('Failed to set alarm', corsHeaders, 500)
  }
}

/**
 * Delete alarm
 */
async function deleteAlarm(
  instanceId: string,
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    MOCK_ALARMS[instanceId] = null
    return jsonResponse({ success: true }, corsHeaders)
  }

  try {
    // Get instance and namespace info
    const instance = await env.METADATA.prepare(
      'SELECT * FROM instances WHERE id = ?'
    ).bind(instanceId).first<Instance>()

    if (!instance) {
      return errorResponse('Instance not found', corsHeaders, 404)
    }

    const namespace = await env.METADATA.prepare(
      'SELECT * FROM namespaces WHERE id = ?'
    ).bind(instance.namespace_id).first<Namespace>()

    if (!namespace?.endpoint_url || namespace.admin_hook_enabled !== 1) {
      return errorResponse(
        'Admin hook not configured or enabled. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Normalize endpoint URL and build admin URL
    const baseUrl = namespace.endpoint_url.replace(/\/+$/, '')
    const instanceName = instance.name || instance.object_id
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(instanceName)}/alarm`

    // Call the DO's admin hook
    const response = await fetch(adminUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return errorResponse('Failed to delete alarm on DO', corsHeaders, response.status)
    }

    // Update has_alarm in metadata
    await env.METADATA.prepare(
      'UPDATE instances SET has_alarm = 0, updated_at = ? WHERE id = ?'
    ).bind(nowISO(), instanceId).run()

    return jsonResponse({ success: true }, corsHeaders)
  } catch (error) {
    console.error('[Alarms] Delete error:', error)
    return errorResponse('Failed to delete alarm', corsHeaders, 500)
  }
}

