import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Loader2,
  Box,
  Search,
  X,
  CheckSquare,
  Trash2,
  Download,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { NamespaceCard } from "./NamespaceCard";
import { NamespaceListView } from "./NamespaceListView";
import { AddNamespaceDialog } from "./AddNamespaceDialog";
import { CloneNamespaceDialog } from "./CloneNamespaceDialog";
import { NamespaceSettingsDialog } from "./NamespaceSettingsDialog";
import { SelectionToolbar } from "./SelectionToolbar";
import { BatchDeleteDialog } from "./BatchDeleteDialog";
import { namespaceApi } from "../../services/api";
import { useSelection } from "../../hooks/useSelection";
import { batchExportNamespaces } from "../../services/batchApi";
import type { Namespace, NamespaceColor } from "../../types";

type NamespaceViewMode = "grid" | "list";

// Helper to get view mode from localStorage
const getStoredViewMode = (): NamespaceViewMode => {
  try {
    const stored = localStorage.getItem("do-manager-namespace-view-mode");
    if (stored === "grid" || stored === "list") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "list"; // Default to list view
};

interface NamespaceListProps {
  onSelectNamespace: (namespace: Namespace) => void;
}

export function NamespaceList({
  onSelectNamespace,
}: NamespaceListProps): React.ReactElement {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [discovering, setDiscovering] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(
    null,
  );
  const [cloneNamespace, setCloneNamespace] = useState<Namespace | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [viewMode, setViewMode] =
    useState<NamespaceViewMode>(getStoredViewMode);

  // Toggle view mode with localStorage persistence
  const toggleViewMode = (): void => {
    setViewMode((prev) => {
      const newMode = prev === "grid" ? "list" : "grid";
      try {
        localStorage.setItem("do-manager-namespace-view-mode", newMode);
      } catch {
        // localStorage not available
      }
      return newMode;
    });
  };

  // Selection state
  const selection = useSelection<Namespace>();

  // Filter namespaces based on search
  const filteredNamespaces = useMemo(() => {
    if (!searchTerm.trim()) return namespaces;
    const searchLower = searchTerm.toLowerCase();
    return namespaces.filter(
      (ns) =>
        ns.name.toLowerCase().includes(searchLower) ||
        ns.class_name.toLowerCase().includes(searchLower) ||
        (ns.script_name?.toLowerCase().includes(searchLower) ?? false),
    );
  }, [namespaces, searchTerm]);

  const loadNamespaces = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      const data = await namespaceApi.list();
      setNamespaces(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load namespaces",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async (): Promise<void> => {
    try {
      setDiscovering(true);
      setError("");
      const discovered = await namespaceApi.discover();
      // Merge discovered with existing (avoiding duplicates by class_name)
      const existingClasses = new Set(namespaces.map((n) => n.class_name));
      const newNamespaces = discovered.filter(
        (n) => !existingClasses.has(n.class_name),
      );
      if (newNamespaces.length > 0) {
        // Add new namespaces
        for (const ns of newNamespaces) {
          await namespaceApi.add({
            name: ns.name,
            class_name: ns.class_name,
            ...(ns.script_name && { script_name: ns.script_name }),
            storage_backend: ns.storage_backend,
          });
        }
        await loadNamespaces();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discover namespaces",
      );
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = async (namespace: Namespace): Promise<void> => {
    if (!confirm(`Delete namespace "${namespace.name}"?`)) {
      return;
    }
    try {
      await namespaceApi.delete(namespace.id);
      setNamespaces((prev) => prev.filter((n) => n.id !== namespace.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete namespace",
      );
    }
  };

  const handleAddComplete = (namespace: Namespace): void => {
    setNamespaces((prev) => [namespace, ...prev]);
    setShowAddDialog(false);
  };

  const handleSettings = (namespace: Namespace): void => {
    setSelectedNamespace(namespace);
    setShowSettingsDialog(true);
  };

  const handleSettingsUpdate = (updatedNamespace: Namespace): void => {
    setNamespaces((prev) =>
      prev.map((n) => (n.id === updatedNamespace.id ? updatedNamespace : n)),
    );
  };

  const handleCloneComplete = (namespace: Namespace): void => {
    setNamespaces((prev) => [namespace, ...prev]);
    setCloneNamespace(null);
  };

  const handleColorChange = async (
    namespaceId: string,
    color: NamespaceColor,
  ): Promise<void> => {
    try {
      const updated = await namespaceApi.updateColor(namespaceId, color);
      setNamespaces((prev) =>
        prev.map((n) => (n.id === namespaceId ? updated : n)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update color");
    }
  };

  const handleSelectionChange = (namespace: Namespace): void => {
    selection.toggle(namespace.id);
  };

  const handleSelectAll = (): void => {
    selection.selectAll(filteredNamespaces);
  };

  const handleBatchDeleteComplete = (): void => {
    // Remove deleted namespaces from state
    const deletedIds = selection.selectedIds;
    setNamespaces((prev) => prev.filter((n) => !deletedIds.has(n.id)));
    selection.clear();
    setShowBatchDeleteDialog(false);
  };

  const handleBatchDownload = async (): Promise<void> => {
    const selectedItems = selection.getSelectedItems(filteredNamespaces);
    if (selectedItems.length === 0) return;

    try {
      await batchExportNamespaces(selectedItems);
      selection.clear();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download namespaces",
      );
    }
  };

  useEffect(() => {
    void loadNamespaces();
  }, []);

  const selectedNamespaces = selection.getSelectedItems(filteredNamespaces);

  return (
    <div>
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Namespaces</h2>
          <p className="text-muted-foreground mt-1">
            {namespaces.length}{" "}
            {namespaces.length === 1 ? "namespace" : "namespaces"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={filteredNamespaces.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Select All
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleDiscover()}
            disabled={discovering}
          >
            {discovering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Discover
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadNamespaces()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Namespace
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && namespaces.length === 0 && (
        <div className="text-center py-12">
          <Box className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No namespaces yet</h3>
          <p className="text-muted-foreground mb-4">
            Add a Durable Object namespace to get started
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => void handleDiscover()}>
              <Search className="h-4 w-4 mr-2" />
              Auto-Discover
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
          </div>
        </div>
      )}

      {/* Namespace Grid */}
      {!loading && namespaces.length > 0 && (
        <>
          {/* Search and View Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <label htmlFor="namespace-filter" className="sr-only">
                Filter namespaces
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="namespace-filter"
                placeholder="Filter namespaces by name, class, or script..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleViewMode}
              aria-label={
                viewMode === "grid"
                  ? "Switch to list view"
                  : "Switch to grid view"
              }
              title={
                viewMode === "grid"
                  ? "Switch to list view"
                  : "Switch to grid view"
              }
              className="flex items-center gap-2"
            >
              {viewMode === "grid" ? (
                <>
                  <LayoutList className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid</span>
                </>
              )}
            </Button>
          </div>

          {/* Selection toolbar */}
          {selection.count > 0 && (
            <SelectionToolbar
              selectedCount={selection.count}
              totalCount={filteredNamespaces.length}
              isAllSelected={selection.isAllSelected(filteredNamespaces)}
              onSelectAll={() => selection.selectAll(filteredNamespaces)}
              onClear={selection.clear}
              itemLabel="namespace"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleBatchDownload()}
                disabled={selection.count === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download ({selection.count})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBatchDeleteDialog(true)}
                disabled={selection.count === 0}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete ({selection.count})
              </Button>
            </SelectionToolbar>
          )}

          {/* Select all checkbox */}
          {filteredNamespaces.length > 0 && (
            <div className="flex items-center gap-2 mb-4 px-1">
              <Checkbox
                id="select-all-namespaces"
                checked={selection.isAllSelected(filteredNamespaces)}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    selection.selectAll(filteredNamespaces);
                  } else {
                    selection.deselectAll();
                  }
                }}
                aria-label="Select all namespaces"
              />
              <label
                htmlFor="select-all-namespaces"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Select all {filteredNamespaces.length} namespaces
              </label>
            </div>
          )}

          {/* Search info */}
          {searchTerm && (
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredNamespaces.length} of {namespaces.length}{" "}
              namespaces
              {filteredNamespaces.length === 0 && (
                <span className="ml-1">— no matches for "{searchTerm}"</span>
              )}
            </p>
          )}

          {/* No results */}
          {filteredNamespaces.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No matches</h3>
              <p className="text-muted-foreground mb-4">
                No namespaces match "{searchTerm}"
              </p>
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear filter
              </Button>
            </div>
          )}

          {/* Namespace List or Grid */}
          {filteredNamespaces.length > 0 && (
            <>
              {viewMode === "list" ? (
                <NamespaceListView
                  namespaces={filteredNamespaces}
                  selectedIds={selection.selectedIds}
                  onToggleSelection={handleSelectionChange}
                  onSelectAll={() => selection.selectAll(filteredNamespaces)}
                  onClearSelection={selection.clear}
                  onSelect={onSelectNamespace}
                  onClone={setCloneNamespace}
                  onSettings={handleSettings}
                  onDelete={(ns) => void handleDelete(ns)}
                  onColorChange={handleColorChange}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNamespaces.map((namespace) => (
                    <NamespaceCard
                      key={namespace.id}
                      namespace={namespace}
                      onSelect={onSelectNamespace}
                      onClone={setCloneNamespace}
                      onSettings={handleSettings}
                      onDelete={() => void handleDelete(namespace)}
                      isSelected={selection.isSelected(namespace.id)}
                      onSelectionChange={handleSelectionChange}
                      onColorChange={handleColorChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Add Namespace Dialog */}
      <AddNamespaceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onComplete={handleAddComplete}
      />

      {/* Settings Dialog */}
      <NamespaceSettingsDialog
        namespace={selectedNamespace}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onUpdate={handleSettingsUpdate}
      />

      {/* Clone Namespace Dialog */}
      <CloneNamespaceDialog
        open={cloneNamespace !== null}
        onOpenChange={(open) => !open && setCloneNamespace(null)}
        sourceNamespace={cloneNamespace}
        onComplete={handleCloneComplete}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={showBatchDeleteDialog}
        onOpenChange={setShowBatchDeleteDialog}
        items={selectedNamespaces}
        itemType="namespace"
        onComplete={handleBatchDeleteComplete}
      />
    </div>
  );
}
