import { useState } from "react";
import { logger } from "../../lib/logger";
import {
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Progress } from "../ui/progress";
import {
  batchDeleteInstances,
  batchDeleteNamespaces,
  type BatchProgress,
  type BatchItemResult,
} from "../../services/batchApi";
import type { Instance, Namespace } from "../../types";

type DeleteItem = Instance | Namespace;

interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DeleteItem[];
  itemType: "instance" | "namespace";
  onComplete: () => void;
}

function isInstance(item: DeleteItem): item is Instance {
  return "object_id" in item;
}

function getItemName(item: DeleteItem): string {
  if (isInstance(item)) {
    return item.name ?? item.object_id;
  }
  return item.name;
}

export function BatchDeleteDialog({
  open,
  onOpenChange,
  items,
  itemType,
  onComplete,
}: BatchDeleteDialogProps): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchItemResult[] | null>(null);

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setProgress(null);
    setResults(null);

    try {
      let deleteResults: BatchItemResult[];

      if (itemType === "instance") {
        deleteResults = await batchDeleteInstances(
          items as Instance[],
          setProgress,
        );
      } else {
        deleteResults = await batchDeleteNamespaces(
          items as Namespace[],
          setProgress,
        );
      }

      setResults(deleteResults);
    } catch (err) {
      logger.error("Batch delete error", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = (): void => {
    if (isDeleting) return;
    if (results) {
      onComplete();
    }
    setProgress(null);
    setResults(null);
    onOpenChange(false);
  };

  const pluralItemType = items.length === 1 ? itemType : `${itemType}s`;
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failureCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!results ? (
              <>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete {items.length} {pluralItemType}
              </>
            ) : (
              <>
                {failureCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Delete Complete
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!results ? (
              <>
                Are you sure you want to delete{" "}
                {items.length === 1 ? "this" : "these"} {pluralItemType}? This
                action cannot be undone.
              </>
            ) : (
              <>
                {successCount} of {items.length} {pluralItemType} deleted
                successfully.
                {failureCount > 0 && ` ${String(failureCount)} failed.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {isDeleting && progress && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.currentItemName}
              </span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} />
          </div>
        )}

        {/* Loading state without progress details */}
        {isDeleting && !progress && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Item list (before deletion) */}
        {!isDeleting && !results && (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 text-sm flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4 text-destructive shrink-0" />
                <span className="truncate">{getItemName(item)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Results list */}
        {results && (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
            {results.map((result) => (
              <div
                key={result.id}
                className="px-3 py-2 text-sm flex items-center gap-2"
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span className="truncate flex-1">{result.name}</span>
                {result.error && (
                  <span
                    className="text-xs text-destructive truncate max-w-[150px]"
                    title={result.error}
                  >
                    {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {!results ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {items.length} {pluralItemType}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
