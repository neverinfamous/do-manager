import type { DOSubrequestDataPoint, DONamespaceMetrics } from '../../services/metricsApi'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../ui/card'
import { Globe, ArrowRightLeft, TrendingUp } from 'lucide-react'

interface DOSubrequestsTabProps {
    subrequestsSeries: DOSubrequestDataPoint[]
    byNamespace: DONamespaceMetrics[]
    totalSubrequests: number
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${String(bytes)} B`
}

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
 * DO Subrequests Tab - Displays external subrequest metrics
 */
export function DOSubrequestsTab({
    subrequestsSeries,
    byNamespace,
    totalSubrequests,
}: DOSubrequestsTabProps): React.ReactElement {
    // Aggregate subrequests by date
    const aggregatedByDate = new Map<string, { requests: number; responseBodySize: number }>()

    for (const point of subrequestsSeries) {
        const existing = aggregatedByDate.get(point.date)
        if (existing) {
            existing.requests += point.requests
            existing.responseBodySize += point.responseBodySize
        } else {
            aggregatedByDate.set(point.date, {
                requests: point.requests,
                responseBodySize: point.responseBodySize,
            })
        }
    }

    const chartData = Array.from(aggregatedByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

    const maxRequests = chartData.reduce((max, d) => Math.max(max, d.requests), 1)
    const totalResponseBytes = chartData.reduce((sum, d) => sum + d.responseBodySize, 0)

    // Calculate average per day
    const avgSubrequestsPerDay = chartData.length > 0
        ? totalSubrequests / chartData.length
        : 0

    // Aggregate by namespace for breakdown
    const subrequestsByNamespace = new Map<string, number>()
    for (const point of subrequestsSeries) {
        const script = point.scriptName ?? 'unknown'
        const existing = subrequestsByNamespace.get(script) ?? 0
        subrequestsByNamespace.set(script, existing + point.requests)
    }

    return (
        <div className="space-y-6">
            {/* Subrequests Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Subrequests */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Total Subrequests</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatNumber(totalSubrequests)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            External API calls from DOs
                        </p>
                    </CardContent>
                </Card>

                {/* Average Per Day */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Avg Per Day</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatNumber(Math.round(avgSubrequestsPerDay))}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Daily average
                        </p>
                    </CardContent>
                </Card>

                {/* Response Data Volume */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Response Data</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatBytes(totalResponseBytes)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total received data
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Subrequests Over Time Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Subrequests Over Time</CardTitle>
                    <CardDescription>Daily external API call volume</CardDescription>
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
                                        className="w-full bg-purple-500/80 hover:bg-purple-500 rounded-t transition-all"
                                        style={{
                                            height: `${(day.requests / maxRequests) * 100}%`,
                                            minHeight: day.requests > 0 ? '4px' : '0',
                                        }}
                                        title={`${day.requests.toLocaleString()} subrequests`}
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
                            No subrequest data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-Namespace Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Subrequests by Namespace</CardTitle>
                    <CardDescription>External API calls per Durable Object namespace</CardDescription>
                </CardHeader>
                <CardContent>
                    {subrequestsByNamespace.size > 0 ? (
                        <div className="space-y-4">
                            {Array.from(subrequestsByNamespace.entries())
                                .sort((a, b) => b[1] - a[1])
                                .map(([scriptName, requests]) => {
                                    const percentage = (requests / totalSubrequests) * 100
                                    const nsInfo = byNamespace.find(ns => ns.scriptName === scriptName)
                                    return (
                                        <div key={scriptName} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium">{nsInfo?.namespaceName ?? scriptName}</span>
                                                    <span className="text-sm text-muted-foreground ml-2">
                                                        ({formatNumber(requests)})
                                                    </span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500 transition-all"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            No subrequest data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <p className="font-medium">About Subrequests</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Subrequests are external HTTP calls made by your Durable Objects to other APIs or services.
                                This includes fetch() calls to external URLs, other Workers, or Cloudflare services.
                                High subrequest counts may indicate opportunities for caching or optimization.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
