import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import type { Namespace } from '../../types'
import { namespaceApi } from '../../services/api'

interface NamespaceSettingsDialogProps {
  namespace: Namespace | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (namespace: Namespace) => void
}

export function NamespaceSettingsDialog({
  namespace,
  open,
  onOpenChange,
  onUpdate,
}: NamespaceSettingsDialogProps): React.ReactNode {
  const [name, setName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [storageBackend, setStorageBackend] = useState<'sqlite' | 'kv'>('sqlite')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (namespace) {
      setName(namespace.name)
      setEndpointUrl(namespace.endpoint_url ?? '')
      setStorageBackend(namespace.storage_backend)
    }
  }, [namespace])

  const handleSave = async (): Promise<void> => {
    if (!namespace) return
    
    try {
      setSaving(true)
      setError('')
      
      // Auto-enable admin hooks when endpoint URL is provided
      const hasEndpoint = endpointUrl.trim().length > 0
      
      const updated = await namespaceApi.update(namespace.id, {
        name,
        endpoint_url: hasEndpoint ? endpointUrl.trim() : null,
        admin_hook_enabled: hasEndpoint ? 1 : 0,
        storage_backend: storageBackend,
      })
      
      onUpdate(updated)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!namespace) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Namespace Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {namespace.class_name}
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Display Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Namespace name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endpoint">Admin Hook Endpoint URL</Label>
            <Input
              id="endpoint"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://your-worker.workers.dev"
            />
            <p className="text-xs text-muted-foreground">
              Your Worker URL with admin hooks installed. Admin hooks are auto-enabled when a URL is set.
            </p>
          </div>
          
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Storage Backend</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="storage"
                  id="storage-sqlite"
                  checked={storageBackend === 'sqlite'}
                  onChange={() => setStorageBackend('sqlite')}
                  className="w-4 h-4"
                />
                <span>SQLite</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="storage"
                  id="storage-kv"
                  checked={storageBackend === 'kv'}
                  onChange={() => setStorageBackend('kv')}
                  className="w-4 h-4"
                />
                <span>Key-Value</span>
              </label>
            </div>
          </fieldset>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

