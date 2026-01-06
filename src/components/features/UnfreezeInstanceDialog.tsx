/**
 * Unfreeze Instance Dialog
 * 
 * Simple dialog to check frozen status and unfreeze an instance.
 */

import { useState, useEffect } from 'react'
import { Loader2, Snowflake, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import { getFreezeStatus, unfreezeInstance } from '../../services/freezeApi'
import type { Instance } from '../../types'

interface UnfreezeInstanceDialogProps {
    instance: Instance | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUnfreezeComplete: () => void
}

export function UnfreezeInstanceDialog({
    instance,
    open,
    onOpenChange,
    onUnfreezeComplete,
}: UnfreezeInstanceDialogProps): React.ReactElement {
    const [loading, setLoading] = useState(true)
    const [frozen, setFrozen] = useState(false)
    const [frozenAt, setFrozenAt] = useState<string | null>(null)
    const [unfreezing, setUnfreezing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && instance) {
            void checkFreezeStatus()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, instance])

    const checkFreezeStatus = async (): Promise<void> => {
        if (!instance) return
        setLoading(true)
        setError(null)
        try {
            const status = await getFreezeStatus(instance.id)
            setFrozen(status.frozen)
            setFrozenAt(status.frozenAt ?? null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check freeze status')
        } finally {
            setLoading(false)
        }
    }

    const handleUnfreeze = async (): Promise<void> => {
        if (!instance) return
        setUnfreezing(true)
        setError(null)
        try {
            await unfreezeInstance(instance.id)
            setFrozen(false)
            setFrozenAt(null)
            onUnfreezeComplete()
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unfreeze instance')
        } finally {
            setUnfreezing(false)
        }
    }

    const formatDate = (dateString: string): string => {
        try {
            return new Date(dateString).toLocaleString()
        } catch {
            return dateString
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Snowflake className="h-5 w-5 text-cyan-500" />
                        Freeze Status
                    </DialogTitle>
                    <DialogDescription>
                        {instance?.name ?? instance?.object_id ?? 'Instance'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-muted-foreground">Checking status...</span>
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    ) : frozen ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                                <Snowflake className="h-5 w-5" />
                                <span className="font-medium">This instance is frozen</span>
                            </div>
                            {frozenAt && (
                                <p className="text-sm text-muted-foreground">
                                    Frozen at: {formatDate(frozenAt)}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Frozen instances are read-only. All write operations (put, delete, import)
                                will be blocked until the instance is unfrozen.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-muted-foreground">
                                This instance is not frozen. It can accept read and write operations.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {frozen && !loading && (
                        <Button
                            onClick={() => void handleUnfreeze()}
                            disabled={unfreezing}
                        >
                            {unfreezing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Unfreezing...
                                </>
                            ) : (
                                'Unfreeze Instance'
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
