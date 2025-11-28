import { useState } from 'react'
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
import { instanceApi } from '../../services/instanceApi'
import type { Instance } from '../../types'

interface CreateInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  namespaceId: string
  onComplete: (instance: Instance) => void
}

export function CreateInstanceDialog({
  open,
  onOpenChange,
  namespaceId,
  onComplete,
}: CreateInstanceDialogProps) {
  const [name, setName] = useState('')
  const [objectId, setObjectId] = useState('')
  const [idType, setIdType] = useState<'name' | 'hex'>('name')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = (): void => {
    setName('')
    setObjectId('')
    setIdType('name')
    setError('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!objectId.trim()) {
      setError('Object ID or Name is required')
      return
    }

    // For name-based IDs, the object_id will be derived from the name
    // For hex IDs, validate the format
    if (idType === 'hex') {
      const hexRegex = /^[a-f0-9]{64}$/i
      if (!hexRegex.test(objectId.trim())) {
        setError('Hex ID must be exactly 64 hexadecimal characters')
        return
      }
    }

    try {
      setLoading(true)
      setError('')
      
      const result = await instanceApi.create(namespaceId, {
        name: name.trim() || (idType === 'name' ? objectId.trim() : undefined),
        object_id: objectId.trim(),
      })
      
      onComplete(result.instance)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add instance')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Instance</DialogTitle>
          <DialogDescription>
            Track a Durable Object instance by its name or ID
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label>ID Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="id_type"
                  value="name"
                  checked={idType === 'name'}
                  onChange={() => setIdType('name')}
                  className="accent-primary"
                />
                <span className="text-sm">Named (idFromName)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="id_type"
                  value="hex"
                  checked={idType === 'hex'}
                  onChange={() => setIdType('hex')}
                  className="accent-primary"
                />
                <span className="text-sm">Hex ID (newUniqueId)</span>
              </label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="object_id">
              {idType === 'name' ? 'Object Name' : 'Object ID (64-char hex)'}
            </Label>
            <Input
              id="object_id"
              placeholder={idType === 'name' ? 'my-object-name' : 'a1b2c3d4...'}
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
              className={idType === 'hex' ? 'font-mono text-xs' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {idType === 'name'
                ? 'The name used with idFromName() or getByName()'
                : 'The 64-character hex ID from newUniqueId()'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display_name">Display Name (optional)</Label>
            <Input
              id="display_name"
              placeholder="Friendly name for this instance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Instance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

