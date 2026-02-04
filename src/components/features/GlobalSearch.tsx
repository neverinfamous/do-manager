import { useState, useEffect, useCallback, useMemo } from "react";
import { logger } from "../../lib/logger";
import {
  Search,
  Key,
  FileText,
  Tag,
  Loader2,
  AlertCircle,
  ChevronRight,
  X,
  Filter,
  CheckSquare,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { searchApi } from "../../services/searchApi";
import { namespaceApi } from "../../services/api";
import type { SearchResult, SearchSummary } from "../../types/search";
import type { Namespace } from "../../types";

interface GlobalSearchProps {
  onNavigateToInstance?: (
    namespaceId: string,
    instanceId: string,
    key: string,
  ) => void;
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedSearch})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function GlobalSearch({
  onNavigateToInstance,
}: GlobalSearchProps): React.ReactElement {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"keys" | "values" | "tags">(
    "keys",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [summary, setSummary] = useState<SearchSummary | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string>>(
    new Set(),
  );
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  // Load namespaces for filtering
  // For tag search, load ALL namespaces; for key/value search, only admin-hooked ones
  useEffect(() => {
    const loadNamespaces = async (): Promise<void> => {
      try {
        setLoadingNamespaces(true);
        const data = await namespaceApi.list();
        // For tags tab, show all namespaces; for keys/values, only admin-hooked
        if (activeTab === "tags") {
          setNamespaces(data);
        } else {
          setNamespaces(data.filter((ns) => ns.admin_hook_enabled === 1));
        }
      } catch (err) {
        logger.error("Failed to load namespaces", err);
      } finally {
        setLoadingNamespaces(false);
      }
    };
    void loadNamespaces();
  }, [activeTab]);

  // Perform search
  const performSearch = useCallback(
    async (query: string): Promise<void> => {
      if (!query.trim()) {
        setResults([]);
        setSummary(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const namespaceIds =
          selectedNamespaces.size > 0
            ? Array.from(selectedNamespaces)
            : undefined;

        const searchOptions = {
          ...(namespaceIds && { namespaceIds }),
          limit: 100,
        };

        let response;
        if (activeTab === "keys") {
          response = await searchApi.searchKeys(query, searchOptions);
        } else if (activeTab === "values") {
          response = await searchApi.searchValues(query, searchOptions);
        } else {
          response = await searchApi.searchTags(query, searchOptions);
        }

        setResults(response.results);
        setSummary(response.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, selectedNamespaces],
  );

  // Handle search submission
  const handleSearch = (): void => {
    void performSearch(searchQuery);
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  // Clear search
  const clearSearch = (): void => {
    setSearchQuery("");
    setResults([]);
    setSummary(null);
    setError("");
  };

  // Toggle namespace filter
  const toggleNamespace = (namespaceId: string): void => {
    setSelectedNamespaces((prev) => {
      const next = new Set(prev);
      if (next.has(namespaceId)) {
        next.delete(namespaceId);
      } else {
        next.add(namespaceId);
      }
      return next;
    });
  };

  // Select/deselect all namespaces
  const selectAllNamespaces = (): void => {
    setSelectedNamespaces(new Set(namespaces.map((ns) => ns.id)));
  };

  const clearNamespaceSelection = (): void => {
    setSelectedNamespaces(new Set());
  };

  // Handle result click - navigate to instance and open key edit dialog
  const handleResultClick = (result: SearchResult): void => {
    if (onNavigateToInstance) {
      onNavigateToInstance(result.namespaceId, result.instanceId, result.key);
    }
  };

  // Group results by namespace for better organization
  const groupedResults = useMemo(() => {
    const groups = new Map<
      string,
      { namespace: { id: string; name: string }; results: SearchResult[] }
    >();

    for (const result of results) {
      const key = result.namespaceId;
      if (!groups.has(key)) {
        groups.set(key, {
          namespace: { id: result.namespaceId, name: result.namespaceName },
          results: [],
        });
      }
      groups.get(key)?.results.push(result);
    }

    return Array.from(groups.values());
  }, [results]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Global Search</h2>
        <p className="text-muted-foreground">
          Search for keys and values across all Durable Object instances
        </p>
      </div>

      {/* Search Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "keys" | "values")}
      >
        <TabsList>
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Key Search
          </TabsTrigger>
          <TabsTrigger value="values" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Value Search
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tag Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Search for storage keys by name across all instances. Matches keys
            containing your search term.
          </p>
        </TabsContent>

        <TabsContent value="values" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Search within storage values. Finds keys where the JSON value
            contains your search term.
          </p>
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Search for instances by tag. Works for all namespaces (no admin
            hooks required).
          </p>
        </TabsContent>
      </Tabs>

      {/* Search Input */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="global-search-input" className="sr-only">
              Search {activeTab === "keys" ? "keys" : "values"}
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="global-search-input"
              placeholder={
                activeTab === "keys"
                  ? "Search for keys (e.g., user:, config)..."
                  : activeTab === "values"
                    ? "Search within values..."
                    : "Search for tags (e.g., production, team:backend)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-accent" : ""}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {selectedNamespaces.size > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs">
                {selectedNamespaces.size}
              </span>
            )}
          </Button>
        </div>

        {/* Namespace Filters */}
        {showFilters && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Filter by Namespace</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllNamespaces}
                    disabled={loadingNamespaces || namespaces.length === 0}
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearNamespaceSelection}
                    disabled={selectedNamespaces.size === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              {loadingNamespaces ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : namespaces.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No namespaces with admin hooks enabled found.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {namespaces.map((ns) => (
                    <label
                      key={ns.id}
                      htmlFor={`namespace-filter-${ns.id}`}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        id={`namespace-filter-${ns.id}`}
                        checked={selectedNamespaces.has(ns.id)}
                        onCheckedChange={() => toggleNamespace(ns.id)}
                      />
                      <span className="text-sm truncate">{ns.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedNamespaces.size === 0 && namespaces.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No filters selected - searching all namespaces with admin
                  hooks enabled
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Results Summary */}
      {summary && (
        <div className="bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              Found <strong>{summary.totalMatches}</strong> match
              {summary.totalMatches !== 1 ? "es" : ""} across{" "}
              <strong>{summary.instancesSearched}</strong> instance
              {summary.instancesSearched !== 1 ? "s" : ""} in{" "}
              <strong>{summary.namespacesSearched}</strong> namespace
              {summary.namespacesSearched !== 1 ? "s" : ""}
            </p>
            {summary.errors > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                {summary.errors} instance{summary.errors !== 1 ? "s" : ""} could
                not be searched
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && hasSearch && results.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No results found</h3>
            <p className="text-sm text-muted-foreground">
              No {activeTab === "keys" ? "keys" : "values"} match "{searchQuery}
              "
            </p>
          </CardContent>
        </Card>
      )}

      {!hasSearch && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Enter a search term</h3>
            <p className="text-sm text-muted-foreground">
              Search for {activeTab === "keys" ? "key names" : "values"} across
              all your Durable Object instances
            </p>
          </CardContent>
        </Card>
      )}

      {groupedResults.length > 0 && (
        <div className="space-y-6">
          {groupedResults.map(({ namespace, results: nsResults }) => (
            <div key={namespace.id}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {namespace.name}
                </span>
                <span>
                  ({nsResults.length} result{nsResults.length !== 1 ? "s" : ""})
                </span>
              </h3>
              <div className="space-y-2">
                {nsResults.map((result, idx) => (
                  <Card
                    key={`${result.instanceId}-${result.key}-${String(idx)}`}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleResultClick(result)}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-mono truncate">
                            {highlightMatch(result.key, searchQuery)}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            Instance:{" "}
                            <span className="font-medium">
                              {result.instanceName}
                            </span>
                          </CardDescription>
                          {result.matchType === "value" &&
                            result.valuePreview && (
                              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-hidden">
                                <span className="text-muted-foreground">
                                  Value:{" "}
                                </span>
                                {highlightMatch(
                                  result.valuePreview,
                                  searchQuery,
                                )}
                              </div>
                            )}
                          {result.matchType === "tag" &&
                            result.tags &&
                            result.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {result.tags.map((tag, tagIdx) => (
                                  <span
                                    key={`${tag}-${tagIdx}`}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                                  >
                                    {highlightMatch(tag, searchQuery)}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-3" />
            <h3 className="font-semibold mb-1">Searching...</h3>
            <p className="text-sm text-muted-foreground">
              Querying instances across{" "}
              {selectedNamespaces.size > 0 ? selectedNamespaces.size : "all"}{" "}
              namespace{selectedNamespaces.size !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
