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
import { namespaceApi } from '../../services/api'
import type { Namespace } from '../../types'

interface AddNamespaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (namespace: Namespace) => void
}

export function AddNamespaceDialog({
  open,
  onOpenChange,
  onComplete,
}: AddNamespaceDialogProps) {
  const [name, setName] = useState('')
  const [className, setClassName] = useState('')
  const [scriptName, setScriptName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [storageBackend, setStorageBackend] = useState<'sqlite' | 'kv'>('sqlite')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = (): void => {
    setName('')
    setClassName('')
    setScriptName('')
    setEndpointUrl('')
    setStorageBackend('sqlite')
    setError('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim() || !className.trim()) {
      setError('Name and Class Name are required')
      return
    }

    try {
      setLoading(true)
      setError('')
      const namespace = await namespaceApi.add({
        name: name.trim(),
        class_name: className.trim(),
        script_name: scriptName.trim() || undefined,
        endpoint_url: endpointUrl.trim() || undefined,
        storage_backend: storageBackend,
      })
      onComplete(namespace)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add namespace')
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
          <DialogTitle>Add Namespace</DialogTitle>
          <DialogDescription>
            Manually add a Durable Object namespace to manage
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="My Durable Object"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="class_name">Class Name *</Label>
            <Input
              id="class_name"
              placeholder="MyDurableObject"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The exported class name in your Worker
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="script_name">Script Name</Label>
            <Input
              id="script_name"
              placeholder="my-worker"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endpoint_url">Endpoint URL</Label>
            <Input
              id="endpoint_url"
              placeholder="https://my-worker.account.workers.dev"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Worker URL for admin hook requests
            </p>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Storage Backend</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="storage_backend"
                  id="add-storage-sqlite"
                  value="sqlite"
                  checked={storageBackend === 'sqlite'}
                  onChange={() => setStorageBackend('sqlite')}
                  className="accent-primary"
                />
                <span className="text-sm">SQLite</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="storage_backend"
                  id="add-storage-kv"
                  value="kv"
                  checked={storageBackend === 'kv'}
                  onChange={() => setStorageBackend('kv')}
                  className="accent-primary"
                />
                <span className="text-sm">KV (Legacy)</span>
              </label>
            </div>
          </fieldset>
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
            Add Namespace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

