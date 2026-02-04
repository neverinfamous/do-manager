import { useState, useCallback } from "react";
import { logger } from "../../lib/logger";
import {
  Box,
  Database,
  Bell,
  Download,
  Copy,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
  Clock,
  AlertTriangle,
  HardDrive,
  Pencil,
  Tag,
  ArrowRightLeft,
  Snowflake,
} from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { exportApi } from "../../services/exportApi";
import { getStorageQuotaStatus } from "../../lib/storageUtils";
import { InstanceColorPicker } from "./InstanceColorPicker";
import type { Instance, InstanceColor } from "../../types";

type SortField = "name" | "last_accessed" | "storage_size_bytes";
type SortDirection = "asc" | "desc";

// Sort icon component - defined outside to avoid recreation during render
function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}): React.JSX.Element | null {
  if (sortField !== field) return null;
  return sortDirection === "asc" ? (
    <ChevronUp className="h-4 w-4 inline-block ml-1" />
  ) : (
    <ChevronDown className="h-4 w-4 inline-block ml-1" />
  );
}

// Sortable header component - defined outside to avoid recreation during render
function SortableHeader({
  field,
  sortField,
  sortDirection,
  onSort,
  children,
  className = "",
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <th
      scope="col"
      className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => onSort(field)}
      aria-sort={
        sortField === field
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span className="flex items-center">
        {children}
        <SortIcon
          field={field}
          sortField={sortField}
          sortDirection={sortDirection}
        />
      </span>
    </th>
  );
}

interface InstanceListViewProps {
  instances: Instance[];
  selectedIds: Set<string>;
  onToggleSelection: (instance: Instance) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelect: (instance: Instance) => void;
  onClone: (instance: Instance) => void;
  onRename: (instance: Instance) => void;
  onEditTags: (instance: Instance) => void;
  onMigrate: (instance: Instance) => void;
  onUnfreeze: (instance: Instance) => void;
  onDelete: (instance: Instance) => void;
  onColorChange: (instanceId: string, color: InstanceColor) => void;
}

export function InstanceListView({
  instances,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onSelect,
  onClone,
  onRename,
  onEditTags,
  onMigrate,
  onUnfreeze,
  onDelete,
  onColorChange,
}: InstanceListViewProps): React.JSX.Element {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number | null): string => {
    if (bytes === null) return "—";
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSort = useCallback(
    (field: SortField): void => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const handleExport = async (instance: Instance): Promise<void> => {
    try {
      setExportingId(instance.id);
      await exportApi.downloadInstance(
        instance.id,
        instance.name ?? instance.object_id,
      );
    } catch (err) {
      logger.error("Failed to export instance", err);
    } finally {
      setExportingId(null);
    }
  };

  const sortedInstances = [...instances].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "name":
        comparison = (a.name ?? a.object_id).localeCompare(
          b.name ?? b.object_id,
        );
        break;
      case "last_accessed":
        {
          const aTime = a.last_accessed
            ? new Date(a.last_accessed).getTime()
            : 0;
          const bTime = b.last_accessed
            ? new Date(b.last_accessed).getTime()
            : 0;
          comparison = aTime - bTime;
        }
        break;
      case "storage_size_bytes":
        comparison = (a.storage_size_bytes ?? 0) - (b.storage_size_bytes ?? 0);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const allSelected =
    instances.length > 0 && selectedIds.size === instances.length;

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
                    onSelectAll();
                  } else {
                    onClearSelection();
                  }
                }}
                aria-label={
                  allSelected
                    ? "Deselect all instances"
                    : "Select all instances"
                }
              />
            </th>
            <th scope="col" className="px-3 py-3 w-3">
              {/* Color indicator column */}
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
              className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Object ID
            </th>
            <th
              scope="col"
              className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Status
            </th>
            <SortableHeader
              field="storage_size_bytes"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Size
            </SortableHeader>
            <SortableHeader
              field="last_accessed"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Last Accessed
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
          {sortedInstances.map((instance) => {
            const isSelected = selectedIds.has(instance.id);
            const storageStatus =
              instance.storage_size_bytes !== null
                ? getStorageQuotaStatus(instance.storage_size_bytes)
                : null;
            const isHighStorage =
              storageStatus?.level !== "normal" &&
              storageStatus?.level !== undefined;
            const isCritical = storageStatus?.level === "critical";

            return (
              <tr
                key={instance.id}
                className={`hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
              >
                {/* Checkbox */}
                <td className="px-3 py-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(instance)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select instance ${instance.name ?? instance.object_id}`}
                  />
                </td>

                {/* Color indicator */}
                <td className="px-1 py-2">
                  <InstanceColorPicker
                    value={instance.color}
                    onChange={(color) => onColorChange(instance.id, color)}
                  />
                </td>

                {/* Name */}
                <td className="px-3 py-2">
                  <button
                    onClick={() => onSelect(instance)}
                    className="font-medium text-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded flex items-center gap-2"
                  >
                    <Box className="h-4 w-4 text-primary flex-shrink-0" />
                    {instance.name ?? "Unnamed Instance"}
                  </button>
                </td>

                {/* Object ID */}
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[150px] truncate">
                  {instance.object_id}
                </td>

                {/* Status badges */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {instance.has_alarm === 1 && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-0.5"
                        title="Has alarm"
                      >
                        <Bell className="h-2.5 w-2.5" />
                        Alarm
                      </span>
                    )}
                  </div>
                </td>

                {/* Size with quota indicator */}
                <td className="px-3 py-2">
                  <div
                    className={`flex items-center gap-1 ${
                      isCritical
                        ? "text-red-500"
                        : isHighStorage
                          ? "text-yellow-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {isCritical ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : isHighStorage ? (
                      <HardDrive className="h-3.5 w-3.5" />
                    ) : null}
                    <span>{formatSize(instance.storage_size_bytes)}</span>
                    {isHighStorage && storageStatus !== null && (
                      <span
                        className="text-xs font-medium"
                        title={`${storageStatus.percentUsed.toFixed(1)}% of 10GB DO limit`}
                      >
                        ({storageStatus.percentUsed.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </td>

                {/* Last Accessed */}
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(instance.last_accessed)}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelect(instance)}
                      title="View Storage"
                      className="h-7 w-7 p-0"
                    >
                      <Database className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleExport(instance)}
                      disabled={exportingId === instance.id}
                      title="Download instance data"
                      className="h-7 w-7 p-0"
                    >
                      {exportingId === instance.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onClone(instance)}
                      title="Clone instance"
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRename(instance)}
                      title="Rename instance"
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMigrate(instance)}
                      title="Migrate to namespace"
                      className="h-7 w-7 p-0"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnfreeze(instance)}
                      title="Check freeze status"
                      className="h-7 w-7 p-0"
                    >
                      <Snowflake className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditTags(instance)}
                      title="Edit tags"
                      className="h-7 w-7 p-0"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(instance)}
                      title="Delete instance"
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {instances.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No instances to display
        </div>
      )}
    </div>
  );
}
