import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { storageApi } from '../../services/storageApi'

type ValueType = 'string' | 'json' | 'number' | 'boolean'

interface StorageEditorProps {
  instanceId: string
  keyName: string | null // null means creating new key
  onClose: () => void
  onSave: () => void
}

interface ValidationResult {
  isValid: boolean
  error?: string
  parsedValue?: unknown
}

/**
 * Validate value based on type
 */
function validateValue(value: string, type: ValueType): ValidationResult {
  switch (type) {
    case 'string':
      return { isValid: true, parsedValue: value }

    case 'number': {
      const trimmed = value.trim()
      if (trimmed === '') {
        return { isValid: false, error: 'Number value is required' }
      }
      const num = Number(trimmed)
      if (isNaN(num)) {
        return { isValid: false, error: 'Invalid number format' }
      }
      return { isValid: true, parsedValue: num }
    }

    case 'boolean': {
      const lower = value.trim().toLowerCase()
      if (lower === 'true') {
        return { isValid: true, parsedValue: true }
      }
      if (lower === 'false') {
        return { isValid: true, parsedValue: false }
      }
      return { isValid: false, error: 'Must be "true" or "false"' }
    }

    case 'json': {
      const trimmed = value.trim()
      if (trimmed === '') {
        return { isValid: false, error: 'JSON value is required' }
      }
      try {
        const parsed = JSON.parse(trimmed) as unknown
        return { isValid: true, parsedValue: parsed }
      } catch (err) {
        const message = err instanceof SyntaxError ? err.message : 'Invalid JSON'
        return { isValid: false, error: message }
      }
    }
  }
}

/**
 * Detect value type from loaded data
 */
function detectValueType(value: unknown): ValueType {
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'json'
}

/**
 * Format value for display in textarea
 */
function formatValueForDisplay(value: unknown, type: ValueType): string {
  if (type === 'string' && typeof value === 'string') {
    return value
  }
  if (type === 'number' && typeof value === 'number') {
    return String(value)
  }
  if (type === 'boolean' && typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

export function StorageEditor({
  instanceId,
  keyName,
  onClose,
  onSave,
}: StorageEditorProps): React.ReactElement {
  const [key, setKey] = useState(keyName ?? '')
  const [value, setValue] = useState('')
  const [valueType, setValueType] = useState<ValueType>('json')
  const [loading, setLoading] = useState(keyName !== null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Real-time validation
  const validation = useMemo(() => validateValue(value, valueType), [value, valueType])

  const loadValue = useCallback(async (): Promise<void> => {
    if (!keyName) return
    
    try {
      setLoading(true)
      setError('')
      const data = await storageApi.get(instanceId, keyName)
      
      // Detect and set type based on value
      const detectedType = detectValueType(data.value)
      setValueType(detectedType)
      setValue(formatValueForDisplay(data.value, detectedType))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load value')
    } finally {
      setLoading(false)
    }
  }, [instanceId, keyName])

  useEffect(() => {
    if (keyName !== null) {
      void loadValue()
    }
  }, [keyName, loadValue])

  const handleTypeChange = (newType: ValueType): void => {
    setValueType(newType)
    // Set default placeholder values for new keys
    if (keyName === null && value === '') {
      switch (newType) {
        case 'string':
          setValue('')
          break
        case 'number':
          setValue('0')
          break
        case 'boolean':
          setValue('true')
          break
        case 'json':
          setValue('{}')
          break
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Key is required')
      return
    }

    if (!validation.isValid) {
      setError(validation.error ?? 'Invalid value')
      return
    }

    try {
      setSaving(true)
      setError('')
      await storageApi.set(instanceId, key, validation.parsedValue)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save value')
    } finally {
      setSaving(false)
    }
  }

  const isNewKey = keyName === null

  // Format preview value
  const previewContent = useMemo(() => {
    if (!validation.isValid) return null
    
    const parsed = validation.parsedValue
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(parsed, null, 2)
    }
    return String(parsed)
  }, [validation])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNewKey ? 'Add Key' : 'Edit Key'}</DialogTitle>
          <DialogDescription>
            {isNewKey
              ? 'Add a new key-value pair to storage'
              : `Edit the value for key: ${keyName}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Key Input */}
            <div className="grid gap-2">
              <Label htmlFor="storage-key-input">Key</Label>
              <Input
                id="storage-key-input"
                name="storage-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!isNewKey}
                placeholder="my-key"
                className={!isNewKey ? 'font-mono bg-muted' : 'font-mono'}
              />
            </div>

            {/* Type Selector */}
            <div className="grid gap-2">
              <Label htmlFor="value-type-select">Value Type</Label>
              <Select value={valueType} onValueChange={(v) => handleTypeChange(v as ValueType)}>
                <SelectTrigger id="value-type-select" className="w-[180px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {valueType === 'string' && 'Plain text value stored as-is'}
                {valueType === 'json' && 'Objects, arrays, or any valid JSON'}
                {valueType === 'number' && 'Integer or decimal number'}
                {valueType === 'boolean' && 'true or false'}
              </p>
            </div>

            {/* Value Input */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="storage-value-input">Value</Label>
                {value && (
                  <span className={`text-xs flex items-center gap-1 ${
                    validation.isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                  }`}>
                    {validation.isValid ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Valid {valueType}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        {validation.error}
                      </>
                    )}
                  </span>
                )}
              </div>
              <textarea
                id="storage-value-input"
                name="storage-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  valueType === 'json' ? '{ "key": "value" }' :
                  valueType === 'number' ? '42' :
                  valueType === 'boolean' ? 'true' :
                  'Enter value...'
                }
                className={`flex min-h-[160px] w-full rounded-md border px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  value && !validation.isValid 
                    ? 'border-destructive bg-destructive/5' 
                    : 'border-input bg-background'
                }`}
              />
            </div>

            {/* Value Preview */}
            {validation.isValid && previewContent && (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPreview ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Preview parsed value
                </button>
                {showPreview && (
                  <div className="bg-muted rounded-md p-3 overflow-auto max-h-[150px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {previewContent}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      Type: <code className="bg-background px-1 rounded">{typeof validation.parsedValue}</code>
                      {Array.isArray(validation.parsedValue) && (
                        <span className="ml-2">
                          Length: <code className="bg-background px-1 rounded">{validation.parsedValue.length}</code>
                        </span>
                      )}
                      {typeof validation.parsedValue === 'object' && validation.parsedValue !== null && !Array.isArray(validation.parsedValue) && (
                        <span className="ml-2">
                          Keys: <code className="bg-background px-1 rounded">{Object.keys(validation.parsedValue).length}</code>
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={() => void handleSave()} 
            disabled={loading || saving || !validation.isValid}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isNewKey ? 'Add Key' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
