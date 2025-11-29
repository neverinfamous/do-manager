import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, RefreshCw, Loader2, Box, Clock, Database, Bell, Download, Copy, Trash2, CheckSquare, Archive, Search, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { CreateInstanceDialog } from './CreateInstanceDialog'
import { CloneInstanceDialog } from './CloneInstanceDialog'
import { SelectionToolbar } from './SelectionToolbar'
import { BatchDeleteDialog } from './BatchDeleteDialog'
import { BatchBackupDialog } from './BatchBackupDialog'
import { BatchDownloadDialog } from './BatchDownloadDialog'
import { instanceApi } from '../../services/instanceApi'
import { exportApi } from '../../services/exportApi'
import { useSelection } from '../../hooks/useSelection'
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
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false)
  const [showBatchBackupDialog, setShowBatchBackupDialog] = useState(false)
  const [showBatchDownloadDialog, setShowBatchDownloadDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Selection state
  const selection = useSelection<Instance>()

  // Filter instances based on search
  const filteredInstances = useMemo(() => {
    if (!searchTerm.trim()) return instances
    const searchLower = searchTerm.toLowerCase()
    return instances.filter(
      (inst) =>
        (inst.name?.toLowerCase().includes(searchLower) ?? false) ||
        inst.object_id.toLowerCase().includes(searchLower)
    )
  }, [instances, searchTerm])

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

  const handleSelectionChange = (instance: Instance): void => {
    selection.toggle(instance.id)
  }

  const handleSelectAll = (): void => {
    selection.selectAll(filteredInstances)
  }

  const handleBatchDeleteComplete = (): void => {
    // Remove deleted instances from state
    const deletedIds = selection.selectedIds
    setInstances((prev) => prev.filter((i) => !deletedIds.has(i.id)))
    setTotal((prev) => prev - deletedIds.size)
    selection.clear()
    setShowBatchDeleteDialog(false)
  }

  const handleBatchBackupComplete = (): void => {
    selection.clear()
    setShowBatchBackupDialog(false)
  }

  const handleBatchDownloadComplete = (): void => {
    selection.clear()
    setShowBatchDownloadDialog(false)
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

  const selectedInstances = selection.getSelectedItems(filteredInstances)

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
            onClick={handleSelectAll}
            disabled={filteredInstances.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Select All
          </Button>
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

      {/* Selection toolbar */}
      {selection.count > 0 && (
        <SelectionToolbar
          selectedCount={selection.count}
          totalCount={filteredInstances.length}
          isAllSelected={selection.isAllSelected(filteredInstances)}
          onSelectAll={() => selection.selectAll(filteredInstances)}
          onClear={selection.clear}
          itemLabel="instance"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBatchDownloadDialog(true)}
            disabled={selection.count === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download ({selection.count})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBatchBackupDialog(true)}
            disabled={selection.count === 0}
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Backup ({selection.count})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBatchDeleteDialog(true)}
            disabled={selection.count === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete ({selection.count})
          </Button>
        </SelectionToolbar>
      )}

      {/* Search filter */}
      {instances.length > 0 && (
        <div className="relative mb-4">
          <label htmlFor="instance-filter" className="sr-only">Filter instances</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="instance-filter"
            placeholder="Filter instances by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Select all checkbox */}
      {filteredInstances.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <Checkbox
            id="select-all-instances"
            checked={selection.isAllSelected(filteredInstances)}
            onCheckedChange={(checked) => {
              if (checked) {
                selection.selectAll(filteredInstances)
              } else {
                selection.deselectAll()
              }
            }}
            aria-label="Select all instances"
          />
          <label
            htmlFor="select-all-instances"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Select all {filteredInstances.length} instances
          </label>
        </div>
      )}

      {/* Search results info */}
      {searchTerm && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredInstances.length} of {instances.length} instances
          {filteredInstances.length === 0 && (
            <span className="ml-1">— no matches for "{searchTerm}"</span>
          )}
        </p>
      )}

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

      {/* No matches state */}
      {!loading && instances.length > 0 && filteredInstances.length === 0 && searchTerm && (
        <div className="text-center py-8 border rounded-lg">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-semibold mb-1">No matches</h4>
          <p className="text-sm text-muted-foreground mb-4">
            No instances match "{searchTerm}"
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
            Clear filter
          </Button>
        </div>
      )}

      {/* Instance Grid */}
      {!loading && filteredInstances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInstances.map((instance) => (
            <Card
              key={instance.id}
              className={`hover:shadow-md transition-shadow ${
                selection.isSelected(instance.id) ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selection.isSelected(instance.id)}
                      onCheckedChange={() => handleSelectionChange(instance)}
                      aria-label={`Select ${instance.name ?? instance.object_id}`}
                    />
                    <div>
                      <CardTitle className="text-base">
                        {instance.name ?? 'Unnamed Instance'}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs truncate max-w-[200px]">
                        {instance.object_id}
                      </CardDescription>
                    </div>
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

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={showBatchDeleteDialog}
        onOpenChange={setShowBatchDeleteDialog}
        items={selectedInstances}
        itemType="instance"
        onComplete={handleBatchDeleteComplete}
      />

      {/* Batch Backup Dialog */}
      <BatchBackupDialog
        open={showBatchBackupDialog}
        onOpenChange={setShowBatchBackupDialog}
        instances={selectedInstances}
        namespace={namespace}
        onComplete={handleBatchBackupComplete}
      />

      {/* Batch Download Dialog */}
      <BatchDownloadDialog
        open={showBatchDownloadDialog}
        onOpenChange={setShowBatchDownloadDialog}
        instances={selectedInstances}
        namespace={namespace}
        onComplete={handleBatchDownloadComplete}
      />
    </div>
  )
}
