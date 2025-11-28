import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, BarChart3, Database, Clock, TrendingUp } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { metricsApi, type MetricsData } from '../../services/metricsApi'

interface MetricsDashboardProps {
  namespaceId?: string
}

export function MetricsDashboard({
  namespaceId,
}: MetricsDashboardProps): React.ReactElement {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [days, setDays] = useState(7)

  const loadMetrics = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = namespaceId
        ? await metricsApi.getNamespaceMetrics(namespaceId, days)
        : await metricsApi.getAccountMetrics(days)
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [namespaceId, days])

  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${String(bytes)} B`
  }

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
    return `${ms.toFixed(0)}ms`
  }

  const getStoragePercentage = (): number => {
    if (!metrics) return 0
    return (metrics.storage.totalBytes / metrics.storage.maxBytes) * 100
  }

  const maxRequests = metrics?.invocations.byDay.reduce(
    (max, day) => Math.max(max, day.requests),
    1
  ) ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Durable Objects performance and usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm border rounded-md bg-background"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <Button
            variant="outline"
            onClick={() => void loadMetrics()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning */}
      {metrics?.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-600 dark:text-yellow-400 px-4 py-3 rounded-lg">
          <p className="font-medium">⚠️ Metrics Unavailable</p>
          <p className="text-sm mt-1">{metrics.warning}</p>
        </div>
      )}

      {/* Loading */}
      {loading && !metrics && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Requests */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Total Requests</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatNumber(metrics.invocations.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {days} days
                </p>
              </CardContent>
            </Card>

            {/* Storage Used */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Storage Used</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatBytes(metrics.storage.totalBytes)}
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${String(Math.min(getStoragePercentage(), 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getStoragePercentage().toFixed(2)}% of {formatBytes(metrics.storage.maxBytes)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Avg CPU Time */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Avg CPU Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatDuration(metrics.duration.p50)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per request average
                </p>
              </CardContent>
            </Card>

            {/* Total CPU Time */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-sm">Total CPU Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatDuration(metrics.duration.totalMs ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {days} days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Requests Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>Requests Over Time</CardTitle>
              </div>
              <CardDescription>Daily request volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-1">
                {metrics.invocations.byDay.map((day, index) => (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/80 hover:bg-primary rounded-t transition-all"
                      style={{
                        height: `${String((day.requests / maxRequests) * 100)}%`,
                        minHeight: day.requests > 0 ? '4px' : '0',
                      }}
                      title={`${day.requests.toLocaleString()} requests`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CPU Time Summary */}
          <Card>
            <CardHeader>
              <CardTitle>CPU Time Summary</CardTitle>
              <CardDescription>Compute usage over the period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatDuration(metrics.duration.totalMs ?? 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total CPU Time</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatDuration(metrics.duration.p50)}
                  </div>
                  <p className="text-sm text-muted-foreground">Avg per Request</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {metrics.invocations.total.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

