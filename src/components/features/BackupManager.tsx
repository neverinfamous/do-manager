import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, Loader2, Archive, Clock } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { backupApi, type Backup } from '../../services/backupApi'

interface BackupManagerProps {
  instanceId: string
}

export function BackupManager({
  instanceId,
}: BackupManagerProps) {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>('')
  const [restoreDialog, setRestoreDialog] = useState<Backup | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadBackups = async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await backupApi.listForInstance(instanceId)
      setBackups(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async (): Promise<void> => {
    try {
      setCreating(true)
      setError('')
      const backup = await backupApi.create(instanceId)
      setBackups((prev) => [backup, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backup: Backup): Promise<void> => {
    try {
      setRestoring(true)
      setError('')
      await backupApi.restore(instanceId, backup.id)
      setRestoreDialog(null)
      // Could trigger a refresh of storage data here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup')
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async (backup: Backup): Promise<void> => {
    if (!confirm('Delete this backup? This cannot be undone.')) {
      return
    }
    try {
      await backupApi.delete(backup.id)
      setBackups((prev) => prev.filter((b) => b.id !== backup.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup')
    }
  }

  useEffect(() => {
    void loadBackups()
  }, [instanceId])

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (bytes: number | null): string => {
    if (bytes === null) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Backups</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => void handleCreateBackup()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Create Backup
          </Button>
        </div>
        <CardDescription>
          Snapshot storage to R2 for safekeeping
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups yet</p>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(backup.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(backup.size_bytes)} • {backup.storage_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRestoreDialog(backup)}
                    title="Restore"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(backup)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreDialog !== null}
        onOpenChange={(open) => !open && setRestoreDialog(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              This will overwrite all current storage with the backup data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {restoreDialog && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Backup from:</strong>{' '}
                  {formatDate(restoreDialog.created_at)}
                </p>
                <p className="text-sm">
                  <strong>Size:</strong> {formatSize(restoreDialog.size_bytes)}
                </p>
              </div>
            )}
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                Warning: This action cannot be undone. Current storage will be
                replaced with the backup data.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialog(null)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              onClick={() => restoreDialog && void handleRestore(restoreDialog)}
              disabled={restoring}
            >
              {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

