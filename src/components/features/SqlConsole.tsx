import { useState } from 'react'
import { Play, Loader2, Table, Download } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { storageApi, type SqlResponse } from '../../services/storageApi'

interface SqlConsoleProps {
  instanceId: string
  tables: string[]
}

export function SqlConsole({ instanceId, tables }: SqlConsoleProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SqlResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [history, setHistory] = useState<string[]>([])

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

  return (
    <div className="space-y-4">
      {/* Tables List */}
      {tables.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Available Tables</CardTitle>
            <CardDescription className="text-xs">
              Click a table to generate a SELECT query
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => insertTableQuery(table)}
                  className="px-2 py-1 text-xs font-mono rounded bg-muted hover:bg-accent transition-colors"
                >
                  <Table className="h-3 w-3 inline mr-1" />
                  {table}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {result && result.results.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
            {history.length > 0 && (
              <select
                onChange={(e) => setQuery(e.target.value)}
                value=""
                className="text-xs px-2 py-1 border rounded bg-background"
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
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
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
                        {Object.values(row as Record<string, unknown>).map((val, j) => (
                          <td key={j} className="px-3 py-2 font-mono text-xs">
                            {val === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

