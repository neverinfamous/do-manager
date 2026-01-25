import { useState } from "react";
import {
  Archive,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
  batchBackupInstances,
  type BatchProgress,
  type BatchBackupResult,
} from "../../services/batchApi";
import type { Instance, Namespace } from "../../types";

interface BatchBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: Instance[];
  namespace: Namespace;
  onComplete: () => void;
}

export function BatchBackupDialog({
  open,
  onOpenChange,
  instances,
  namespace,
  onComplete,
}: BatchBackupDialogProps): React.ReactElement {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchBackupResult[] | null>(null);

  const handleBackup = async (): Promise<void> => {
    setIsBackingUp(true);
    setProgress(null);
    setResults(null);

    try {
      const backupResults = await batchBackupInstances(instances, setProgress);
      setResults(backupResults);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Batch backup error:", err);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleClose = (): void => {
    if (isBackingUp) return;
    if (results) {
      onComplete();
    }
    setProgress(null);
    setResults(null);
    onOpenChange(false);
  };

  const pluralLabel = instances.length === 1 ? "instance" : "instances";
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failureCount = results?.filter((r) => !r.success).length ?? 0;

  const formatSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined) return "Unknown";
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!results ? (
              <>
                <Archive className="h-5 w-5 text-primary" />
                Backup {instances.length} {pluralLabel}
              </>
            ) : (
              <>
                {failureCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Backup Complete
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!results ? (
              <>
                Create R2 backups for {instances.length} {pluralLabel} in{" "}
                <span className="font-medium">{namespace.name}</span>.
              </>
            ) : (
              <>
                {successCount} of {instances.length} {pluralLabel} backed up
                successfully.
                {failureCount > 0 && ` ${String(failureCount)} failed.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {isBackingUp && progress && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Backing up {progress.currentItemName}...
              </span>
              <span className="font-medium">
                {progress.current + 1} / {progress.total}
              </span>
            </div>
            <Progress value={progress.percentage} />
          </div>
        )}

        {/* Instance list (before backup) */}
        {!isBackingUp && !results && (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="px-3 py-2 text-sm flex items-center gap-2"
              >
                <Archive className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  {instance.name ?? instance.object_id}
                </span>
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
                {result.success && result.backup && (
                  <span className="text-xs text-muted-foreground">
                    {formatSize(result.backup.size_bytes)}
                  </span>
                )}
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
                disabled={isBackingUp}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleBackup()}
                disabled={isBackingUp}
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Backing up...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Backup {instances.length} {pluralLabel}
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
