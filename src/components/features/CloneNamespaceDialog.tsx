import { useState } from 'react'
import { Loader2, Copy, AlertTriangle, Info } from 'lucide-react'
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
import { Checkbox } from '../ui/checkbox'
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
  const [deepClone, setDeepClone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cloneResult, setCloneResult] = useState<{
    instancesCloned?: number
    warnings?: string[]
  } | null>(null)

  // Check if admin hooks are enabled
  const adminHooksEnabled = Boolean(
    sourceNamespace?.endpoint_url && sourceNamespace.admin_hook_enabled === 1
  )

  const resetForm = (): void => {
    setNewName('')
    setDeepClone(false)
    setError('')
    setCloneResult(null)
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
      setCloneResult(null)

      const result = await namespaceApi.clone(
        sourceNamespace.id,
        newName.trim(),
        deepClone
      )

      // Show result info if deep clone
      if (deepClone && (result.instancesCloned !== undefined || result.warnings)) {
        setCloneResult({
          ...(result.instancesCloned !== undefined ? { instancesCloned: result.instancesCloned } : {}),
          ...(result.warnings !== undefined ? { warnings: result.warnings } : {}),
        })
      }

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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Namespace
          </DialogTitle>
          <DialogDescription>
            {deepClone
              ? 'Create a complete copy including all instances and their storage data.'
              : 'Create a new namespace with the same configuration settings.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div
              className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm flex items-start gap-2"
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {cloneResult && (
            <div
              className="bg-green-500/10 border border-green-500 text-green-700 dark:text-green-400 px-3 py-2 rounded text-sm"
              role="status"
            >
              <p>Cloned {cloneResult.instancesCloned ?? 0} instance(s)</p>
              {cloneResult.warnings && cloneResult.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {cloneResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
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
              aria-describedby="clone-ns-new-name-hint"
            />
            <p id="clone-ns-new-name-hint" className="text-xs text-muted-foreground">
              Enter a unique name for the new namespace.
            </p>
          </div>

          {/* Deep Clone Toggle */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="clone-ns-deep"
                checked={deepClone}
                onCheckedChange={(checked) => setDeepClone(checked === true)}
                disabled={!adminHooksEnabled}
                aria-describedby="clone-ns-deep-hint"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="clone-ns-deep"
                  className={`cursor-pointer ${!adminHooksEnabled ? 'text-muted-foreground' : ''}`}
                >
                  Deep Clone (include instances and storage)
                </Label>
                <p
                  id="clone-ns-deep-hint"
                  className="text-xs text-muted-foreground"
                >
                  {adminHooksEnabled
                    ? 'Copies all instances and their storage data to the new namespace.'
                    : 'Requires admin hooks to be enabled on the source namespace.'}
                </p>
              </div>
            </div>

            {deepClone && adminHooksEnabled && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-muted rounded text-xs">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Deep clone copies instances sequentially. Large namespaces may take longer.
                  If cloning fails, created data will be automatically cleaned up.
                </span>
              </div>
            )}
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
            {deepClone ? 'Deep Clone' : 'Clone Namespace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

