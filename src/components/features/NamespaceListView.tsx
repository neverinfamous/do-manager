import { useState, useCallback } from 'react'
import { Box, Copy, Database, Download, Settings, Trash2, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { InstanceColorPicker } from './InstanceColorPicker'
import { exportApi } from '../../services/exportApi'
import type { Namespace, NamespaceColor, InstanceColor } from '../../types'

type SortField = 'name' | 'created_at' | 'instance_count'
type SortDirection = 'asc' | 'desc'

// Sort icon component - defined outside to avoid recreation during render
function SortIcon({
    field,
    sortField,
    sortDirection,
}: {
    field: SortField
    sortField: SortField
    sortDirection: SortDirection
}): React.JSX.Element | null {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
        <ChevronUp className="h-4 w-4 inline-block ml-1" />
    ) : (
        <ChevronDown className="h-4 w-4 inline-block ml-1" />
    )
}

// Sortable header component - defined outside to avoid recreation during render
function SortableHeader({
    field,
    sortField,
    sortDirection,
    onSort,
    children,
    className = '',
}: {
    field: SortField
    sortField: SortField
    sortDirection: SortDirection
    onSort: (field: SortField) => void
    children: React.ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <th
            scope="col"
            className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none ${className}`}
            onClick={() => onSort(field)}
            aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <span className="flex items-center">
                {children}
                <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
            </span>
        </th>
    )
}

interface NamespaceListViewProps {
    namespaces: Namespace[]
    selectedIds: Set<string>
    onToggleSelection: (namespace: Namespace) => void
    onSelectAll: () => void
    onClearSelection: () => void
    onSelect: (namespace: Namespace) => void
    onClone: (namespace: Namespace) => void
    onSettings: (namespace: Namespace) => void
    onDelete: (namespace: Namespace) => void
    onColorChange?: (namespaceId: string, color: NamespaceColor) => void
}

export function NamespaceListView({
    namespaces,
    selectedIds,
    onToggleSelection,
    onSelectAll,
    onClearSelection,
    onSelect,
    onClone,
    onSettings,
    onDelete,
    onColorChange,
}: NamespaceListViewProps): React.JSX.Element {
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [downloadingId, setDownloadingId] = useState<string | null>(null)

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const handleSort = useCallback(
        (field: SortField): void => {
            if (sortField === field) {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            } else {
                setSortField(field)
                setSortDirection('asc')
            }
        },
        [sortField]
    )

    const handleDownloadConfig = async (namespace: Namespace): Promise<void> => {
        try {
            setDownloadingId(namespace.id)
            await exportApi.downloadNamespace(namespace.id, namespace.name)
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to download namespace config:', err)
        } finally {
            setDownloadingId(null)
        }
    }

    const sortedNamespaces = [...namespaces].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
            case 'name':
                comparison = a.name.localeCompare(b.name)
                break
            case 'created_at':
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                break
            case 'instance_count':
                comparison = (a.instance_count ?? 0) - (b.instance_count ?? 0)
                break
        }
        return sortDirection === 'asc' ? comparison : -comparison
    })

    const allSelected = namespaces.length > 0 && selectedIds.size === namespaces.length

    return (
        <div className="overflow-visible border rounded-lg bg-card">
            <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                    <tr>
                        <th scope="col" className="px-3 py-3 w-10">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={(checked) => {
                                    if (checked === true) {
                                        onSelectAll()
                                    } else {
                                        onClearSelection()
                                    }
                                }}
                                aria-label={allSelected ? 'Deselect all namespaces' : 'Select all namespaces'}
                            />
                        </th>
                        <SortableHeader
                            field="name"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Name
                        </SortableHeader>
                        <th
                            scope="col"
                            className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-14"
                        >
                            Color
                        </th>
                        <th
                            scope="col"
                            className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                            Class
                        </th>
                        <th
                            scope="col"
                            className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                            Script
                        </th>
                        <th
                            scope="col"
                            className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                            Type
                        </th>
                        <SortableHeader
                            field="created_at"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Added
                        </SortableHeader>
                        <SortableHeader
                            field="instance_count"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        >
                            Instances
                        </SortableHeader>
                        <th
                            scope="col"
                            className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {sortedNamespaces.map((namespace) => {
                        const isSelected = selectedIds.has(namespace.id)

                        return (
                            <tr
                                key={namespace.id}
                                className={`hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                                {/* Checkbox */}
                                <td className="px-3 py-2">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelection(namespace)}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={`Select namespace ${namespace.name}`}
                                    />
                                </td>

                                {/* Name */}
                                <td className="px-3 py-2">
                                    <button
                                        onClick={() => onSelect(namespace)}
                                        className="font-medium text-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded flex items-center gap-2"
                                    >
                                        <Box className="h-4 w-4 text-primary flex-shrink-0" />
                                        {namespace.name}
                                    </button>
                                </td>

                                {/* Color */}
                                <td className="px-3 py-2">
                                    {onColorChange && (
                                        <InstanceColorPicker
                                            value={namespace.color as InstanceColor}
                                            onChange={(color) => onColorChange(namespace.id, color as NamespaceColor)}
                                        />
                                    )}
                                </td>

                                {/* Class */}
                                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                    {namespace.class_name}
                                </td>

                                {/* Script */}
                                <td className="px-3 py-2 text-muted-foreground">
                                    {namespace.script_name ?? '—'}
                                </td>

                                {/* Type badges */}
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                            className={`text-xs px-1.5 py-0.5 rounded-full ${namespace.storage_backend === 'sqlite'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                                }`}
                                        >
                                            {namespace.storage_backend.toUpperCase()}
                                        </span>
                                        {namespace.admin_hook_enabled === 1 && (
                                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                Admin Hook
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Added */}
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                    {formatDate(namespace.created_at)}
                                </td>

                                {/* Instances */}
                                <td className="px-3 py-2 text-center">
                                    <span aria-label={`${namespace.instance_count ?? 0} instance${namespace.instance_count === 1 ? '' : 's'}`}>
                                        {namespace.instance_count ?? 0}
                                    </span>
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onSelect(namespace)}
                                            title="Browse namespace"
                                            className="h-7 w-7 p-0"
                                        >
                                            <Database className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => void handleDownloadConfig(namespace)}
                                            disabled={downloadingId === namespace.id}
                                            title="Download namespace config"
                                            className="h-7 w-7 p-0"
                                        >
                                            {downloadingId === namespace.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Download className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onClone(namespace)}
                                            title="Clone namespace"
                                            className="h-7 w-7 p-0"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onSettings(namespace)}
                                            title="Namespace settings"
                                            className="h-7 w-7 p-0"
                                        >
                                            <Settings className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(namespace)}
                                            title="Delete namespace"
                                            className="h-7 w-7 p-0"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            {namespaces.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">No namespaces to display</div>
            )}
        </div>
    )
}
