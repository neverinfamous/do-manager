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
import { namespaceApi } from '../../services/api'
import type { Namespace } from '../../types'

interface CloneNamespaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceNamespace: Namespace | null
  onComplete: (namespace: Namespace) => void
}

export function CloneNamespaceDialog({
  open,
  onOpenChange,
  sourceNamespace,
  onComplete,
}: CloneNamespaceDialogProps): React.ReactElement {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = (): void => {
    setNewName('')
    setError('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!newName.trim()) {
      setError('New namespace name is required')
      return
    }

    if (!sourceNamespace) {
      setError('No source namespace selected')
      return
    }

    if (newName.trim() === sourceNamespace.name) {
      setError('New name must be different from the source namespace')
      return
    }

    try {
      setLoading(true)
      setError('')

      const result = await namespaceApi.clone(sourceNamespace.id, newName.trim())
      onComplete(result.namespace)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone namespace')
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
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Namespace
          </DialogTitle>
          <DialogDescription>
            Create a copy of the namespace configuration with a new name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="clone-ns-source">Source Namespace</Label>
            <Input
              id="clone-ns-source"
              value={sourceNamespace?.name ?? ''}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-ns-class">Class Name</Label>
            <Input
              id="clone-ns-class"
              value={sourceNamespace?.class_name ?? ''}
              disabled
              className="bg-muted font-mono text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-ns-new-name">New Namespace Name</Label>
            <Input
              id="clone-ns-new-name"
              placeholder="Enter new namespace name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This will create a new namespace entry with the same class, script, and endpoint configuration.
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
            Clone Namespace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

