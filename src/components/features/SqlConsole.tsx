import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "../../lib/logger";
import {
  Play,
  Loader2,
  Download,
  Trash2,
  Save,
  BookOpen,
  Edit,
  X,
  Copy,
  Check,
  AlignLeft,
  AlertTriangle,
  CheckCircle2,
  FileCode,
} from "lucide-react";
import { format } from "sql-formatter";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { storageApi, type SqlResponse } from "../../services/storageApi";
import { queriesApi } from "../../services/queriesApi";

import { validateSql } from "../../lib/sqlValidator";
import { handleSqlKeydown } from "../../lib/sqlAutocomplete";
import { parseContext, filterSuggestions } from "../../lib/sqlContextParser";
import { ALL_SQL_KEYWORDS } from "../../lib/sqlKeywords";
import { getCaretCoordinates } from "../../lib/caretPosition";
import { SqlEditor } from "../SqlEditor";
import { AutocompletePopup, type Suggestion } from "../AutocompletePopup";
import { sqlTemplateGroups, sqlTemplates } from "../../lib/sqlTemplates";
import type { SavedQuery } from "../../types";

interface SqlConsoleProps {
  instanceId: string;
  namespaceId: string;
}

export function SqlConsole({
  instanceId,
  namespaceId,
}: SqlConsoleProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);

  // Validation state
  const validation = validateSql(query);
  const hasValidationError = !validation.isValid && query.trim().length > 5;

  // Copied state for Copy button
  const [copied, setCopied] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  // User preference toggles (persisted to localStorage)
  const [enableSuggestions, setEnableSuggestions] = useState(() => {
    const stored = localStorage.getItem("do-manager-sql-suggestions");
    return stored !== "false";
  });
  const [allowDestructive, setAllowDestructive] = useState(() => {
    const stored = localStorage.getItem("do-manager-sql-destructive");
    return stored === "true";
  });

  // Saved queries state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");

  // Load saved queries
  const loadSavedQueries = useCallback(async (): Promise<void> => {
    try {
      setLoadingSaved(true);
      const queries = await queriesApi.list(namespaceId);
      setSavedQueries(queries);
    } catch (err) {
      logger.error("Failed to load saved queries", err);
    } finally {
      setLoadingSaved(false);
    }
  }, [namespaceId]);

  useEffect(() => {
    void loadSavedQueries();
  }, [loadSavedQueries]);

  const handleSavedQuerySelect = (queryId: string): void => {
    const saved = savedQueries.find((q) => q.id === queryId);
    if (saved) {
      setQuery(saved.query);
    }
  };

  const executeQuery = async (): Promise<void> => {
    if (!query.trim()) {
      setError("Query is required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await storageApi.sql(instanceId, query.trim());
      setResult(data);

      // Add to history
      setHistory((prev) => {
        const newHistory = [
          query.trim(),
          ...prev.filter((q) => q !== query.trim()),
        ];
        return newHistory.slice(0, 10); // Keep last 10 queries
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query execution failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Execute query with Ctrl+Enter
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void executeQuery();
      return;
    }

    // Autocomplete navigation
    if (showAutocomplete && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const selected = suggestions[selectedSuggestionIndex];
        if (selected) {
          acceptSuggestion(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    // Smart bracket pairing and indentation
    const target = e.target as HTMLTextAreaElement;
    const result = handleSqlKeydown(
      e.key,
      target.value,
      target.selectionStart,
      target.selectionEnd,
      e.shiftKey,
    );
    if (
      result.handled &&
      result.newValue !== undefined &&
      result.newCursorPos !== undefined
    ) {
      e.preventDefault();
      const newPos = result.newCursorPos;
      setQuery(result.newValue);
      // Set cursor position after state update
      setTimeout(() => {
        target.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  // Format SQL query
  const handleFormat = (): void => {
    if (!query.trim()) return;
    try {
      const formatted = format(query, {
        language: "sqlite",
        keywordCase: "upper",
        indentStyle: "standard",
      });
      setQuery(formatted);
    } catch {
      // If formatting fails, keep original
    }
  };

  // Copy query to clipboard
  const handleCopy = async (): Promise<void> => {
    if (!query.trim()) return;
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  // Update autocomplete suggestions
  const updateSuggestions = useCallback((): void => {
    if (!enableSuggestions || !textareaRef.current) {
      setShowAutocomplete(false);
      return;
    }

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;

    // Parse context to determine what to suggest
    const context = parseContext(query, cursorPos);

    let items: string[] = [];
    if (context.type === "keyword") {
      items = [...ALL_SQL_KEYWORDS];
    } else if (context.type === "table") {
      // Table suggestions from context (no external table list)
      items = context.tableNames;
    } else if (context.type === "column") {
      // Column suggestions from context
      items = context.tableNames;
    }

    // Filter by current word
    const filtered = filterSuggestions(items, context.currentWord);

    if (filtered.length === 0 || context.currentWord.length < 1) {
      setShowAutocomplete(false);
      return;
    }

    // Convert to Suggestion objects
    const suggestionItems: Suggestion[] = filtered.map((text) => ({
      text,
      type: context.type,
    }));

    setSuggestions(suggestionItems);
    setSelectedSuggestionIndex(0);

    // Calculate popup position
    try {
      const coords = getCaretCoordinates(textarea);
      const editorRect = editorContainerRef.current?.getBoundingClientRect();
      if (editorRect) {
        setPopupPosition({
          top: coords.top + coords.height + 4,
          left: coords.left,
        });
      }
    } catch {
      // Fallback position
    }

    setShowAutocomplete(true);
  }, [query, enableSuggestions]);

  // Accept a suggestion
  const acceptSuggestion = (suggestion: Suggestion): void => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const context = parseContext(query, cursorPos);

    // Replace the current word with the suggestion
    const before = query.slice(0, context.wordStart);
    const after = query.slice(cursorPos);
    const newQuery = before + suggestion.text + " " + after;

    setQuery(newQuery);
    setShowAutocomplete(false);

    // Set cursor after inserted text
    const newPos = context.wordStart + suggestion.text.length + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Update suggestions when query changes
  useEffect(() => {
    if (enableSuggestions) {
      const timer = setTimeout(updateSuggestions, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [query, enableSuggestions, updateSuggestions]);

  // Persist toggle preferences
  useEffect(() => {
    localStorage.setItem(
      "do-manager-sql-suggestions",
      String(enableSuggestions),
    );
  }, [enableSuggestions]);

  useEffect(() => {
    localStorage.setItem(
      "do-manager-sql-destructive",
      String(allowDestructive),
    );
  }, [allowDestructive]);

  const exportResults = (): void => {
    if (!result?.results.length) return;

    const csv = [
      Object.keys(result.results[0] as Record<string, unknown>).join(","),
      ...result.results.map((row) =>
        Object.values(row as Record<string, unknown>)
          .map((v) => JSON.stringify(v))
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveQuery = async (): Promise<void> => {
    if (!queryName.trim() || !query.trim()) return;

    try {
      setSavingQuery(true);
      const saved = await queriesApi.create(namespaceId, {
        name: queryName.trim(),
        ...(queryDescription.trim() && {
          description: queryDescription.trim(),
        }),
        query: query.trim(),
      });
      setSavedQueries((prev) => [...prev, saved]);
      setShowSaveDialog(false);
      setQueryName("");
      setQueryDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save query");
    } finally {
      setSavingQuery(false);
    }
  };

  const handleUpdateQuery = async (): Promise<void> => {
    if (!editingQuery || !queryName.trim()) return;

    try {
      setSavingQuery(true);
      const updated = await queriesApi.update(editingQuery.id, {
        name: queryName.trim(),
        ...(queryDescription.trim() && {
          description: queryDescription.trim(),
        }),
        query: query.trim(),
      });
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === updated.id ? updated : q)),
      );
      setShowEditDialog(false);
      setEditingQuery(null);
      setQueryName("");
      setQueryDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update query");
    } finally {
      setSavingQuery(false);
    }
  };

  const handleDeleteQuery = async (queryId: string): Promise<void> => {
    if (!confirm("Delete this saved query?")) return;

    try {
      await queriesApi.delete(queryId);
      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete query");
    }
  };

  const openEditDialog = (saved: SavedQuery): void => {
    setEditingQuery(saved);
    setQueryName(saved.name);
    setQueryDescription(saved.description ?? "");
    setQuery(saved.query);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Saved Queries */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Saved Queries
              </CardTitle>
              <CardDescription className="text-xs">
                Load or manage frequently used queries
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQueryName("");
                setQueryDescription("");
                setShowSaveDialog(true);
              }}
              disabled={!query.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Current
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSaved ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : savedQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved queries yet. Write a query and click "Save Current" to
              save it.
            </p>
          ) : (
            <div className="space-y-2">
              {savedQueries.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => handleSavedQuerySelect(saved.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium text-sm truncate">
                      {saved.name}
                    </div>
                    {saved.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {saved.description}
                      </div>
                    )}
                    <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                      {saved.query.substring(0, 60)}
                      {saved.query.length > 60 ? "..." : ""}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(saved)}
                      className="h-7 w-7 p-0"
                      title="Edit query"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteQuery(saved.id)}
                      className="h-7 w-7 p-0"
                      title="Delete query"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Query Editor */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm">SQL Query</CardTitle>
              {/* Quick Queries Dropdown */}
              <Label htmlFor="quick-queries-select" className="sr-only">
                Quick Queries
              </Label>
              <Select
                value=""
                onValueChange={(templateId) => {
                  const template = sqlTemplates.find(
                    (t) => t.id === templateId,
                  );
                  if (template) {
                    setQuery(template.query);
                    setShowAutocomplete(false);
                  }
                }}
              >
                <SelectTrigger
                  id="quick-queries-select"
                  className="w-[160px] h-8 text-xs"
                >
                  <FileCode className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Quick Queries" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {sqlTemplateGroups.map((group, groupIndex) => (
                    <SelectGroup
                      key={group.id}
                      className={groupIndex % 2 === 1 ? "bg-muted/50" : ""}
                    >
                      <SelectLabel className="text-xs font-semibold text-primary">
                        {group.label}
                      </SelectLabel>
                      {group.templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span className="text-sm">{template.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {/* Validation indicator */}
              {query.trim() &&
                (hasValidationError ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {validation.error}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valid SQL
                  </span>
                ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFormat}
                disabled={!query.trim()}
                title="Format SQL"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleCopy()}
                disabled={!query.trim()}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter to execute
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* SQL Editor with autocomplete */}
          <div ref={editorContainerRef} className="relative">
            <SqlEditor
              id="sql-query-input"
              name="query"
              value={query}
              onChange={setQuery}
              onKeyDown={handleKeyDown}
              onClick={() => setShowAutocomplete(false)}
              placeholder="SELECT * FROM users LIMIT 10"
              hasError={hasValidationError}
              errorPosition={validation.errorPosition}
              textareaRef={textareaRef}
              ariaLabel="SQL query input"
              ariaAutoComplete={enableSuggestions ? "list" : "none"}
              ariaControls={showAutocomplete ? "sql-suggestions" : undefined}
              ariaExpanded={showAutocomplete}
            />
            {/* Autocomplete popup */}
            <AutocompletePopup
              suggestions={suggestions}
              selectedIndex={selectedSuggestionIndex}
              position={popupPosition}
              visible={showAutocomplete}
              onSelect={acceptSuggestion}
              onSelectionChange={setSelectedSuggestionIndex}
            />
          </div>

          {/* Toggle options */}
          <div className="flex items-center gap-6 mt-3 mb-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-suggestions"
                checked={enableSuggestions}
                onCheckedChange={(checked) =>
                  setEnableSuggestions(checked === true)
                }
              />
              <Label
                htmlFor="enable-suggestions"
                className="text-xs cursor-pointer"
              >
                Enable SQL suggestions
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="allow-destructive"
                checked={allowDestructive}
                onCheckedChange={(checked) =>
                  setAllowDestructive(checked === true)
                }
              />
              <Label
                htmlFor="allow-destructive"
                className="text-xs cursor-pointer"
              >
                Allow destructive queries (DROP, DELETE, TRUNCATE)
              </Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={() => void executeQuery()} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Execute
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setError("");
                }}
                disabled={loading || !query}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
              {result && result.results.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
            {history.length > 0 && (
              <select
                id="sql-history-select"
                onChange={(e) => setQuery(e.target.value)}
                value=""
                className="text-xs px-2 py-1 border rounded bg-background"
                aria-label="Recent queries"
              >
                <option value="">Recent queries...</option>
                {history.map((q, i) => (
                  <option key={i} value={q}>
                    {q.substring(0, 50)}...
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">
              SQL Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive font-mono whitespace-pre-wrap">
              {error.includes("SQLITE_ERROR") || error.includes("syntax error")
                ? `Syntax Error: ${error
                    .replace(/^.*?:/, "")
                    .replace(/SQL execution failed:?\s*/i, "")
                    .trim()}`
                : error}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Check your SQL syntax and try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Results ({result.rowCount}{" "}
              {result.rowCount === 1 ? "row" : "rows"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No results returned
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(
                        result.results[0] as Record<string, unknown>,
                      ).map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row as Record<string, unknown>).map(
                          (val, j) => {
                            let displayValue: string;
                            if (val === null) {
                              displayValue = "";
                            } else if (typeof val === "object") {
                              displayValue = JSON.stringify(val);
                            } else if (typeof val === "string") {
                              displayValue = val;
                            } else if (
                              typeof val === "number" ||
                              typeof val === "boolean"
                            ) {
                              displayValue = String(val);
                            } else if (val === undefined) {
                              displayValue = "";
                            } else {
                              displayValue = "";
                            }

                            return (
                              <td
                                key={j}
                                className="px-3 py-2 font-mono text-xs"
                              >
                                {val === null ? (
                                  <span className="text-muted-foreground italic">
                                    null
                                  </span>
                                ) : (
                                  displayValue
                                )}
                              </td>
                            );
                          },
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Query Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query</DialogTitle>
            <DialogDescription>
              Save this query for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-query-name">Name</Label>
              <Input
                id="save-query-name"
                name="save-query-name"
                placeholder="e.g., All Active Users"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-query-description">
                Description (optional)
              </Label>
              <Input
                id="save-query-description"
                name="save-query-description"
                placeholder="e.g., Fetches all users with active status"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Query Preview</span>
              <pre className="p-2 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-32">
                {query}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveQuery()}
              disabled={savingQuery || !queryName.trim()}
            >
              {savingQuery ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Query Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Saved Query</DialogTitle>
            <DialogDescription>Update this saved query</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-query-name">Name</Label>
              <Input
                id="edit-query-name"
                name="edit-query-name"
                placeholder="e.g., All Active Users"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-query-description">
                Description (optional)
              </Label>
              <Input
                id="edit-query-description"
                name="edit-query-description"
                placeholder="e.g., Fetches all users with active status"
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-query-sql">Query</Label>
              <textarea
                id="edit-query-sql"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdateQuery()}
              disabled={savingQuery || !queryName.trim()}
            >
              {savingQuery ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
