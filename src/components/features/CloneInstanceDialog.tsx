import { useState } from 'react'
import { Loader2, Copy } from 'lucide-react'
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

interface CloneInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceInstance: Instance | null
  onComplete: (instance: Instance) => void
}

export function CloneInstanceDialog({
  open,
  onOpenChange,
  sourceInstance,
  onComplete,
}: CloneInstanceDialogProps): React.ReactElement {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = (): void => {
    setNewName('')
    setError('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!newName.trim()) {
      setError('New instance name is required')
      return
    }

    if (!sourceInstance) {
      setError('No source instance selected')
      return
    }

    // Check if name is same as source
    const sourceName = sourceInstance.name ?? sourceInstance.object_id
    if (newName.trim() === sourceName) {
      setError('New name must be different from the source instance')
      return
    }

    try {
      setLoading(true)
      setError('')

      const result = await instanceApi.clone(sourceInstance.id, newName.trim())
      onComplete(result.instance)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone instance')
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

  const sourceName = sourceInstance?.name ?? sourceInstance?.object_id ?? 'Unknown'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Instance
          </DialogTitle>
          <DialogDescription>
            Create a copy of the instance with a new name. All storage data will be cloned.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="clone-source">Source Instance</Label>
            <Input
              id="clone-source"
              value={sourceName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-new-name">New Instance Name</Label>
            <Input
              id="clone-new-name"
              placeholder="Enter new instance name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This will create a new Durable Object instance with all the storage data from the source.
            </p>
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
            Clone Instance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

