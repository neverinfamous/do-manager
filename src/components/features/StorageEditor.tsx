import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
import { storageApi } from '../../services/storageApi'

interface StorageEditorProps {
  instanceId: string
  keyName: string | null // null means creating new key
  onClose: () => void
  onSave: () => void
}

export function StorageEditor({
  instanceId,
  keyName,
  onClose,
  onSave,
}: StorageEditorProps) {
  const [key, setKey] = useState(keyName ?? '')
  const [value, setValue] = useState('')
  const [valueType, setValueType] = useState<'json' | 'string'>('json')
  const [loading, setLoading] = useState(keyName !== null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (keyName !== null) {
      void loadValue()
    }
  }, [keyName])

  const loadValue = async (): Promise<void> => {
    if (!keyName) return
    
    try {
      setLoading(true)
      setError('')
      const data = await storageApi.get(instanceId, keyName)
      
      // Format the value for display
      if (typeof data.value === 'string') {
        setValue(data.value)
        setValueType('string')
      } else {
        setValue(JSON.stringify(data.value, null, 2))
        setValueType('json')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load value')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!key.trim()) {
      setError('Key is required')
      return
    }

    let parsedValue: unknown
    if (valueType === 'json') {
      try {
        parsedValue = JSON.parse(value)
      } catch {
        setError('Invalid JSON value')
        return
      }
    } else {
      parsedValue = value
    }

    try {
      setSaving(true)
      setError('')
      await storageApi.set(instanceId, key, parsedValue)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save value')
    } finally {
      setSaving(false)
    }
  }

  const isNewKey = keyName === null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
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
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!isNewKey}
                placeholder="my-key"
                className={!isNewKey ? 'font-mono bg-muted' : 'font-mono'}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="value">Value</Label>
                <fieldset className="flex gap-2">
                  <legend className="sr-only">Value Type</legend>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="value_type"
                      id="value-type-json"
                      checked={valueType === 'json'}
                      onChange={() => setValueType('json')}
                      className="accent-primary"
                    />
                    JSON
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="value_type"
                      id="value-type-string"
                      checked={valueType === 'string'}
                      onChange={() => setValueType('string')}
                      className="accent-primary"
                    />
                    String
                  </label>
                </fieldset>
              </div>
              <textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={valueType === 'json' ? '{ "key": "value" }' : 'value'}
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {valueType === 'json' && (
                <p className="text-xs text-muted-foreground">
                  Enter valid JSON (objects, arrays, strings, numbers, booleans, null)
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isNewKey ? 'Add Key' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

