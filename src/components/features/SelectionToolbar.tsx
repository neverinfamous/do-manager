import { CheckSquare, X } from "lucide-react";
import { Button } from "../ui/button";

interface SelectionToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Callback to select all items */
  onSelectAll: () => void;
  /** Callback to clear selection */
  onClear: () => void;
  /** Label for items (e.g., "instance", "namespace") */
  itemLabel: string;
  /** Action buttons to display */
  children?: React.ReactNode;
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onClear,
  itemLabel,
  children,
}: SelectionToolbarProps): React.ReactElement | null {
  if (selectedCount === 0) {
    return null;
  }

  const pluralLabel = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="sticky top-4 z-10 mb-4">
      <div className="bg-card border rounded-lg shadow-lg p-3 flex items-center justify-between gap-4">
        {/* Selection info */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center bg-primary text-primary-foreground text-sm font-medium rounded-full h-6 min-w-6 px-2">
            {selectedCount}
          </span>
          <span className="text-sm font-medium">{pluralLabel} selected</span>
        </div>

        {/* Selection actions */}
        <div className="flex items-center gap-2">
          {!isAllSelected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="text-xs"
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
              Select All ({totalCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>

          {/* Divider */}
          {children !== undefined && (
            <div className="h-6 w-px bg-border mx-1" />
          )}

          {/* Action buttons */}
          {children}
        </div>
      </div>
    </div>
  );
}
