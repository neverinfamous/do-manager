import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  Box,
  Server,
  Database,
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
  XCircle,
  Timer,
  CheckCircle2,
  Ban,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { healthApi, type HealthSummary, type ActiveAlarmInfo, type CompletedAlarmInfo, type StaleInstance } from '../../services/healthApi'

export function HealthDashboard(): React.ReactElement {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const loadHealth = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await healthApi.getSummary()
      setHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${String(bytes)} B`
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimeUntil = (dateString: string): string => {
    const target = new Date(dateString).getTime()
    const now = Date.now()
    const diff = target - now

    if (diff < 0) return 'Overdue'
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${String(days)}d ${String(hours % 24)}h`
    if (hours > 0) return `${String(hours)}h ${String(minutes % 60)}m`
    return `${String(minutes)}m`
  }

  const formatTimeSince = (dateString: string): string => {
    const target = new Date(dateString).getTime()
    const now = Date.now()
    const diff = now - target

    if (diff < 0) return 'Just now'
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${String(hours)}h ${String(minutes % 60)}m ago`
    return `${String(minutes)}m ago`
  }

  const getHealthScore = (): { score: number; label: string; color: string } => {
    if (!health) return { score: 0, label: 'Unknown', color: 'text-muted-foreground' }

    let issues = 0
    if (health.instances.stale > 0) issues++
    if (health.recentJobs.failedLast24h > 0) issues++
    if (health.namespaces.total > 0 && health.namespaces.withEndpoint === 0) issues++

    if (issues === 0) return { score: 100, label: 'Healthy', color: 'text-green-500' }
    if (issues === 1) return { score: 75, label: 'Good', color: 'text-yellow-500' }
    if (issues === 2) return { score: 50, label: 'Fair', color: 'text-orange-500' }
    return { score: 25, label: 'Needs Attention', color: 'text-red-500' }
  }

  const healthScore = getHealthScore()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Health Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Overview of your Durable Objects system
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadHealth()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !health && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Health Content */}
      {health && (
        <>
          {/* Health Score Banner */}
          <Card className="bg-gradient-to-r from-muted/50 to-muted">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${healthScore.color}`}>
                    {healthScore.score}
                  </div>
                  <div>
                    <div className={`text-xl font-semibold ${healthScore.color}`}>
                      {healthScore.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      System Health Score
                    </div>
                  </div>
                </div>
                <Activity className={`h-12 w-12 ${healthScore.color}`} />
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Namespaces */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Namespaces</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health.namespaces.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.namespaces.withEndpoint} with endpoint configured
                </p>
              </CardContent>
            </Card>

            {/* Instances */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Instances</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health.instances.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.instances.withAlarms} with active alarms
                </p>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Total Storage</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatBytes(health.storage.totalBytes)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ~{formatBytes(health.storage.avgPerInstance)} avg per instance
                </p>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Recent Jobs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health.recentJobs.last24h}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 24h ({health.recentJobs.last7d} last 7d)
                </p>
                {health.recentJobs.failedLast24h > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {health.recentJobs.failedLast24h} failed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alarms Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Alarms */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-yellow-500" />
                  <CardTitle>Active Alarms</CardTitle>
                </div>
                <CardDescription>
                  Scheduled alarms with countdown timers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {health.activeAlarms.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>No active alarms</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {health.activeAlarms.map((alarm: ActiveAlarmInfo) => (
                      <div
                        key={`${alarm.instanceId}-${alarm.scheduledTime}`}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{alarm.instanceName}</div>
                          <div className="text-xs text-muted-foreground">
                            {alarm.namespaceName}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="flex items-center gap-1 text-yellow-500 font-medium">
                            <Timer className="h-4 w-4" />
                            <span>{formatTimeUntil(alarm.scheduledTime)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Set {formatTimeSince(alarm.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fires: {formatDate(alarm.scheduledTime)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completed Alarms */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <CardTitle>Recent Alarm Activity</CardTitle>
                </div>
                <CardDescription>
                  Completed and cancelled alarms (last 24h)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {health.completedAlarms.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Clock className="h-5 w-5" />
                    <span>No recent alarm activity</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {health.completedAlarms.map((alarm: CompletedAlarmInfo) => (
                      <div
                        key={`${alarm.instanceId}-${alarm.completedAt}`}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {alarm.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Ban className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            )}
                            {alarm.instanceName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {alarm.namespaceName}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className={`text-sm font-medium ${
                            alarm.status === 'completed' ? 'text-green-500' : 'text-orange-500'
                          }`}>
                            {alarm.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTimeSince(alarm.completedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stale Instances */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle>Stale Instances</CardTitle>
              </div>
              <CardDescription>
                Not accessed in 7+ days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {health.staleInstances.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>All instances recently active</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {health.staleInstances.map((instance: StaleInstance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{instance.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {instance.namespaceName}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm text-orange-500 font-medium">
                          {instance.daysSinceAccess} days
                        </div>
                        <div className="text-xs text-muted-foreground">
                          since last access
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Quick overview of system configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {health.namespaces.withEndpoint > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">
                    {health.namespaces.withEndpoint}/{health.namespaces.total} endpoints
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {health.instances.stale === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  )}
                  <span className="text-sm">
                    {health.instances.stale} stale instances
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {health.recentJobs.failedLast24h === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">
                    {health.recentJobs.failedLast24h} failed jobs (24h)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className={`h-5 w-5 ${health.instances.withAlarms > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm">
                    {health.instances.withAlarms} active alarms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
