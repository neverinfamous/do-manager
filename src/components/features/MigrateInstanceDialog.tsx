import { useState, useEffect, useCallback } from 'react'
import { Loader2, ArrowRightLeft, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { migrateApi, type CutoverMode, type MigrateInstanceResponse } from '../../services/migrateApi'
import { namespaceApi } from '../../services/api'
import type { Instance, Namespace } from '../../types'

interface MigrateInstanceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceInstance: Instance | null
    sourceNamespace: Namespace | null
    onComplete: (result: MigrateInstanceResponse) => void
}

export function MigrateInstanceDialog({
    open,
    onOpenChange,
    sourceInstance,
    sourceNamespace,
    onComplete,
}: MigrateInstanceDialogProps): React.ReactElement {
    const [targetNamespaceId, setTargetNamespaceId] = useState('')
    const [targetInstanceName, setTargetInstanceName] = useState('')
    const [cutoverMode, setCutoverMode] = useState<CutoverMode>('copy')
    const [migrateAlarms, setMigrateAlarms] = useState(false)
    const [runVerification, setRunVerification] = useState(true)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [namespaces, setNamespaces] = useState<Namespace[]>([])
    const [namespacesLoading, setNamespacesLoading] = useState(false)
    const [result, setResult] = useState<MigrateInstanceResponse | null>(null)

    const loadNamespaces = useCallback(async (): Promise<void> => {
        try {
            setNamespacesLoading(true)
            const allNamespaces = await namespaceApi.list()
            // Filter to only show namespaces with admin hooks enabled, excluding source
            const eligible = allNamespaces.filter(
                (ns) => ns.admin_hook_enabled === 1 && ns.id !== sourceNamespace?.id
            )
            setNamespaces(eligible)
        } catch {
            setError('Failed to load namespaces')
        } finally {
            setNamespacesLoading(false)
        }
    }, [sourceNamespace?.id])

    // Load namespaces when dialog opens
    useEffect(() => {
        if (open) {
            void loadNamespaces()
        }
    }, [open, loadNamespaces])

    // Reset target instance name when source changes
    useEffect(() => {
        if (sourceInstance) {
            setTargetInstanceName(sourceInstance.name ?? sourceInstance.object_id)
        }
    }, [sourceInstance])

    const resetForm = (): void => {
        setTargetNamespaceId('')
        setTargetInstanceName('')
        setCutoverMode('copy')
        setMigrateAlarms(false)
        setRunVerification(true)
        setConfirmDelete(false)
        setError('')
        setResult(null)
    }

    const handleSubmit = async (): Promise<void> => {
        if (!targetNamespaceId) {
            setError('Please select a target namespace')
            return
        }

        if (!targetInstanceName.trim()) {
            setError('Target instance name is required')
            return
        }

        if (!sourceInstance) {
            setError('No source instance selected')
            return
        }

        if (cutoverMode === 'copy_delete' && !confirmDelete) {
            setError('Please confirm that you want to delete the source instance')
            return
        }

        try {
            setLoading(true)
            setError('')

            const migrationResult = await migrateApi.migrateInstance(sourceInstance.id, {
                targetNamespaceId,
                targetInstanceName: targetInstanceName.trim(),
                cutoverMode,
                migrateAlarms,
                runVerification,
            })

            setResult(migrationResult)
            onComplete(migrationResult)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Migration failed')
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

    const handleClose = (): void => {
        resetForm()
        onOpenChange(false)
    }

    const sourceName = sourceInstance?.name ?? sourceInstance?.object_id ?? 'Unknown'
    const sourceHasAlarm = sourceInstance?.has_alarm === 1

    // If we have a result, show the result view
    if (result) {
        const targetNs = namespaces.find((ns) => ns.id === targetNamespaceId)
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {result.success ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            Migration {result.success ? 'Complete' : 'Failed'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">New Instance:</span>
                                <span className="font-medium">{result.newInstance.name ?? result.newInstance.object_id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Target Namespace:</span>
                                <span className="font-medium">{targetNs?.name ?? 'Unknown'}</span>
                            </div>
                            {result.sourceFrozen && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Source Status:</span>
                                    <span className="font-medium text-amber-500">Frozen (read-only)</span>
                                </div>
                            )}
                            {result.sourceDeleted && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Source Status:</span>
                                    <span className="font-medium text-destructive">Deleted</span>
                                </div>
                            )}
                        </div>

                        {result.verification && (
                            <div className="bg-muted rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    {result.verification.passed ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    )}
                                    <span className="font-medium text-sm">
                                        Verification {result.verification.passed ? 'Passed' : 'Warning'}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Source keys: {result.verification.sourceKeyCount} | Target keys: {result.verification.targetKeyCount}
                                </div>
                            </div>
                        )}

                        {result.warnings && result.warnings.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    <span className="font-medium text-sm text-amber-500">Warnings</span>
                                </div>
                                <ul className="text-xs text-muted-foreground list-disc list-inside">
                                    {result.warnings.map((warning, i) => (
                                        <li key={i}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleClose}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5" />
                        Migrate Instance
                    </DialogTitle>
                    <DialogDescription>
                        Copy this instance to another namespace. This creates a new instance with the same storage data.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {error && (
                        <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="migrate-source">Source Instance</Label>
                        <Input
                            id="migrate-source"
                            value={`${sourceName} (${sourceNamespace?.name ?? 'Unknown'})`}
                            disabled
                            className="bg-muted"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="migrate-target-ns">Target Namespace</Label>
                        <Select
                            value={targetNamespaceId}
                            onValueChange={setTargetNamespaceId}
                            disabled={namespacesLoading}
                        >
                            <SelectTrigger id="migrate-target-ns">
                                <SelectValue placeholder={namespacesLoading ? 'Loading...' : 'Select namespace'} />
                            </SelectTrigger>
                            <SelectContent>
                                {namespaces.map((ns) => (
                                    <SelectItem key={ns.id} value={ns.id}>
                                        {ns.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {namespaces.length === 0 && !namespacesLoading && (
                            <p className="text-xs text-muted-foreground">
                                No eligible namespaces found. Namespaces must have admin hooks enabled.
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="migrate-target-name">Target Instance Name</Label>
                        <Input
                            id="migrate-target-name"
                            placeholder="Enter instance name"
                            value={targetInstanceName}
                            onChange={(e) => setTargetInstanceName(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <span id="cutover-mode-label" className="text-sm font-medium leading-none">Cutover Mode</span>
                        <div className="space-y-2" role="radiogroup" aria-labelledby="cutover-mode-label">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="cutover"
                                    value="copy"
                                    checked={cutoverMode === 'copy'}
                                    onChange={() => setCutoverMode('copy')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-sm">Copy Only</div>
                                    <div className="text-xs text-muted-foreground">
                                        Keep both source and target instances (recommended)
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="cutover"
                                    value="copy_freeze"
                                    checked={cutoverMode === 'copy_freeze'}
                                    onChange={() => setCutoverMode('copy_freeze')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-sm">Copy + Freeze Source</div>
                                    <div className="text-xs text-muted-foreground">
                                        Source becomes read-only after migration
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="cutover"
                                    value="copy_delete"
                                    checked={cutoverMode === 'copy_delete'}
                                    onChange={() => setCutoverMode('copy_delete')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-sm text-destructive">Copy + Delete Source</div>
                                    <div className="text-xs text-muted-foreground">
                                        Source is removed after successful migration
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="migrate-verify"
                                checked={runVerification}
                                onCheckedChange={(checked) => setRunVerification(checked === true)}
                            />
                            <Label htmlFor="migrate-verify" className="text-sm font-normal cursor-pointer">
                                Run verification after migration
                            </Label>
                        </div>

                        {sourceHasAlarm && (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="migrate-alarms"
                                    checked={migrateAlarms}
                                    onCheckedChange={(checked) => setMigrateAlarms(checked === true)}
                                />
                                <Label htmlFor="migrate-alarms" className="text-sm font-normal cursor-pointer">
                                    Migrate scheduled alarm
                                </Label>
                            </div>
                        )}

                        {cutoverMode === 'copy_delete' && (
                            <div className="flex items-center gap-2 bg-destructive/10 p-2 rounded">
                                <Checkbox
                                    id="migrate-confirm-delete"
                                    checked={confirmDelete}
                                    onCheckedChange={(checked) => setConfirmDelete(checked === true)}
                                />
                                <Label htmlFor="migrate-confirm-delete" className="text-sm font-normal cursor-pointer text-destructive">
                                    I understand the source instance will be permanently deleted
                                </Label>
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
                    <Button onClick={() => void handleSubmit()} disabled={loading || namespaces.length === 0}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Migrate Instance
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
