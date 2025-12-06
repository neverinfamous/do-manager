import { useState } from 'react'
import { Box, Copy, Database, Download, Settings, Trash2, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { exportApi } from '../../services/exportApi'
import type { Namespace } from '../../types'

interface NamespaceCardProps {
  namespace: Namespace
  onSelect: (namespace: Namespace) => void
  onClone: (namespace: Namespace) => void
  onSettings: (namespace: Namespace) => void
  onDelete: (namespace: Namespace) => void
  /** Whether this namespace is selected */
  isSelected?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (namespace: Namespace) => void
}

export function NamespaceCard({
  namespace,
  onSelect,
  onClone,
  onSettings,
  onDelete,
  isSelected = false,
  onSelectionChange,
}: NamespaceCardProps): React.ReactElement {
  const [downloading, setDownloading] = useState(false)

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDownloadConfig = async (): Promise<void> => {
    try {
      setDownloading(true)
      await exportApi.downloadNamespace(namespace.id, namespace.name)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to download namespace config:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleCheckboxChange = (checked: boolean | 'indeterminate'): void => {
    if (checked !== 'indeterminate' && onSelectionChange) {
      onSelectionChange(namespace)
    }
  }

  return (
    <Card
      className={`hover:shadow-lg transition-shadow ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              aria-label={`Select ${namespace.name}`}
            />
            <Box className="h-8 w-8 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                namespace.storage_backend === 'sqlite'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}
            >
              {namespace.storage_backend.toUpperCase()}
            </span>
            {namespace.admin_hook_enabled === 1 && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Admin Hook
              </span>
            )}
          </div>
        </div>
        <CardTitle className="mt-4">{namespace.name}</CardTitle>
        <CardDescription className="font-mono text-xs">
          {namespace.class_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm mb-4">
          {namespace.script_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Script:</span>
              <span className="font-medium">{namespace.script_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Added:</span>
            <span className="font-medium">{formatDate(namespace.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onSelect(namespace)}
          >
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Browse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadConfig()}
            disabled={downloading}
            title="Download namespace config"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClone(namespace)}
            title="Clone namespace"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettings(namespace)}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(namespace)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
