import type { Env, CorsHeaders } from '../types'
import { jsonResponse, errorResponse, nowISO, generateId } from '../utils/helpers'
import { logInfo, logWarning } from '../utils/error-logger'

/**
 * Storage quota constants (10GB DO limit)
 */
const STORAGE_QUOTA = {
  MAX_BYTES: 10 * 1024 * 1024 * 1024, // 10GB
  WARNING_THRESHOLD: 0.8, // 80%
  CRITICAL_THRESHOLD: 0.9, // 90%
}

/**
 * Health summary response
 */
interface HealthSummary {
  namespaces: {
    total: number
    withEndpoint: number
  }
  instances: {
    total: number
    withAlarms: number
    stale: number // Not accessed in 7+ days
    highStorage: number // Above 80% of 10GB limit
  }
  storage: {
    totalBytes: number
    avgPerInstance: number
  }
  activeAlarms: ActiveAlarmInfo[]
  completedAlarms: CompletedAlarmInfo[]
  staleInstances: StaleInstance[]
  highStorageInstances: HighStorageInstance[]
  recentJobs: {
    last24h: number
    last7d: number
    failedLast24h: number
  }
}

interface ActiveAlarmInfo {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  scheduledTime: string
  createdAt: string
}

interface CompletedAlarmInfo {
  instanceId: string
  instanceName: string
  namespaceId: string
  namespaceName: string
  scheduledTime: string
  completedAt: string
  status: 'completed' | 'cancelled'
}

interface StaleInstance {
  id: string
  name: string
  namespaceId: string
  namespaceName: string
  lastAccessed: string | null
  daysSinceAccess: number
}

interface HighStorageInstance {
  id: string
  name: string
  namespaceId: string
  namespaceName: string
  storageSizeBytes: number
  percentUsed: number
  level: 'warning' | 'critical'
}

/**
 * Mock health data for local development
 */
const MOCK_HEALTH: HealthSummary = {
  namespaces: {
    total: 5,
    withEndpoint: 3,
  },
  instances: {
    total: 15,
    withAlarms: 2,
    stale: 4,
    highStorage: 2,
  },
  storage: {
    totalBytes: 1048576 * 25, // 25 MB
    avgPerInstance: 1048576 * 25 / 15,
  },
  activeAlarms: [
    {
      instanceId: 'inst-1',
      instanceName: 'user-session-abc123',
      namespaceId: 'ns-1',
      namespaceName: 'SessionStore',
      scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    },
    {
      instanceId: 'inst-2',
      instanceName: 'task-worker-xyz789',
      namespaceId: 'ns-2',
      namespaceName: 'TaskQueue',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
  ],
  completedAlarms: [
    {
      instanceId: 'inst-3',
      instanceName: 'cleanup-task-001',
      namespaceId: 'ns-2',
      namespaceName: 'TaskQueue',
      scheduledTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      completedAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed',
    },
  ],
  staleInstances: [
    {
      id: 'inst-10',
      name: 'old-cache-001',
      namespaceId: 'ns-1',
      namespaceName: 'CacheStore',
      lastAccessed: new Date(Date.now() - 86400000 * 14).toISOString(), // 14 days ago
      daysSinceAccess: 14,
    },
    {
      id: 'inst-11',
      name: 'archived-session-002',
      namespaceId: 'ns-1',
      namespaceName: 'SessionStore',
      lastAccessed: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
      daysSinceAccess: 10,
    },
  ],
  highStorageInstances: [
    {
      id: 'inst-20',
      name: 'large-data-store',
      namespaceId: 'ns-3',
      namespaceName: 'DataStore',
      storageSizeBytes: 9.5 * 1024 * 1024 * 1024, // 9.5 GB
      percentUsed: 95,
      level: 'critical',
    },
    {
      id: 'inst-21',
      name: 'media-cache-001',
      namespaceId: 'ns-3',
      namespaceName: 'MediaCache',
      storageSizeBytes: 8.2 * 1024 * 1024 * 1024, // 8.2 GB
      percentUsed: 82,
      level: 'warning',
    },
  ],
  recentJobs: {
    last24h: 25,
    last7d: 142,
    failedLast24h: 2,
  },
}

/**
 * Handle health routes
 */
export async function handleHealthRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  _userEmail: string | null
): Promise<Response> {
  const method = request.method
  const path = url.pathname

  // GET /api/health - Get health summary
  if (method === 'GET' && path === '/api/health') {
    return getHealthSummary(env, corsHeaders, isLocalDev)
  }

  return errorResponse('Not Found', corsHeaders, 404)
}

