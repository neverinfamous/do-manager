import { useState } from "react";
import { logger } from "../../lib/logger";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileArchive,
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
  batchExportInstances,
  type BatchProgress,
  type BatchItemResult,
} from "../../services/batchApi";
import type { Instance, Namespace } from "../../types";

interface BatchDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: Instance[];
  namespace: Namespace;
  onComplete: () => void;
}

export function BatchDownloadDialog({
  open,
  onOpenChange,
  instances,
  namespace,
  onComplete,
}: BatchDownloadDialogProps): React.ReactElement {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchItemResult[] | null>(null);

  const handleDownload = async (): Promise<void> => {
    setIsDownloading(true);
    setProgress(null);
    setResults(null);

    try {
      await batchExportInstances(instances, namespace, setProgress);
      // Get results from final progress update
      setResults(progress?.results ?? []);
    } catch (err) {
      logger.error("Batch download error", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = (): void => {
    if (isDownloading) return;
    if (results || progress?.status === "completed") {
      onComplete();
    }
    setProgress(null);
    setResults(null);
    onOpenChange(false);
  };

  const pluralLabel = instances.length === 1 ? "instance" : "instances";
  const currentResults = results ?? progress?.results ?? [];
  const successCount = currentResults.filter((r) => r.success).length;
  const failureCount = currentResults.filter((r) => !r.success).length;
  const isComplete = progress?.status === "completed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!isComplete ? (
              <>
                <FileArchive className="h-5 w-5 text-primary" />
                Download {instances.length} {pluralLabel}
              </>
            ) : (
              <>
                {failureCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Download Complete
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!isComplete ? (
              <>
                Export {instances.length} {pluralLabel} from{" "}
                <span className="font-medium">{namespace.name}</span> as a ZIP
                file.
              </>
            ) : (
              <>
                {successCount} of {instances.length} {pluralLabel} exported
                successfully.
                {failureCount > 0 && ` ${String(failureCount)} failed.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {isDownloading && progress && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Exporting {progress.currentItemName}...
              </span>
              <span className="font-medium">
                {progress.current + 1} / {progress.total}
              </span>
            </div>
            <Progress value={progress.percentage} />
          </div>
        )}

        {/* Instance list (before download) */}
        {!isDownloading && !isComplete && (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="px-3 py-2 text-sm flex items-center gap-2"
              >
                <Download className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  {instance.name ?? instance.object_id}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Results list */}
        {isComplete && currentResults.length > 0 && (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
            {currentResults.map((result) => (
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

        {/* ZIP info */}
        {isComplete && failureCount === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <FileArchive className="h-4 w-4" />
            <span>ZIP file downloaded with manifest.json</span>
          </div>
        )}

        <DialogFooter>
          {!isComplete ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isDownloading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleDownload()}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download ZIP
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
