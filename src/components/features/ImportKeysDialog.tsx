import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, FileJson, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
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
import { importApi, type ParsedImportData } from '../../services/importApi'

interface ImportKeysDialogProps {
  instanceId: string
  instanceName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error'

export function ImportKeysDialog({
  instanceId,
  instanceName,
  open,
  onOpenChange,
  onSuccess,
}: ImportKeysDialogProps): React.ReactElement {
  const [state, setState] = useState<ImportState>('idle')
  const [error, setError] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedImportData | null>(null)
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge')
  const [importedCount, setImportedCount] = useState<number>(0)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback((): void => {
    setState('idle')
    setError('')
    setParsedData(null)
    setMergeMode('merge')
    setImportedCount(0)
    setSelectedFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleOpenChange = useCallback((isOpen: boolean): void => {
    if (!isOpen) {
      resetState()
    }
    onOpenChange(isOpen)
  }, [onOpenChange, resetState])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    setState('parsing')
    setError('')
    setSelectedFileName(file.name)

    try {
      const parsed = await importApi.readAndParseFile(file)
      setParsedData(parsed)
      setState('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setState('error')
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!parsedData) return

    setState('importing')
    setError('')

    try {
      const result = await importApi.importKeys(instanceId, parsedData.data, mergeMode)
      setImportedCount(result.imported)
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setState('error')
    }
  }

  const handleDone = (): void => {
    handleOpenChange(false)
    onSuccess()
  }

  const handleTryAgain = (): void => {
    resetState()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Keys</DialogTitle>
          <DialogDescription>
            Import storage keys from a JSON file into {instanceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Idle / File Selection State */}
          {(state === 'idle' || state === 'parsing') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">Select JSON File</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="import-file"
                    name="import-file"
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => void handleFileSelect(e)}
                    className="hidden"
                    disabled={state === 'parsing'}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={state === 'parsing'}
                    className="w-full"
                  >
                    {state === 'parsing' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>
                {selectedFileName && state === 'parsing' && (
                  <p className="text-sm text-muted-foreground">{selectedFileName}</p>
                )}
              </div>

              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                <FileJson className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Accepts JSON files with key-value data</p>
                <p className="text-xs mt-1">or exported instance storage files</p>
              </div>
            </div>
          )}

          {/* Preview State */}
          {state === 'preview' && parsedData && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="rounded-lg bg-muted p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{selectedFileName}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><strong>{parsedData.keyCount}</strong> key{parsedData.keyCount !== 1 ? 's' : ''} to import</p>
                  {parsedData.exportedAt && (
                    <p className="text-xs">Exported: {new Date(parsedData.exportedAt).toLocaleString()}</p>
                  )}
                  {parsedData.sourceInstance?.name && (
                    <p className="text-xs">Source: {parsedData.sourceInstance.name}</p>
                  )}
                </div>
              </div>

              {/* Keys Preview */}
              <div className="space-y-2">
                <Label>Keys to Import</Label>
                <div className="rounded-lg border p-2 max-h-32 overflow-y-auto">
                  <ul className="text-sm font-mono space-y-1">
                    {parsedData.keys.slice(0, 10).map((key) => (
                      <li key={key} className="truncate text-muted-foreground">
                        {key}
                      </li>
                    ))}
                    {parsedData.keys.length > 10 && (
                      <li className="text-xs text-muted-foreground italic">
                        ... and {parsedData.keys.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Merge Mode Selection */}
              <div className="space-y-2">
                <Label htmlFor="merge-mode">Import Mode</Label>
                <Select
                  value={mergeMode}
                  onValueChange={(value: 'merge' | 'replace') => setMergeMode(value)}
                >
                  <SelectTrigger id="merge-mode" name="merge-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge">
                      Merge with existing keys
                    </SelectItem>
                    <SelectItem value="replace">
                      Replace all keys (overwrites)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mergeMode === 'merge'
                    ? 'Existing keys with the same name will be overwritten, other keys are preserved.'
                    : 'All existing keys will be deleted and replaced with imported keys.'}
                </p>
              </div>
            </div>
          )}

          {/* Importing State */}
          {state === 'importing' && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Importing {parsedData?.keyCount ?? 0} keys...
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="py-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="font-medium">Import Successful</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importedCount} key{importedCount !== 1 ? 's' : ''} imported successfully
              </p>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="py-4">
              <div className="rounded-lg bg-destructive/10 border border-destructive p-4 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                <p className="font-medium text-destructive">Import Failed</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {state === 'idle' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {state === 'preview' && (
            <>
              <Button variant="outline" onClick={handleTryAgain}>
                Choose Different File
              </Button>
              <Button onClick={() => void handleImport()}>
                Import {parsedData?.keyCount ?? 0} Keys
              </Button>
            </>
          )}

          {state === 'success' && (
            <Button onClick={handleDone}>
              Done
            </Button>
          )}

          {state === 'error' && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleTryAgain}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

