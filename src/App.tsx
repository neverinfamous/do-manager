import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { logger } from "./lib/logger";
import {
  Box,
  History,
  BarChart3,
  Search,
  Activity,
  Bell,
  Loader2,
  ArrowUpCircle,
  Check,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Header } from "./components/layout/Header";
import { NamespaceList } from "./components/features/NamespaceList";
import { NamespaceView } from "./components/features/NamespaceView";
import { StorageViewer } from "./components/features/StorageViewer";
import { namespaceApi } from "./services/api";
import { instanceApi } from "./services/instanceApi";
import { migrationApi } from "./services/migrationApi";
import type { Namespace, Instance, MigrationStatus } from "./types";

// Lazy-loaded tab components for better code splitting
const MetricsDashboard = lazy(() =>
  import("./components/features/MetricsDashboard").then((m) => ({
    default: m.MetricsDashboard,
  })),
);
const JobHistory = lazy(() =>
  import("./components/features/JobHistory").then((m) => ({
    default: m.JobHistory,
  })),
);
const GlobalSearch = lazy(() =>
  import("./components/features/GlobalSearch").then((m) => ({
    default: m.GlobalSearch,
  })),
);
const HealthDashboard = lazy(() =>
  import("./components/features/HealthDashboard").then((m) => ({
    default: m.HealthDashboard,
  })),
);
const WebhookManager = lazy(() =>
  import("./components/features/WebhookManager").then((m) => ({
    default: m.WebhookManager,
  })),
);

// Loading fallback for lazy-loaded components
const LazyLoadingFallback = (): React.ReactElement => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

type View =
  | { type: "list" }
  | { type: "namespace"; namespace: Namespace }
  | {
      type: "instance";
      namespace: Namespace;
      instance: Instance;
      initialEditKey?: string;
    };

