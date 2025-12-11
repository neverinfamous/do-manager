import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, Loader2, FileJson, AlertCircle, CheckCircle, ClipboardPaste, Wand2, CheckCircle2 } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { importApi, type ParsedImportData } from '../../services/importApi'
import { formatJson } from '../../lib/jsonAutocomplete'

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
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file')
  const [pastedJson, setPastedJson] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Real-time JSON validation for paste mode
  const jsonValidation = useMemo(() => {
    if (!pastedJson.trim()) {
      return { isValid: false, error: undefined, keyCount: 0 }
    }
    try {
      const parsed = JSON.parse(pastedJson) as unknown
      if (!parsed || typeof parsed !== 'object') {
        return { isValid: false, error: 'JSON must be an object', keyCount: 0 }
      }
      const obj = parsed as Record<string, unknown>
      // Check for export format with 'data' property
      if ('data' in obj && obj['data'] && typeof obj['data'] === 'object') {
        const data = obj['data'] as Record<string, unknown>
        return { isValid: true, error: undefined, keyCount: Object.keys(data).length }
      }
      // Raw key-value object
      const keys = Object.keys(obj)
      if (keys.length === 0) {
        return { isValid: false, error: 'No keys found in JSON', keyCount: 0 }
      }
      return { isValid: true, error: undefined, keyCount: keys.length }
    } catch (err) {
      const message = err instanceof SyntaxError ? err.message : 'Invalid JSON'
      return { isValid: false, error: message, keyCount: 0 }
    }
  }, [pastedJson])

  // Format JSON button handler
  const handleFormatJson = useCallback((): void => {
    const formatted = formatJson(pastedJson)
    if (formatted) {
      setPastedJson(formatted)
    }
  }, [pastedJson])

  const resetState = useCallback((): void => {
    setState('idle')
    setError('')
    setParsedData(null)
    setMergeMode('merge')
    setImportedCount(0)
    setSelectedFileName('')
    setInputMode('file')
    setPastedJson('')
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

  const handlePasteJson = (): void => {
    if (!pastedJson.trim()) {
      setError('Please paste JSON content')
      setState('error')
      return
    }

    setState('parsing')
    setError('')

    try {
      const parsed = importApi.parseImportFile(pastedJson)
      setParsedData(parsed)
      setSelectedFileName('Pasted JSON')
      setState('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON')
      setState('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Keys</DialogTitle>
          <DialogDescription>
            Import storage keys from a JSON file or paste JSON directly into {instanceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Idle / File Selection State */}
          {(state === 'idle' || state === 'parsing') && (
            <div className="space-y-4">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'file' | 'paste')}>
                <TabsList className="w-full">
                  <TabsTrigger value="file" className="flex-1 flex items-center justify-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="flex-1 flex items-center justify-center gap-2">
                    <ClipboardPaste className="h-4 w-4" />
                    Paste JSON
                  </TabsTrigger>
                </TabsList>

                {/* File Upload Tab */}
                <TabsContent value="file" className="space-y-4 mt-4">
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
                        {state === 'parsing' && inputMode === 'file' ? (
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
                    {selectedFileName && state === 'parsing' && inputMode === 'file' && (
                      <p className="text-sm text-muted-foreground">{selectedFileName}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    <FileJson className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Accepts JSON files with key-value data</p>
                    <p className="text-xs mt-1">or exported instance storage files</p>
                  </div>
                </TabsContent>

                {/* Paste JSON Tab */}
                <TabsContent value="paste" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="json-paste-textarea">Paste JSON Data</Label>
                      <div className="flex items-center gap-2">
                        {pastedJson.trim() && jsonValidation.isValid && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleFormatJson}
                            title="Format JSON"
                          >
                            <Wand2 className="h-3 w-3 mr-1" />
                            Format
                          </Button>
                        )}
                        {pastedJson.trim() && (
                          <span className={`text-xs flex items-center gap-1 ${jsonValidation.isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                            }`}>
                            {jsonValidation.isValid ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Valid JSON ({jsonValidation.keyCount} key{jsonValidation.keyCount !== 1 ? 's' : ''})
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                {jsonValidation.error}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <textarea
                      id="json-paste-textarea"
                      name="json-paste-textarea"
                      value={pastedJson}
                      onChange={(e) => setPastedJson(e.target.value)}
                      placeholder='{&#10;  "key1": "value1",&#10;  "key2": "value2"&#10;}'
                      className={`w-full min-h-[140px] rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y ${pastedJson.trim() && !jsonValidation.isValid
                          ? 'border-destructive bg-destructive/5'
                          : 'border-input bg-background'
                        }`}
                      aria-describedby="json-format-hint"
                      aria-invalid={pastedJson.trim() ? !jsonValidation.isValid : undefined}
                      disabled={state === 'parsing'}
                    />
                    <p id="json-format-hint" className="text-xs text-muted-foreground">
                      Accepts key-value objects or exported instance storage files
                    </p>
                  </div>

                  <Button
                    onClick={handlePasteJson}
                    disabled={state === 'parsing' || !pastedJson.trim()}
                    className="w-full"
                  >
                    {state === 'parsing' && inputMode === 'paste' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      'Parse JSON'
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
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
                <p className="text-sm font-medium leading-none">Keys to Import</p>
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

