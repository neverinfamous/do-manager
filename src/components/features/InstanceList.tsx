import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Loader2, Box, Clock, Database, Bell, Download, Copy, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { CreateInstanceDialog } from './CreateInstanceDialog'
import { CloneInstanceDialog } from './CloneInstanceDialog'
import { instanceApi } from '../../services/instanceApi'
import { exportApi } from '../../services/exportApi'
import type { Namespace, Instance } from '../../types'

interface InstanceListProps {
  namespace: Namespace
  onSelectInstance: (instance: Instance) => void
}

export function InstanceList({
  namespace,
  onSelectInstance,
}: InstanceListProps): React.ReactElement {
  const [instances, setInstances] = useState<Instance[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [cloneInstance, setCloneInstance] = useState<Instance | null>(null)

  const loadInstances = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await instanceApi.list(namespace.id)
      setInstances(data.instances)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances')
    } finally {
      setLoading(false)
    }
  }, [namespace.id])

  const handleDelete = async (instance: Instance): Promise<void> => {
    if (!confirm(`Remove tracking for "${instance.name ?? instance.object_id}"?`)) {
      return
    }
    try {
      await instanceApi.delete(instance.id)
      setInstances((prev) => prev.filter((i) => i.id !== instance.id))
      setTotal((prev) => prev - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instance')
    }
  }

  const handleCreateComplete = (instance: Instance): void => {
    setInstances((prev) => [instance, ...prev])
    setTotal((prev) => prev + 1)
    setShowCreateDialog(false)
  }

  const handleExport = async (instance: Instance): Promise<void> => {
    try {
      setExportingId(instance.id)
      setError('')
      await exportApi.downloadInstance(instance.id, instance.name ?? instance.object_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export instance')
    } finally {
      setExportingId(null)
    }
  }

  const handleCloneComplete = (instance: Instance): void => {
    setInstances((prev) => [instance, ...prev])
    setTotal((prev) => prev + 1)
    setCloneInstance(null)
  }

  useEffect(() => {
    void loadInstances()
  }, [loadInstances])

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (bytes: number | null): string => {
    if (bytes === null) return 'Unknown'
    if (bytes < 1024) return `${String(bytes)} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold">Instances</h3>
          <p className="text-sm text-muted-foreground">
            {total} tracked {total === 1 ? 'instance' : 'instances'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadInstances()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Instance
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && instances.length === 0 && (
        <div className="text-center py-8 border rounded-lg">
          <Box className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-semibold mb-1">No instances tracked</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Add an instance by its name or ID to start managing it
          </p>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Instance
          </Button>
        </div>
      )}

      {/* Instance Grid */}
      {!loading && instances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instances.map((instance) => (
            <Card key={instance.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {instance.name ?? 'Unnamed Instance'}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs truncate max-w-[200px]">
                      {instance.object_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {instance.has_alarm === 1 && (
                      <span title="Has alarm">
                        <Bell className="h-4 w-4 text-yellow-500" />
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDate(instance.last_accessed)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    <span>{formatSize(instance.storage_size_bytes)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onSelectInstance(instance)}
                  >
                    <Database className="h-3.5 w-3.5 mr-1.5" />
                    View Storage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleExport(instance)}
                    disabled={exportingId === instance.id}
                    title="Download instance data"
                  >
                    {exportingId === instance.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneInstance(instance)}
                    title="Clone instance"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDelete(instance)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Instance Dialog */}
      <CreateInstanceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        namespaceId={namespace.id}
        onComplete={handleCreateComplete}
      />

      {/* Clone Instance Dialog */}
      <CloneInstanceDialog
        open={cloneInstance !== null}
        onOpenChange={(open) => !open && setCloneInstance(null)}
        sourceInstance={cloneInstance}
        onComplete={handleCloneComplete}
      />
    </div>
  )
}

