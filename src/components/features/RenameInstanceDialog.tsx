import { useState, useEffect } from 'react'
import { Loader2, Pencil } from 'lucide-react'
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

interface RenameInstanceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    instance: Instance | null
    onComplete: (instance: Instance) => void
}

export function RenameInstanceDialog({
    open,
    onOpenChange,
    instance,
    onComplete,
}: RenameInstanceDialogProps): React.ReactElement {
    const [newName, setNewName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Pre-fill with current name when dialog opens
    useEffect(() => {
        if (open && instance) {
            setNewName(instance.name ?? instance.object_id)
        }
    }, [open, instance])

    const resetForm = (): void => {
        setNewName('')
        setError('')
    }

    const handleSubmit = async (): Promise<void> => {
        if (!newName.trim()) {
            setError('Instance name is required')
            return
        }

        if (!instance) {
            setError('No instance selected')
            return
        }

        // Check if name is actually changed
        const currentName = instance.name ?? instance.object_id
        if (newName.trim() === currentName) {
            setError('New name must be different from the current name')
            return
        }

        try {
            setLoading(true)
            setError('')

            const updated = await instanceApi.rename(instance.id, newName.trim(), instance.namespace_id)
            onComplete(updated)
            resetForm()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to rename instance')
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

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Enter' && !loading) {
            void handleSubmit()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5" />
                        Rename Instance
                    </DialogTitle>
                    <DialogDescription>
                        Change the display name for this tracked instance.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {error && (
                        <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="rename-instance-input">Instance Name</Label>
                        <Input
                            id="rename-instance-input"
                            placeholder="Enter new instance name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            This updates the display name in DO Manager. The underlying Durable Object ID remains unchanged.
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
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
