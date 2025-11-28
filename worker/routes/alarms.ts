import type { Env, CorsHeaders, Instance, Namespace } from '../types'
import { jsonResponse, errorResponse, parseJsonBody, nowISO } from '../utils/helpers'

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
  _userEmail: string | null
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
    return setAlarm(request, instanceId, env, corsHeaders, isLocalDev)
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

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Call the DO's admin hook
    const response = await fetch(`${namespace.endpoint_url}/admin/${instance.object_id}/alarm`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return errorResponse('Failed to fetch alarm from DO', corsHeaders, response.status)
    }

    const data = await response.json() as { alarm: number | null }
    return jsonResponse({
      alarm: data.alarm,
      hasAlarm: data.alarm !== null,
      alarmDate: data.alarm ? new Date(data.alarm).toISOString() : null,
    }, corsHeaders)
  } catch (error) {
    console.error('[Alarms] Get error:', error)
    return errorResponse('Failed to get alarm', corsHeaders, 500)
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
  isLocalDev: boolean
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

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Call the DO's admin hook
    const response = await fetch(`${namespace.endpoint_url}/admin/${instance.object_id}/alarm`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timestamp: body.timestamp }),
    })

    if (!response.ok) {
      return errorResponse('Failed to set alarm on DO', corsHeaders, response.status)
    }

    // Update has_alarm in metadata
    await env.METADATA.prepare(
      'UPDATE instances SET has_alarm = 1, updated_at = ? WHERE id = ?'
    ).bind(nowISO(), instanceId).run()

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

    if (!namespace?.endpoint_url) {
      return errorResponse(
        'Namespace endpoint not configured. Set up admin hook first.',
        corsHeaders,
        400
      )
    }

    // Call the DO's admin hook
    const response = await fetch(`${namespace.endpoint_url}/admin/${instance.object_id}/alarm`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`,
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

