import { useState, useEffect } from 'react'
import { Tag, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { TagEditor } from './TagEditor'
import { instanceApi } from '../../services/instanceApi'
import type { Instance } from '../../types'

interface EditTagsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    instance: Instance | null
    namespaceId?: string
    onComplete?: (updated: Instance) => void
}

/**
 * Dialog for editing instance tags
 */
export function EditTagsDialog({
    open,
    onOpenChange,
    instance,
    namespaceId,
    onComplete,
}: EditTagsDialogProps): React.ReactElement {
    const [tags, setTags] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Initialize tags from instance
    useEffect(() => {
        if (instance) {
            // Parse tags if they come as a string (from D1)
            let parsedTags: string[] = []
            if (typeof instance.tags === 'string') {
                try {
                    const parsed: unknown = JSON.parse(instance.tags)
                    parsedTags = Array.isArray(parsed) ? (parsed as string[]) : []
                } catch {
                    parsedTags = []
                }
            } else if (Array.isArray(instance.tags)) {
                parsedTags = instance.tags
            }
            setTags(parsedTags)
            setError('')
        }
    }, [instance])

    const handleSave = async (): Promise<void> => {
        if (!instance) return

        setLoading(true)
        setError('')

        try {
            const updated = await instanceApi.updateTags(instance.id, tags, namespaceId)
            onComplete?.(updated)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update tags')
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = (): void => {
        onOpenChange(false)
    }

    // Check if tags have changed
    const hasChanges = (): boolean => {
        if (!instance) return false
        let originalTags: string[] = []
        if (typeof instance.tags === 'string') {
            try {
                const parsed: unknown = JSON.parse(instance.tags)
                originalTags = Array.isArray(parsed) ? (parsed as string[]) : []
            } catch {
                originalTags = []
            }
        } else if (Array.isArray(instance.tags)) {
            originalTags = instance.tags
        }
        if (tags.length !== originalTags.length) return true
        return tags.some((tag, i) => tag !== originalTags[i])
    }

    if (!instance) return <></>

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" aria-hidden="true" />
                        Edit Tags
                    </DialogTitle>
                    <DialogDescription>
                        Add tags to <strong>{instance.name ?? instance.object_id}</strong> for organization and search.
                        Tags can be freeform text or <code>key:value</code> style.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <TagEditor
                        tags={tags}
                        onChange={setTags}
                        placeholder="Add a tag (e.g., production, team:backend)..."
                        disabled={loading}
                    />
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSave()} disabled={loading || !hasChanges()}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                        Save Tags
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