/**
 * Check for alarms that have passed their scheduled time and mark them as completed
 * Exported so it can be called from other routes (e.g., when listing instances)
 */
export async function detectCompletedAlarms(env: Env): Promise<void> {
  try {
    const now = nowISO()

    // Find scheduled alarms where the scheduled time has passed
    // If the time has passed and status is still 'scheduled', the alarm must have fired
    // (If it was manually cancelled, it would already have status = 'cancelled')
    const expiredAlarms = await env.METADATA.prepare(`
      SELECT 
        ah.id,
        ah.instance_id,
        ah.namespace_id,
        ah.scheduled_time,
        ah.created_by,
        COALESCE(i.name, i.object_id) as instance_name,
        n.name as namespace_name
      FROM alarm_history ah
      JOIN instances i ON ah.instance_id = i.id
      JOIN namespaces n ON ah.namespace_id = n.id
      WHERE ah.status = 'scheduled'
        AND datetime(ah.scheduled_time) < datetime('now')
    `).all<{
      id: string
      instance_id: string
      namespace_id: string
      scheduled_time: string
      created_by: string | null
      instance_name: string
      namespace_name: string
    }>()

    // Mark these alarms as completed and create job entries
    for (const alarm of expiredAlarms.results) {
      // Mark alarm as completed
      await env.METADATA.prepare(
        'UPDATE alarm_history SET status = ?, completed_at = ? WHERE id = ?'
      ).bind('completed', now, alarm.id).run()

      // Update instance has_alarm to 0 since the alarm has fired
      await env.METADATA.prepare(
        'UPDATE instances SET has_alarm = 0, updated_at = ? WHERE id = ?'
      ).bind(now, alarm.instance_id).run()

      // Create a job entry for the completed alarm
      const jobId = generateId()
      await env.METADATA.prepare(`
        INSERT INTO jobs (id, type, status, namespace_id, instance_id, user_email, progress, result, created_at, started_at, completed_at)
        VALUES (?, 'alarm_completed', 'completed', ?, ?, ?, 100, ?, ?, ?, ?)
      `).bind(
        jobId,
        alarm.namespace_id,
        alarm.instance_id,
        alarm.created_by,
        JSON.stringify({
          scheduled_time: alarm.scheduled_time,
          instance_name: alarm.instance_name,
          namespace_name: alarm.namespace_name,
        }),
        alarm.scheduled_time, // Use scheduled time as created_at (when alarm was supposed to fire)
        alarm.scheduled_time, // started_at
        now // completed_at (when we detected it)
      ).run()
    }

    if (expiredAlarms.results.length > 0) {
      logInfo(`Marked ${String(expiredAlarms.results.length)} alarm(s) as completed`, {
        module: 'health',
        operation: 'detect_completed_alarms',
        metadata: { count: expiredAlarms.results.length }
      })
    }
  } catch (error) {
    logWarning(`Failed to detect completed alarms: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'health',
      operation: 'detect_completed_alarms',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
  }
}

/**
 * Get health summary
 */
async function getHealthSummary(
  env: Env,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean
): Promise<Response> {
  if (isLocalDev) {
    return jsonResponse(MOCK_HEALTH, corsHeaders)
  }

  try {
    // First, detect any alarms that have completed
    await detectCompletedAlarms(env)

    // Calculate thresholds
    const warningThresholdBytes = Math.floor(STORAGE_QUOTA.MAX_BYTES * STORAGE_QUOTA.WARNING_THRESHOLD)
    const criticalThresholdBytes = Math.floor(STORAGE_QUOTA.MAX_BYTES * STORAGE_QUOTA.CRITICAL_THRESHOLD)

    // Batch parallel D1 queries for performance (max 8 concurrent)
    const [
      namespaceResult,
      instanceResult,
      storageResult,
      activeAlarmsResult,
      completedAlarmsResult,
      staleResult,
      highStorageResult,
      jobsResult,
    ] = await Promise.all([
      // Query 1: Namespace counts
      env.METADATA.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN endpoint_url IS NOT NULL AND endpoint_url != '' THEN 1 ELSE 0 END) as withEndpoint
        FROM namespaces
      `).first<{ total: number; withEndpoint: number }>(),

      // Query 2: Instance counts
      env.METADATA.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN has_alarm = 1 THEN 1 ELSE 0 END) as withAlarms,
          SUM(CASE WHEN last_accessed IS NOT NULL AND datetime(last_accessed) < datetime('now', '-7 days') THEN 1 ELSE 0 END) as stale,
          SUM(CASE WHEN storage_size_bytes IS NOT NULL AND storage_size_bytes >= ? THEN 1 ELSE 0 END) as highStorage
        FROM instances
      `).bind(warningThresholdBytes).first<{ total: number; withAlarms: number; stale: number; highStorage: number }>(),

      // Query 3: Storage stats
      env.METADATA.prepare(`
        SELECT 
          COALESCE(SUM(storage_size_bytes), 0) as totalBytes
        FROM instances
      `).first<{ totalBytes: number }>(),

      // Query 4: Active alarms
      env.METADATA.prepare(`
        SELECT 
          ah.instance_id as instanceId,
          COALESCE(i.name, i.object_id) as instanceName,
          ah.namespace_id as namespaceId,
          n.name as namespaceName,
          ah.scheduled_time as scheduledTime,
          ah.created_at as createdAt
        FROM alarm_history ah
        JOIN instances i ON ah.instance_id = i.id
        JOIN namespaces n ON ah.namespace_id = n.id
        WHERE ah.status = 'scheduled'
        ORDER BY ah.scheduled_time ASC
        LIMIT 20
      `).all<{
        instanceId: string
        instanceName: string
        namespaceId: string
        namespaceName: string
        scheduledTime: string
        createdAt: string
      }>(),

      // Query 5: Completed alarms (last 24 hours)
      env.METADATA.prepare(`
        SELECT 
          ah.instance_id as instanceId,
          COALESCE(i.name, i.object_id) as instanceName,
          ah.namespace_id as namespaceId,
          n.name as namespaceName,
          ah.scheduled_time as scheduledTime,
          ah.completed_at as completedAt,
          ah.status
        FROM alarm_history ah
        JOIN instances i ON ah.instance_id = i.id
        JOIN namespaces n ON ah.namespace_id = n.id
        WHERE ah.status IN ('completed', 'cancelled')
          AND datetime(ah.completed_at) > datetime('now', '-24 hours')
        ORDER BY ah.completed_at DESC
        LIMIT 10
      `).all<{
        instanceId: string
        instanceName: string
        namespaceId: string
        namespaceName: string
        scheduledTime: string
        completedAt: string
        status: string
      }>(),

      // Query 6: Stale instances
      env.METADATA.prepare(`
        SELECT 
          i.id,
          COALESCE(i.name, i.object_id) as name,
          i.namespace_id as namespaceId,
          n.name as namespaceName,
          i.last_accessed as lastAccessed,
          CAST(julianday('now') - julianday(i.last_accessed) AS INTEGER) as daysSinceAccess
        FROM instances i
        JOIN namespaces n ON i.namespace_id = n.id
        WHERE i.last_accessed IS NOT NULL 
          AND datetime(i.last_accessed) < datetime('now', '-7 days')
        ORDER BY i.last_accessed ASC
        LIMIT 10
      `).all<{
        id: string
        name: string
        namespaceId: string
        namespaceName: string
        lastAccessed: string | null
        daysSinceAccess: number
      }>(),

      // Query 7: High storage instances
      env.METADATA.prepare(`
        SELECT 
          i.id,
          COALESCE(i.name, i.object_id) as name,
          i.namespace_id as namespaceId,
          n.name as namespaceName,
          i.storage_size_bytes as storageSizeBytes
        FROM instances i
        JOIN namespaces n ON i.namespace_id = n.id
        WHERE i.storage_size_bytes IS NOT NULL 
          AND i.storage_size_bytes >= ?
        ORDER BY i.storage_size_bytes DESC
        LIMIT 10
      `).bind(warningThresholdBytes).all<{
        id: string
        name: string
        namespaceId: string
        namespaceName: string
        storageSizeBytes: number
      }>(),

      // Query 8: Job counts
      env.METADATA.prepare(`
        SELECT 
          SUM(CASE WHEN datetime(created_at) > datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h,
          SUM(CASE WHEN datetime(created_at) > datetime('now', '-7 days') THEN 1 ELSE 0 END) as last7d,
          SUM(CASE WHEN datetime(created_at) > datetime('now', '-1 day') AND status = 'failed' THEN 1 ELSE 0 END) as failedLast24h
        FROM jobs
      `).first<{ last24h: number; last7d: number; failedLast24h: number }>(),
    ])

    const totalInstances = instanceResult?.total ?? 0
    const totalBytes = storageResult?.totalBytes ?? 0

    const health: HealthSummary = {
      namespaces: {
        total: namespaceResult?.total ?? 0,
        withEndpoint: namespaceResult?.withEndpoint ?? 0,
      },
      instances: {
        total: totalInstances,
        withAlarms: instanceResult?.withAlarms ?? 0,
        stale: instanceResult?.stale ?? 0,
        highStorage: instanceResult?.highStorage ?? 0,
      },
      storage: {
        totalBytes,
        avgPerInstance: totalInstances > 0 ? totalBytes / totalInstances : 0,
      },
      activeAlarms: activeAlarmsResult.results.map((row) => ({
        instanceId: row.instanceId,
        instanceName: row.instanceName,
        namespaceId: row.namespaceId,
        namespaceName: row.namespaceName,
        scheduledTime: row.scheduledTime,
        createdAt: row.createdAt,
      })),
      completedAlarms: completedAlarmsResult.results.map((row) => ({
        instanceId: row.instanceId,
        instanceName: row.instanceName,
        namespaceId: row.namespaceId,
        namespaceName: row.namespaceName,
        scheduledTime: row.scheduledTime,
        completedAt: row.completedAt,
        status: row.status as 'completed' | 'cancelled',
      })),
      staleInstances: staleResult.results.map((row) => ({
        id: row.id,
        name: row.name,
        namespaceId: row.namespaceId,
        namespaceName: row.namespaceName,
        lastAccessed: row.lastAccessed,
        daysSinceAccess: row.daysSinceAccess,
      })),
      highStorageInstances: highStorageResult.results.map((row) => {
        const percentUsed = Math.round((row.storageSizeBytes / STORAGE_QUOTA.MAX_BYTES) * 100)
        return {
          id: row.id,
          name: row.name,
          namespaceId: row.namespaceId,
          namespaceName: row.namespaceName,
          storageSizeBytes: row.storageSizeBytes,
          percentUsed,
          level: row.storageSizeBytes >= criticalThresholdBytes ? 'critical' as const : 'warning' as const,
        }
      }),
      recentJobs: {
        last24h: jobsResult?.last24h ?? 0,
        last7d: jobsResult?.last7d ?? 0,
        failedLast24h: jobsResult?.failedLast24h ?? 0,
      },
    }

    return jsonResponse(health, corsHeaders)
  } catch (error) {
    logWarning(`Get summary error: ${error instanceof Error ? error.message : String(error)}`, {
      module: 'health',
      operation: 'get_summary',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return errorResponse('Failed to get health summary', corsHeaders, 500)
  }
}
