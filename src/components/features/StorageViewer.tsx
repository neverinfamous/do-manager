import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, Loader2, Key, Table, Trash2, Edit, Plus, Bell, Archive, Search, X, Copy, Check, Download, CheckSquare } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
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
import { SelectionToolbar } from './SelectionToolbar'
import { storageApi, type StorageListResponse } from '../../services/storageApi'
import { logBatchDeleteKeys, logBatchExportKeys } from '../../services/batchApi'
import { downloadJson, generateTimestampedFilename } from '../../lib/downloadUtils'
import type { Instance, Namespace } from '../../types'

interface StorageViewerProps {
  namespace: Namespace
  instance: Instance
  onBack: () => void
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text: string, search: string): React.ReactNode {
  if (!search) return text
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export function StorageViewer({
  namespace,
  instance,
  onBack,
}: StorageViewerProps): React.ReactElement {
  const [storage, setStorage] = useState<StorageListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [activeTab, setActiveTab] = useState('keys')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddKey, setShowAddKey] = useState(false)
  const [keySearch, setKeySearch] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // Multi-select state for keys
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchExporting, setBatchExporting] = useState(false)

  const handleCopyKey = async (key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // Clipboard API not available, silently fail
      console.warn('Clipboard API not available')
    }
  }

  // Filter keys based on search term (must be defined before selection helpers)
  const filteredKeys = useMemo(() => {
    if (!storage?.keys) return []
    if (!keySearch.trim()) return storage.keys
    const searchLower = keySearch.toLowerCase()
    return storage.keys.filter((key) => key.toLowerCase().includes(searchLower))
  }, [storage?.keys, keySearch])

  // Selection helpers
  const toggleKeySelection = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const selectAllKeys = useCallback(() => {
    setSelectedKeys(new Set(filteredKeys))
  }, [filteredKeys])

  const clearKeySelection = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const isAllKeysSelected = useMemo(() => {
    return filteredKeys.length > 0 && filteredKeys.every((key) => selectedKeys.has(key))
  }, [filteredKeys, selectedKeys])

  const loadStorage = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      // Clear selection when reloading
      setSelectedKeys(new Set())
      const data = await storageApi.list(instance.id)
      setStorage(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage')
    } finally {
      setLoading(false)
    }
  }, [instance.id])

  // Batch delete handler
  const handleBatchDelete = async (): Promise<void> => {
    const count = selectedKeys.size
    if (count === 0) return

    if (!confirm(`Delete ${String(count)} key${count === 1 ? '' : 's'}? This action cannot be undone.`)) {
      return
    }

    setBatchDeleting(true)
    setError('')

    try {
      const keysToDelete = Array.from(selectedKeys)
      let successCount = 0
      const errors: string[] = []

      for (const key of keysToDelete) {
        try {
          await storageApi.delete(instance.id, key)
          successCount++
        } catch (err) {
          errors.push(`${key}: ${err instanceof Error ? err.message : 'Failed'}`)
        }
      }

      // Log to job history
      await logBatchDeleteKeys({
        instanceId: instance.id,
        instanceName: instance.name ?? instance.object_id,
        namespaceId: namespace.id,
        namespaceName: namespace.name,
        keys: keysToDelete,
        successCount,
        failedCount: errors.length,
      })

      // Clear selection and refresh
      setSelectedKeys(new Set())
      await loadStorage()

      if (errors.length > 0) {
        setError(`Deleted ${String(successCount)}/${String(count)} keys. Errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch delete failed')
    } finally {
      setBatchDeleting(false)
    }
  }

  // Batch export handler
  const handleBatchExport = async (): Promise<void> => {
    const count = selectedKeys.size
    if (count === 0) return

    setBatchExporting(true)
    setError('')

    try {
      const keysToExport = Array.from(selectedKeys)
      const exportData: Record<string, unknown> = {}
      const errors: string[] = []

      for (const key of keysToExport) {
        try {
          const result = await storageApi.get(instance.id, key)
          exportData[key] = result.value
        } catch (err) {
          errors.push(`${key}: ${err instanceof Error ? err.message : 'Failed'}`)
        }
      }

      // Generate export with metadata
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        instance: {
          id: instance.id,
          name: instance.name,
          objectId: instance.object_id,
        },
        namespace: {
          id: namespace.id,
          name: namespace.name,
        },
        keyCount: Object.keys(exportData).length,
        data: exportData,
      }

      const filename = generateTimestampedFilename(
        `${namespace.name}-${instance.name ?? instance.object_id}-keys`,
        'json'
      )
      downloadJson(exportPayload, filename)

      // Log to job history
      const exportedKeys = Object.keys(exportData)
      await logBatchExportKeys({
        instanceId: instance.id,
        instanceName: instance.name ?? instance.object_id,
        namespaceId: namespace.id,
        namespaceName: namespace.name,
        keys: keysToExport,
        exportedCount: exportedKeys.length,
      })

      // Clear selection after successful export
      setSelectedKeys(new Set())

      if (errors.length > 0) {
        setError(`Exported ${String(Object.keys(exportData).length)}/${String(count)} keys. Some keys failed: ${errors.slice(0, 3).join('; ')}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch export failed')
    } finally {
      setBatchExporting(false)
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
  }, [loadStorage])

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

      {/* Warning from API */}
      {storage?.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-600 dark:text-yellow-400 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">⚠️ Admin Hook Required</p>
          <p className="text-sm mt-1">{storage.warning}</p>
        </div>
      )}

      {/* API Error */}
      {storage?.error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Admin Hook Error</p>
          <p className="text-sm mt-1">{storage.error}</p>
          {storage.details && (
            <pre className="text-xs mt-2 p-2 bg-black/10 rounded overflow-auto">
              {storage.details}
            </pre>
          )}
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
              Keys ({storage.keys?.length ?? 0})
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
              <div className="flex items-center gap-2">
                {filteredKeys.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllKeys}
                    disabled={isAllKeysSelected}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowAddKey(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key
                </Button>
              </div>
            </div>

            {/* Selection Toolbar */}
            <SelectionToolbar
              selectedCount={selectedKeys.size}
              totalCount={filteredKeys.length}
              isAllSelected={isAllKeysSelected}
              onSelectAll={selectAllKeys}
              onClear={clearKeySelection}
              itemLabel="key"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleBatchExport()}
                disabled={batchExporting || selectedKeys.size === 0}
              >
                {batchExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleBatchDelete()}
                disabled={batchDeleting || selectedKeys.size === 0}
              >
                {batchDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </SelectionToolbar>

            {/* Search/Filter */}
            {storage.keys && storage.keys.length > 0 && (
              <div className="relative mb-4">
                <label htmlFor="storage-key-filter" className="sr-only">Filter storage keys</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="storage-key-filter"
                  placeholder="Filter keys... (e.g., user: or config)"
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  className="pl-10 pr-10"
                />
                {keySearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setKeySearch('')}
                    aria-label="Clear key filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Search results info */}
            {keySearch && storage.keys && storage.keys.length > 0 && (
              <p className="text-sm text-muted-foreground mb-3">
                Showing {filteredKeys.length} of {storage.keys.length} keys
                {filteredKeys.length === 0 && (
                  <span className="ml-1">— no matches for "{keySearch}"</span>
                )}
              </p>
            )}

            {!storage.keys || storage.keys.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No storage keys found</p>
                </CardContent>
              </Card>
            ) : filteredKeys.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No keys match "{keySearch}"</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setKeySearch('')}
                    className="mt-2"
                  >
                    Clear filter
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredKeys.map((key) => (
                  <Card 
                    key={key} 
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedKeys.has(key) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setEditingKey(key)}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Checkbox */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center"
                          >
                            <Checkbox
                              checked={selectedKeys.has(key)}
                              onCheckedChange={() => toggleKeySelection(key)}
                              aria-label={`Select key ${key}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-mono truncate">
                              {keySearch ? (
                                // Highlight matching text
                                highlightMatch(key, keySearch)
                              ) : (
                                key
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Click to view/edit value
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleCopyKey(key)
                            }}
                            aria-label={copiedKey === key ? 'Copied!' : 'Copy key name'}
                            title={copiedKey === key ? 'Copied!' : 'Copy key name'}
                          >
                            {copiedKey === key ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingKey(key)
                            }}
                            aria-label="Edit key"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteKey(key)
                            }}
                            aria-label="Delete key"
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
                tables={storage.tables ?? []}
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
                onRestore={() => void loadStorage()}
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

