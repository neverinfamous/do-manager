import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Key, Table, Trash2, Edit, Plus, Bell, Archive } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { SqlConsole } from './SqlConsole'
import { StorageEditor } from './StorageEditor'
import { AlarmManager } from './AlarmManager'
import { BackupManager } from './BackupManager'
import { storageApi, type StorageListResponse } from '../../services/storageApi'
import type { Instance, Namespace } from '../../types'

interface StorageViewerProps {
  namespace: Namespace
  instance: Instance
  onBack: () => void
}

export function StorageViewer({
  namespace,
  instance,
  onBack,
}: StorageViewerProps): JSX.Element {
  const [storage, setStorage] = useState<StorageListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [activeTab, setActiveTab] = useState('keys')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddKey, setShowAddKey] = useState(false)

  const loadStorage = async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await storageApi.list(instance.id)
      setStorage(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (key: string): Promise<void> => {
    if (!confirm(`Delete key "${key}"?`)) {
      return
    }
    try {
      await storageApi.delete(instance.id, key)
      await loadStorage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key')
    }
  }

  useEffect(() => {
    void loadStorage()
  }, [instance.id])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            ← Back to {namespace.name}
          </button>
          <h2 className="text-2xl font-bold">
            {instance.name ?? 'Instance Storage'}
          </h2>
          <p className="text-sm text-muted-foreground font-mono">
            {instance.object_id}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadStorage()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!loading && storage && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Keys ({storage.keys.length})
            </TabsTrigger>
            {namespace.storage_backend === 'sqlite' && (
              <TabsTrigger value="sql" className="flex items-center gap-2">
                <Table className="h-4 w-4" />
                SQL Console
              </TabsTrigger>
            )}
            <TabsTrigger value="alarm" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alarm
            </TabsTrigger>
            <TabsTrigger value="backups" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Backups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Storage Keys</h3>
              <Button size="sm" onClick={() => setShowAddKey(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </div>

            {storage.keys.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No storage keys found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {storage.keys.map((key) => (
                  <Card key={key}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-mono">{key}</CardTitle>
                          <CardDescription className="text-xs">
                            Click to view/edit value
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingKey(key)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteKey(key)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {namespace.storage_backend === 'sqlite' && (
            <TabsContent value="sql" className="mt-6">
              <SqlConsole
                instanceId={instance.id}
                tables={storage.tables}
              />
            </TabsContent>
          )}

          <TabsContent value="alarm" className="mt-6">
            <div className="max-w-md">
              <AlarmManager
                instanceId={instance.id}
                instanceName={instance.name}
              />
            </div>
          </TabsContent>

          <TabsContent value="backups" className="mt-6">
            <div className="max-w-xl">
              <BackupManager
                instanceId={instance.id}
                instanceName={instance.name}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Storage Editor Dialog */}
      {editingKey !== null && (
        <StorageEditor
          instanceId={instance.id}
          keyName={editingKey}
          onClose={() => setEditingKey(null)}
          onSave={() => {
            setEditingKey(null)
            void loadStorage()
          }}
        />
      )}

      {/* Add Key Dialog */}
      {showAddKey && (
        <StorageEditor
          instanceId={instance.id}
          keyName={null}
          onClose={() => setShowAddKey(false)}
          onSave={() => {
            setShowAddKey(false)
            void loadStorage()
          }}
        />
      )}
    </div>
  )
}

