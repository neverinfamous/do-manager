import { AlertTriangle, HardDrive } from 'lucide-react'
import { getStorageQuotaStatus, formatStorageSize } from '../../lib/storageUtils'

interface StorageQuotaAlertProps {
  /** Storage size in bytes */
  storageSizeBytes: number
  /** Show as inline badge (compact) or full alert banner */
  variant?: 'badge' | 'banner'
  /** Optional class name */
  className?: string
}

/**
 * Storage quota alert component
 * Shows warning when instance storage approaches 10GB DO limit
 */
export function StorageQuotaAlert({
  storageSizeBytes,
  variant = 'badge',
  className = '',
}: StorageQuotaAlertProps): React.ReactElement | null {
  const { level, percentUsed } = getStorageQuotaStatus(storageSizeBytes)

  // Don't show anything if storage is normal
  if (level === 'normal') {
    return null
  }

  const isCritical = level === 'critical'
  const colorClasses = isCritical
    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/50'
    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/50'

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${colorClasses} ${className}`}
        title={`Storage: ${formatStorageSize(storageSizeBytes)} (${percentUsed.toFixed(1)}% of 10GB limit)`}
      >
        {isCritical ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <HardDrive className="h-3 w-3" />
        )}
        {percentUsed.toFixed(0)}%
      </span>
    )
  }

  // Banner variant
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${colorClasses} ${className}`}
    >
      {isCritical ? (
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      ) : (
        <HardDrive className="h-5 w-5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {isCritical ? 'Critical: Storage quota nearly exhausted' : 'Warning: High storage usage'}
        </p>
        <p className="text-xs opacity-80">
          {formatStorageSize(storageSizeBytes)} used ({percentUsed.toFixed(1)}% of 10GB DO limit)
          {isCritical
            ? ' — Consider cleaning up or migrating data'
            : ' — Monitor usage to avoid hitting limit'}
        </p>
      </div>
    </div>
  )
}
