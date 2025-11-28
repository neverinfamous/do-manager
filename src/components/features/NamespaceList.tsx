import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Loader2, Box, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { NamespaceCard } from './NamespaceCard'
import { AddNamespaceDialog } from './AddNamespaceDialog'
import { NamespaceSettingsDialog } from './NamespaceSettingsDialog'
import { namespaceApi } from '../../services/api'
import type { Namespace } from '../../types'

interface NamespaceListProps {
  onSelectNamespace: (namespace: Namespace) => void
}

export function NamespaceList({ onSelectNamespace }: NamespaceListProps) {
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [discovering, setDiscovering] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null)

  const loadNamespaces = async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await namespaceApi.list()
      setNamespaces(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load namespaces')
    } finally {
      setLoading(false)
    }
  }

  const handleDiscover = async (): Promise<void> => {
    try {
      setDiscovering(true)
      setError('')
      const discovered = await namespaceApi.discover()
      // Merge discovered with existing (avoiding duplicates by class_name)
      const existingClasses = new Set(namespaces.map((n) => n.class_name))
      const newNamespaces = discovered.filter(
        (n) => !existingClasses.has(n.class_name)
      )
      if (newNamespaces.length > 0) {
        // Add new namespaces
        for (const ns of newNamespaces) {
          await namespaceApi.add({
            name: ns.name,
            class_name: ns.class_name,
            script_name: ns.script_name ?? undefined,
            storage_backend: ns.storage_backend,
          })
        }
        await loadNamespaces()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover namespaces')
    } finally {
      setDiscovering(false)
    }
  }

  const handleDelete = async (namespace: Namespace): Promise<void> => {
    if (!confirm(`Delete namespace "${namespace.name}"?`)) {
      return
    }
    try {
      await namespaceApi.delete(namespace.id)
      setNamespaces((prev) => prev.filter((n) => n.id !== namespace.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete namespace')
    }
  }

  const handleAddComplete = (namespace: Namespace): void => {
    setNamespaces((prev) => [namespace, ...prev])
    setShowAddDialog(false)
  }

  const handleSettings = (namespace: Namespace): void => {
    setSelectedNamespace(namespace)
    setShowSettingsDialog(true)
  }

  const handleSettingsUpdate = (updatedNamespace: Namespace): void => {
    setNamespaces((prev) =>
      prev.map((n) => (n.id === updatedNamespace.id ? updatedNamespace : n))
    )
  }

  useEffect(() => {
    void loadNamespaces()
  }, [])

  return (
    <div>
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Namespaces</h2>
          <p className="text-muted-foreground mt-1">
            {namespaces.length} {namespaces.length === 1 ? 'namespace' : 'namespaces'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handleDiscover()}
            disabled={discovering}
          >
            {discovering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Discover
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadNamespaces()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Namespace
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && namespaces.length === 0 && (
        <div className="text-center py-12">
          <Box className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No namespaces yet</h3>
          <p className="text-muted-foreground mb-4">
            Add a Durable Object namespace to get started
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => void handleDiscover()}>
              <Search className="h-4 w-4 mr-2" />
              Auto-Discover
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
          </div>
        </div>
      )}

      {/* Namespace Grid */}
      {!loading && namespaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {namespaces.map((namespace) => (
            <NamespaceCard
              key={namespace.id}
              namespace={namespace}
              onSelect={onSelectNamespace}
              onSettings={handleSettings}
              onDelete={() => void handleDelete(namespace)}
            />
          ))}
        </div>
      )}

      {/* Add Namespace Dialog */}
      <AddNamespaceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onComplete={handleAddComplete}
      />

      {/* Settings Dialog */}
      <NamespaceSettingsDialog
        namespace={selectedNamespace}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onUpdate={handleSettingsUpdate}
      />
    </div>
  )
}

