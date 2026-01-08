import type { DOStorageDataPoint, DONamespaceMetrics } from '../../services/metricsApi'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../ui/card'
import { Database, HardDrive, TrendingUp, TrendingDown } from 'lucide-react'

interface DOStorageTabProps {
    storageSeries: DOStorageDataPoint[]
    byNamespace: DONamespaceMetrics[]
    totalStorageBytes: number
    totalStorageKeys: number | undefined
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
 * DO Storage Tab - Displays storage metrics trends and per-namespace breakdown
 */
export function DOStorageTab({
    storageSeries,
    byNamespace,
    totalStorageBytes,
    totalStorageKeys,
}: DOStorageTabProps): React.ReactElement {
    // Aggregate storage by date (sum across all namespaces)
    const aggregatedByDate = new Map<string, { storedBytes: number; storedKeys: number }>()

    for (const point of storageSeries) {
        const existing = aggregatedByDate.get(point.date)
        if (existing) {
            existing.storedBytes = Math.max(existing.storedBytes, point.storedBytes)
            if (point.storedKeys !== undefined) {
                existing.storedKeys = Math.max(existing.storedKeys, point.storedKeys)
            }
        } else {
            aggregatedByDate.set(point.date, {
                storedBytes: point.storedBytes,
                storedKeys: point.storedKeys ?? 0,
            })
        }
    }

    const chartData = Array.from(aggregatedByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

    const maxBytes = chartData.reduce((max, d) => Math.max(max, d.storedBytes), 1)

    // Calculate storage trend (compare first vs last data point)
    const trend = chartData.length >= 2
        ? ((chartData[chartData.length - 1]?.storedBytes ?? 0) - (chartData[0]?.storedBytes ?? 0)) / ((chartData[0]?.storedBytes ?? 1) || 1) * 100
        : 0

    // 10 GB DO storage limit
    const storageLimit = 10737418240
    const usagePercentage = (totalStorageBytes / storageLimit) * 100

    return (
        <div className="space-y-6">
            {/* Storage Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Storage Used */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Total Storage</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatBytes(totalStorageBytes)}</div>
                        <div className="mt-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${usagePercentage >= 90 ? 'bg-destructive' :
                                        usagePercentage >= 80 ? 'bg-yellow-500' :
                                            'bg-primary'
                                        }`}
                                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {usagePercentage.toFixed(2)}% of 10 GB limit
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Storage Keys (if available) */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Total Keys</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {totalStorageKeys !== undefined ? formatNumber(totalStorageKeys) : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across all namespaces
                        </p>
                    </CardContent>
                </Card>

                {/* Storage Trend */}
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            {trend >= 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <CardTitle className="text-sm">Storage Trend</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Change over period
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Storage Over Time Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Storage Over Time</CardTitle>
                    <CardDescription>Daily storage usage trend</CardDescription>
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
                                        className="w-full bg-blue-500/80 hover:bg-blue-500 rounded-t transition-all"
                                        style={{
                                            height: `${(day.storedBytes / maxBytes) * 100}%`,
                                            minHeight: day.storedBytes > 0 ? '4px' : '0',
                                        }}
                                        title={formatBytes(day.storedBytes)}
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
                            No storage data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-Namespace Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Storage by Namespace</CardTitle>
                    <CardDescription>Current storage usage per Durable Object namespace</CardDescription>
                </CardHeader>
                <CardContent>
                    {byNamespace.length > 0 ? (
                        <div className="space-y-4">
                            {byNamespace
                                .sort((a, b) => b.currentStorageBytes - a.currentStorageBytes)
                                .map((ns) => {
                                    const percentage = (ns.currentStorageBytes / totalStorageBytes) * 100
                                    return (
                                        <div key={ns.scriptName} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium">{ns.namespaceName ?? ns.scriptName}</span>
                                                    <span className="text-sm text-muted-foreground ml-2">
                                                        ({formatBytes(ns.currentStorageBytes)})
                                                    </span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            No namespace data available
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
