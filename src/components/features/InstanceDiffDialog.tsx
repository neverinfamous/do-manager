import { useState, useEffect } from "react";
import {
  Loader2,
  ArrowLeftRight,
  Plus,
  Minus,
  Equal,
  AlertCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { diffApi, type DiffResult } from "../../services/diffApi";
import type { Instance } from "../../types";

interface InstanceDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceA: Instance | null;
  instanceB: Instance | null;
  namespaceName: string;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

/**
 * Truncate value for summary display
 */
function truncateValue(value: unknown, maxLength = 50): string {
  const str = formatValue(value);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

export function InstanceDiffDialog({
  open,
  onOpenChange,
  instanceA,
  instanceB,
  namespaceName,
}: InstanceDiffDialogProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  const canCompare = instanceA && instanceB && instanceA.id !== instanceB.id;

  const handleCompare = async (): Promise<void> => {
    if (!instanceA || !instanceB) return;

    try {
      setLoading(true);
      setError("");
      const result = await diffApi.compare(instanceA.id, instanceB.id);
      setDiff(result);
      setActiveTab("summary");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to compare instances",
      );
      setDiff(null);
    } finally {
      setLoading(false);
    }
  };

  // Reset when dialog opens with new instances
  useEffect(() => {
    if (open && canCompare) {
      setDiff(null);
      setError("");
    }
  }, [open, canCompare]);

  const instanceAName = instanceA?.name ?? instanceA?.object_id ?? "Instance A";
  const instanceBName = instanceB?.name ?? instanceB?.object_id ?? "Instance B";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Compare Instances
          </DialogTitle>
          <DialogDescription>
            Compare storage between two instances
          </DialogDescription>
        </DialogHeader>

        {!canCompare ? (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3" />
            <p>Select exactly 2 different instances to compare.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Instance Labels */}
            <div className="flex items-center justify-between gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {instanceAName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {namespaceName}
                </div>
              </div>
              <ArrowLeftRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <div className="text-sm font-medium truncate">
                  {instanceBName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {namespaceName}
                </div>
              </div>
            </div>

            {/* Compare Button */}
            {!diff && !loading && (
              <div className="text-center py-8">
                <Button onClick={() => void handleCompare()} disabled={loading}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Compare Storage
                </Button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Results */}
            {diff && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {diff.summary.onlyInACount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Only in A
                    </div>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {diff.summary.onlyInBCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Only in B
                    </div>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-yellow-500">
                      {diff.summary.differentCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Different
                    </div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {diff.summary.identicalCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Identical
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <TabsList>
                    <TabsTrigger
                      value="summary"
                      className="flex items-center gap-1.5"
                    >
                      Summary
                    </TabsTrigger>
                    <TabsTrigger
                      value="onlyA"
                      className="flex items-center gap-1.5"
                    >
                      <Minus className="h-3.5 w-3.5 text-red-500" />
                      Only in A ({diff.onlyInA.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="onlyB"
                      className="flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-500" />
                      Only in B ({diff.onlyInB.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="different"
                      className="flex items-center gap-1.5"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      Different ({diff.different.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="identical"
                      className="flex items-center gap-1.5"
                    >
                      <Equal className="h-3.5 w-3.5 text-green-500" />
                      Identical ({diff.identical.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="summary" className="mt-0">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Comparison Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Instance A keys:
                              </span>
                              <span className="ml-2 font-medium">
                                {diff.summary.totalA}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Instance B keys:
                              </span>
                              <span className="ml-2 font-medium">
                                {diff.summary.totalB}
                              </span>
                            </div>
                          </div>
                          {diff.summary.onlyInACount === 0 &&
                          diff.summary.onlyInBCount === 0 &&
                          diff.summary.differentCount === 0 ? (
                            <div className="text-center py-4 text-green-500">
                              <Equal className="h-8 w-8 mx-auto mb-2" />
                              <p className="font-medium">
                                Instances are identical!
                              </p>
                              <p className="text-sm text-muted-foreground">
                                All {diff.summary.identicalCount} keys match.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {diff.onlyInA.length > 0 && (
                                <p className="text-sm">
                                  <span className="text-red-500 font-medium">
                                    {diff.onlyInA.length} key(s)
                                  </span>{" "}
                                  only in {instanceAName}
                                </p>
                              )}
                              {diff.onlyInB.length > 0 && (
                                <p className="text-sm">
                                  <span className="text-blue-500 font-medium">
                                    {diff.onlyInB.length} key(s)
                                  </span>{" "}
                                  only in {instanceBName}
                                </p>
                              )}
                              {diff.different.length > 0 && (
                                <p className="text-sm">
                                  <span className="text-yellow-500 font-medium">
                                    {diff.different.length} key(s)
                                  </span>{" "}
                                  with different values
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="onlyA" className="mt-0 space-y-2">
                      {diff.onlyInA.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No keys unique to {instanceAName}
                        </p>
                      ) : (
                        diff.onlyInA.map((key) => (
                          <div
                            key={key}
                            className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
                          >
                            <div className="font-mono text-sm font-medium">
                              {key}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="onlyB" className="mt-0 space-y-2">
                      {diff.onlyInB.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No keys unique to {instanceBName}
                        </p>
                      ) : (
                        diff.onlyInB.map((key) => (
                          <div
                            key={key}
                            className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                          >
                            <div className="font-mono text-sm font-medium">
                              {key}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="different" className="mt-0 space-y-3">
                      {diff.different.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No keys with different values
                        </p>
                      ) : (
                        diff.different.map((item) => (
                          <div
                            key={item.key}
                            className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
                          >
                            <div className="font-mono text-sm font-medium mb-2">
                              {item.key}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-red-500 font-medium mb-1">
                                  Instance A
                                </div>
                                <pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
                                  {truncateValue(item.valueA, 200)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-blue-500 font-medium mb-1">
                                  Instance B
                                </div>
                                <pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
                                  {truncateValue(item.valueB, 200)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="identical" className="mt-0 space-y-2">
                      {diff.identical.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No identical keys
                        </p>
                      ) : (
                        diff.identical.map((key) => (
                          <div
                            key={key}
                            className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg"
                          >
                            <div className="font-mono text-sm font-medium">
                              {key}
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </div>
                </Tabs>

                {/* Compare Again Button */}
                <div className="flex justify-end mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => void handleCompare()}
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Compare Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
