import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Database,
  Globe,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import {
  metricsApi,
  type DOMetricsResponse,
  type DOMetricsTimeRange,
  type DOInvocationDataPoint,
} from '../../services/metricsApi'
import { DOStorageTab } from './DOStorageTab'
import { DOSubrequestsTab } from './DOSubrequestsTab'

interface MetricsDashboardProps {
  namespaceId?: string
}

const TIME_RANGE_OPTIONS: { value: DOMetricsTimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

/**
 * Format large numbers with K, M, B suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}




/**
 * Format milliseconds to readable latency
 */
function formatLatency(ms: number | undefined): string {
  if (ms === undefined || ms === null) return 'N/A'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(1)}ms`
}

/**
 * Aggregate invocations by date for chart
 */
function aggregateByDate(
  data: DOInvocationDataPoint[]
): { date: string; requests: number; errors: number }[] {
  const byDate = new Map<string, { requests: number; errors: number }>()

  for (const point of data) {
    const existing = byDate.get(point.date)
    if (existing) {
      existing.requests += point.requests
      existing.errors += point.errors
    } else {
      byDate.set(point.date, { requests: point.requests, errors: point.errors })
    }
  }

  return Array.from(byDate.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Enhanced Metrics Dashboard with tabbed interface
 */
export function MetricsDashboard({
  namespaceId: _namespaceId,
}: MetricsDashboardProps): React.ReactElement {
  const [metrics, setMetrics] = useState<DOMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [timeRange, setTimeRange] = useState<DOMetricsTimeRange>('7d')
  const [activeTab, setActiveTab] = useState('invocations')

  const loadMetrics = useCallback(
    async (skipCache?: boolean): Promise<void> => {
      try {
        setLoading(true)
        setError('')
        const data = await metricsApi.getMetrics(timeRange, undefined, skipCache ?? false)
        setMetrics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics')
      } finally {
        setLoading(false)
      }
    },
    [timeRange]
  )


  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  const handleRefresh = (): void => {
    void loadMetrics(true) // skipCache on refresh
  }

  const handleTimeRangeChange = (value: string): void => {
    setTimeRange(value as DOMetricsTimeRange)
  }

  // Prepare chart data
  const chartData = metrics ? aggregateByDate(metrics.invocationsSeries) : []
  const maxRequests = chartData.reduce((max, d) => Math.max(max, d.requests), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Metrics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Durable Objects performance and usage analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
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

      {/* Metrics Content */}
      {metrics && (
        <>
          {/* Summary Cards */}
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
                  {formatNumber(metrics.summary.totalRequests)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.summary.startDate} - {metrics.summary.endDate}
                </p>
              </CardContent>
            </Card>

            {/* Errors */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-sm">Errors</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {formatNumber(metrics.summary.totalErrors)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.summary.totalRequests > 0
                    ? `${((metrics.summary.totalErrors / metrics.summary.totalRequests) * 100).toFixed(2)}% error rate`
                    : 'No requests'}
                </p>
              </CardContent>
            </Card>

            {/* P90 Latency */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">P90 Latency</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatLatency(metrics.summary.avgLatencyMs?.p90)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  P50: {formatLatency(metrics.summary.avgLatencyMs?.p50)} |
                  P99: {formatLatency(metrics.summary.avgLatencyMs?.p99)}
                </p>
              </CardContent>
            </Card>

            {/* CPU Time */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-sm">Total CPU Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatLatency(metrics.summary.totalCpuTimeMs)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Compute time consumed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invocations" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Invocations
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage
              </TabsTrigger>
              <TabsTrigger value="subrequests" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Subrequests
              </TabsTrigger>
            </TabsList>

            {/* Invocations Tab */}
            <TabsContent value="invocations" className="space-y-6 mt-6">
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
                  {chartData.length > 0 ? (
                    <div className="h-48 flex items-end gap-1">
                      {chartData.map((day, index) => (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div
                            className="w-full bg-primary/80 hover:bg-primary rounded-t transition-all"
                            style={{
                              height: `${(day.requests / maxRequests) * 100}%`,
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
                  ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      No invocation data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Per-Namespace Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance by Namespace</CardTitle>
                  <CardDescription>Request volume and latency per DO namespace</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics.byNamespace.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Namespace</th>
                            <th className="text-right py-2 px-3">Requests</th>
                            <th className="text-right py-2 px-3">Errors</th>
                            <th className="text-right py-2 px-3">P50</th>
                            <th className="text-right py-2 px-3">P90</th>
                            <th className="text-right py-2 px-3">P99</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.byNamespace
                            .sort((a, b) => b.totalRequests - a.totalRequests)
                            .map((ns) => (
                              <tr key={ns.scriptName} className="border-b hover:bg-muted/50">
                                <td className="py-2 px-3 font-medium">
                                  {ns.namespaceName ?? ns.scriptName}
                                </td>
                                <td className="text-right py-2 px-3">
                                  {formatNumber(ns.totalRequests)}
                                </td>
                                <td className="text-right py-2 px-3 text-destructive">
                                  {formatNumber(ns.totalErrors)}
                                </td>
                                <td className="text-right py-2 px-3">
                                  {formatLatency(ns.p50LatencyMs)}
                                </td>
                                <td className="text-right py-2 px-3">
                                  {formatLatency(ns.p90LatencyMs)}
                                </td>
                                <td className="text-right py-2 px-3">
                                  {formatLatency(ns.p99LatencyMs)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      No namespace data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Tab */}
            <TabsContent value="storage" className="mt-6">
              <DOStorageTab
                storageSeries={metrics.storageSeries}
                byNamespace={metrics.byNamespace}
                totalStorageBytes={metrics.summary.totalStorageBytes}
                totalStorageKeys={metrics.summary.totalStorageKeys}
              />
            </TabsContent>

            {/* Subrequests Tab */}
            <TabsContent value="subrequests" className="mt-6">
              <DOSubrequestsTab
                subrequestsSeries={metrics.subrequestsSeries}
                byNamespace={metrics.byNamespace}
                totalSubrequests={metrics.summary.totalSubrequests}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