export default function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>({ type: "list" });
  const [activeTab, setActiveTab] = useState("namespaces");
  // Counter to force InstanceList refresh when navigating back from StorageViewer
  const [instanceRefreshKey, setInstanceRefreshKey] = useState(0);

  // Migration state for upgrade banner
  const [migrationStatus, setMigrationStatus] =
    useState<MigrationStatus | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  // Check migration status on mount
  useEffect(() => {
    void checkMigrationStatus();
  }, []);

  // Check migration status
  const checkMigrationStatus = async (): Promise<void> => {
    try {
      const status = await migrationApi.getStatus();
      setMigrationStatus(status);
      setMigrationError(null);
    } catch {
      // Silently handle migration check failures - don't block the app
    }
  };

  // Apply pending migrations
  const handleApplyMigrations = async (): Promise<void> => {
    if (!migrationStatus) return;

    setMigrationLoading(true);
    setMigrationError(null);
    setMigrationSuccess(false);

    try {
      // Check if this is a legacy installation that needs marking
      if (
        migrationStatus.legacy?.isLegacy &&
        migrationStatus.legacy.suggestedVersion > 0
      ) {
        // Mark existing migrations as applied first
        await migrationApi.markLegacy(migrationStatus.legacy.suggestedVersion);
      }

      // Apply any pending migrations
      const result = await migrationApi.apply();

      if (result.success) {
        setMigrationSuccess(true);
        // Refresh migration status
        await checkMigrationStatus();
        // Auto-hide success message after 5 seconds
        setTimeout(() => setMigrationSuccess(false), 5000);
      } else {
        setMigrationError(result.errors.join(", "));
      }
    } catch (err) {
      setMigrationError(
        err instanceof Error ? err.message : "Failed to apply migrations",
      );
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleSelectNamespace = (namespace: Namespace): void => {
    setCurrentView({ type: "namespace", namespace });
  };

  const handleSelectInstance = (instance: Instance): void => {
    if (currentView.type === "namespace") {
      setCurrentView({
        type: "instance",
        namespace: currentView.namespace,
        instance,
      });
    }
  };

  const handleBackToList = (): void => {
    setCurrentView({ type: "list" });
  };

  const handleBackToNamespace = (): void => {
    if (currentView.type === "instance") {
      setCurrentView({ type: "namespace", namespace: currentView.namespace });
      // Increment key to force InstanceList to remount and fetch fresh data
      setInstanceRefreshKey((prev) => prev + 1);
    }
  };

  const handleNamespaceUpdate = (updatedNamespace: Namespace): void => {
    if (currentView.type === "namespace") {
      setCurrentView({ type: "namespace", namespace: updatedNamespace });
    } else if (currentView.type === "instance") {
      setCurrentView({ ...currentView, namespace: updatedNamespace });
    }
  };

  // Navigate from search results to instance storage view
  const handleNavigateToInstance = useCallback(
    async (
      namespaceId: string,
      instanceId: string,
      key?: string,
    ): Promise<void> => {
      try {
        // Fetch namespace and instance data
        const [namespace, instanceData] = await Promise.all([
          namespaceApi.get(namespaceId),
          instanceApi.get(instanceId),
        ]);

        // Navigate to instance view, optionally opening the key edit dialog
        setCurrentView({
          type: "instance",
          namespace,
          instance: instanceData,
          ...(key !== undefined && { initialEditKey: key }),
        });
      } catch (err) {
        logger.error("Failed to navigate to instance", err);
        // Could show a toast/error here, but for now just log it
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Migration Upgrade Banner */}
      {migrationStatus && !migrationStatus.isUpToDate && (
        <div
          className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800"
          role="alert"
          aria-live="polite"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ArrowUpCircle
                  className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Database upgrade available
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {migrationStatus.pendingMigrations.length} migration
                    {migrationStatus.pendingMigrations.length !== 1
                      ? "s"
                      : ""}{" "}
                    pending
                    {migrationStatus.legacy?.isLegacy &&
                      " (legacy installation detected)"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {migrationError && (
                  <span
                    className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
                    title={migrationError}
                  >
                    {migrationError}
                  </span>
                )}
                <button
                  onClick={() => void handleApplyMigrations()}
                  disabled={migrationLoading}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={
                    migrationLoading
                      ? "Upgrading database"
                      : "Upgrade database now"
                  }
                >
                  {migrationLoading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 mr-2 animate-spin"
                        aria-hidden="true"
                      />
                      Upgrading...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle
                        className="h-4 w-4 mr-2"
                        aria-hidden="true"
                      />
                      Upgrade Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Success Banner */}
      {migrationSuccess && (
        <div
          className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800"
          role="status"
          aria-live="polite"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Check
                className="h-5 w-5 text-green-600 dark:text-green-400"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Database upgraded successfully! All migrations have been
                applied.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {currentView.type === "list" && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger
                value="namespaces"
                className="flex items-center gap-2"
              >
                <Box className="h-4 w-4" />
                Namespaces
              </TabsTrigger>
              <TabsTrigger value="health" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Health
              </TabsTrigger>
              <TabsTrigger value="jobs" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Job History
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Webhooks
              </TabsTrigger>
            </TabsList>

            <Suspense fallback={<LazyLoadingFallback />}>
              <TabsContent value="health">
                <HealthDashboard />
              </TabsContent>

              <TabsContent value="jobs">
                <JobHistory />
              </TabsContent>

              <TabsContent value="metrics">
                <MetricsDashboard />
              </TabsContent>

              <TabsContent value="namespaces">
                <NamespaceList onSelectNamespace={handleSelectNamespace} />
              </TabsContent>

              <TabsContent value="search">
                <GlobalSearch
                  onNavigateToInstance={(nsId, instId, key) =>
                    void handleNavigateToInstance(nsId, instId, key)
                  }
                />
              </TabsContent>

              <TabsContent value="webhooks">
                <WebhookManager />
              </TabsContent>
            </Suspense>
          </Tabs>
        )}

        {currentView.type === "namespace" && (
          <NamespaceView
            key={`namespace-${currentView.namespace.id}-${instanceRefreshKey}`}
            namespace={currentView.namespace}
            onBack={handleBackToList}
            onSelectInstance={handleSelectInstance}
            onNamespaceUpdate={handleNamespaceUpdate}
          />
        )}

        {currentView.type === "instance" && (
          <StorageViewer
            namespace={currentView.namespace}
            instance={currentView.instance}
            onBack={handleBackToNamespace}
            {...(currentView.initialEditKey !== undefined && {
              initialEditKey: currentView.initialEditKey,
            })}
          />
        )}
      </main>
    </div>
  );
}
