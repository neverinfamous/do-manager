import { useState, useEffect, useCallback } from 'react'
import { Play, Loader2, Table, Download, Trash2, FileCode, Save, BookOpen, Edit, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { storageApi, type SqlResponse } from '../../services/storageApi'
import { queriesApi } from '../../services/queriesApi'
import { sqlTemplates } from '../../lib/sqlTemplates'
import type { SavedQuery } from '../../types'

interface SqlConsoleProps {
  instanceId: string
  namespaceId: string
  tables: string[]
}

export function SqlConsole({ instanceId, namespaceId, tables }: SqlConsoleProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SqlResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [history, setHistory] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string | undefined>(
    tables.length > 0 ? tables[0] : undefined
  )

  // Saved queries state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [savingQuery, setSavingQuery] = useState(false)
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null)
  const [queryName, setQueryName] = useState('')
  const [queryDescription, setQueryDescription] = useState('')

  // Load saved queries
  const loadSavedQueries = useCallback(async (): Promise<void> => {
    try {
      setLoadingSaved(true)
      const queries = await queriesApi.list(namespaceId)
      setSavedQueries(queries)
    } catch (err) {
      console.error('Failed to load saved queries:', err)
    } finally {
      setLoadingSaved(false)
    }
  }, [namespaceId])

  useEffect(() => {
    void loadSavedQueries()
  }, [loadSavedQueries])

  const handleTemplateSelect = (templateId: string): void => {
    const template = sqlTemplates.find((t) => t.id === templateId)
    if (template) {
      const generatedQuery = template.generateQuery(selectedTable)
      setQuery(generatedQuery)
    }
  }

  const handleSavedQuerySelect = (queryId: string): void => {
    const saved = savedQueries.find((q) => q.id === queryId)
    if (saved) {
      setQuery(saved.query)
    }
  }

  const executeQuery = async (): Promise<void> => {
    if (!query.trim()) {
      setError('Query is required')
      return
    }

    try {
      setLoading(true)
      setError('')
      const data = await storageApi.sql(instanceId, query.trim())
      setResult(data)
      
      // Add to history
      setHistory((prev) => {
        const newHistory = [query.trim(), ...prev.filter((q) => q !== query.trim())]
        return newHistory.slice(0, 10) // Keep last 10 queries
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      void executeQuery()
    }
  }

  const insertTableQuery = (tableName: string): void => {
    setQuery(`SELECT * FROM ${tableName} LIMIT 100`)
  }

  const exportResults = (): void => {
    if (!result?.results.length) return
    
    const csv = [
      Object.keys(result.results[0] as Record<string, unknown>).join(','),
      ...result.results.map((row) =>
        Object.values(row as Record<string, unknown>)
          .map((v) => JSON.stringify(v))
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveQuery = async (): Promise<void> => {
    if (!queryName.trim() || !query.trim()) return

    try {
      setSavingQuery(true)
      const saved = await queriesApi.create(namespaceId, {
        name: queryName.trim(),
        description: queryDescription.trim() || undefined,
        query: query.trim(),
      })
      setSavedQueries((prev) => [...prev, saved])
      setShowSaveDialog(false)
      setQueryName('')
      setQueryDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save query')
    } finally {
      setSavingQuery(false)
    }
  }

  const handleUpdateQuery = async (): Promise<void> => {
    if (!editingQuery || !queryName.trim()) return

    try {
      setSavingQuery(true)
      const updated = await queriesApi.update(editingQuery.id, {
        name: queryName.trim(),
        description: queryDescription.trim() || undefined,
        query: query.trim(),
      })
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === updated.id ? updated : q))
      )
      setShowEditDialog(false)
      setEditingQuery(null)
      setQueryName('')
      setQueryDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update query')
    } finally {
      setSavingQuery(false)
    }
  }

  const handleDeleteQuery = async (queryId: string): Promise<void> => {
    if (!confirm('Delete this saved query?')) return

    try {
      await queriesApi.delete(queryId)
      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete query')
    }
  }

  const openEditDialog = (saved: SavedQuery): void => {
    setEditingQuery(saved)
    setQueryName(saved.name)
    setQueryDescription(saved.description ?? '')
    setQuery(saved.query)
    setShowEditDialog(true)
  }

  return (
    <div className="space-y-4">
      {/* Saved Queries */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Saved Queries
              </CardTitle>
              <CardDescription className="text-xs">
                Load or manage frequently used queries
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQueryName('')
                setQueryDescription('')
                setShowSaveDialog(true)
              }}
              disabled={!query.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Current
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSaved ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : savedQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved queries yet. Write a query and click "Save Current" to save it.
            </p>
          ) : (
            <div className="space-y-2">
              {savedQueries.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => handleSavedQuerySelect(saved.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium text-sm truncate">{saved.name}</div>
                    {saved.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {saved.description}
                      </div>
                    )}
                    <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                      {saved.query.substring(0, 60)}{saved.query.length > 60 ? '...' : ''}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(saved)}
                      className="h-7 w-7 p-0"
                      title="Edit query"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteQuery(saved.id)}
                      className="h-7 w-7 p-0"
                      title="Delete query"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tables & Templates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Query Builder</CardTitle>
          <CardDescription className="text-xs">
            {tables.length > 0 
              ? 'Select a table and use templates to quickly generate queries'
              : 'Use templates to generate queries (no tables detected yet)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table Selection */}
          {tables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => {
                    setSelectedTable(table)
                    insertTableQuery(table)
                  }}
                  className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                    selectedTable === table
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-accent'
                  }`}
                >
                  <Table className="h-3 w-3 inline mr-1" />
                  {table}
                </button>
              ))}
            </div>
          )}

          {/* Query Templates */}
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs space-y-1.5">
              <Label htmlFor="sql-template-select" className="text-xs">
                <FileCode className="h-3 w-3 inline mr-1" />
                Query Templates
              </Label>
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger id="sql-template-select" className="h-9">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {sqlTemplates.map((template) => (
                    <SelectItem
                      key={template.id}
                      value={template.id}
                      disabled={template.requiresTable && !selectedTable}
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        — {template.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTable && (
              <p className="text-xs text-muted-foreground pb-2">
                Using table: <code className="font-mono bg-muted px-1 rounded">{selectedTable}</code>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Query Editor */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">SQL Query</CardTitle>
            <span className="text-xs text-muted-foreground">
              Ctrl+Enter to execute
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            id="sql-query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SELECT * FROM users LIMIT 10"
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Button onClick={() => void executeQuery()} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Execute
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setError('')
                }}
                disabled={loading || !query}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
              {result && result.results.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
            {history.length > 0 && (
              <select
                id="sql-history-select"
                onChange={(e) => setQuery(e.target.value)}
                value=""
                className="text-xs px-2 py-1 border rounded bg-background"
                aria-label="Recent queries"
              >
                <option value="">Recent queries...</option>
                {history.map((q, i) => (
                  <option key={i} value={q}>
                    {q.substring(0, 50)}...
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">SQL Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive font-mono whitespace-pre-wrap">
              {error.includes('SQLITE_ERROR') || error.includes('syntax error')
                ? `Syntax Error: ${error.replace(/^.*?:/, '').replace(/SQL execution failed:?\s*/i, '').trim()}`
                : error}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Check your SQL syntax and try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Results ({result.rowCount} {result.rowCount === 1 ? 'row' : 'rows'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results returned</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(result.results[0] as Record<string, unknown>).map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row as Record<string, unknown>).map((val, j) => {
                          let displayValue: string
                          if (val === null) {
                            displayValue = ''
                          } else if (typeof val === 'object') {
                            displayValue = JSON.stringify(val)
                          } else if (typeof val === 'string') {
                            displayValue = val
                          } else if (typeof val === 'number' || typeof val === 'boolean') {
                            displayValue = String(val)
                          } else if (val === undefined) {
                            displayValue = ''
                          } else {
                            displayValue = ''
                          }

                          return (
                            <td key={j} className="px-3 py-2 font-mono text-xs">
                              {val === null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : (
                                displayValue
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Query Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query</DialogTitle>
            <DialogDescription>
              Save this query for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-query-name">Name</Label>
              <Input
                id="save-query-name"
                name="save-query-name"
                placeholder="e.g., All Active Users"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-query-description">Description (optional)</Label>
              <Input
                id="save-query-description"
                name="save-query-description"
                placeholder="e.g., Fetches all users with active status"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Query Preview</Label>
              <pre className="p-2 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-32">
                {query}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveQuery()}
              disabled={savingQuery || !queryName.trim()}
            >
              {savingQuery ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Query Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Saved Query</DialogTitle>
            <DialogDescription>
              Update this saved query
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-query-name">Name</Label>
              <Input
                id="edit-query-name"
                name="edit-query-name"
                placeholder="e.g., All Active Users"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-query-description">Description (optional)</Label>
              <Input
                id="edit-query-description"
                name="edit-query-description"
                placeholder="e.g., Fetches all users with active status"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-query-sql">Query</Label>
              <textarea
                id="edit-query-sql"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateQuery()}
              disabled={savingQuery || !queryName.trim()}
            >
              {savingQuery ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
