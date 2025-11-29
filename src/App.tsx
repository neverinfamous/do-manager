import { useState, useCallback } from 'react'
import { Box, History, BarChart3, Search, Activity, Bell } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Header } from './components/layout/Header'
import { NamespaceList } from './components/features/NamespaceList'
import { NamespaceView } from './components/features/NamespaceView'
import { StorageViewer } from './components/features/StorageViewer'
import { MetricsDashboard } from './components/features/MetricsDashboard'
import { JobHistory } from './components/features/JobHistory'
import { GlobalSearch } from './components/features/GlobalSearch'
import { HealthDashboard } from './components/features/HealthDashboard'
import { WebhookManager } from './components/features/WebhookManager'
import { namespaceApi } from './services/api'
import { instanceApi } from './services/instanceApi'
import type { Namespace, Instance } from './types'

type View =
  | { type: 'list' }
  | { type: 'namespace'; namespace: Namespace }
  | { type: 'instance'; namespace: Namespace; instance: Instance; initialEditKey?: string }

export default function App(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>({ type: 'list' })
  const [activeTab, setActiveTab] = useState('namespaces')

  const handleSelectNamespace = (namespace: Namespace): void => {
    setCurrentView({ type: 'namespace', namespace })
  }

  const handleSelectInstance = (instance: Instance): void => {
    if (currentView.type === 'namespace') {
      setCurrentView({ type: 'instance', namespace: currentView.namespace, instance })
    }
  }

  const handleBackToList = (): void => {
    setCurrentView({ type: 'list' })
  }

  const handleBackToNamespace = (): void => {
    if (currentView.type === 'instance') {
      setCurrentView({ type: 'namespace', namespace: currentView.namespace })
    }
  }

  const handleNamespaceUpdate = (updatedNamespace: Namespace): void => {
    if (currentView.type === 'namespace') {
      setCurrentView({ type: 'namespace', namespace: updatedNamespace })
    } else if (currentView.type === 'instance') {
      setCurrentView({ ...currentView, namespace: updatedNamespace })
    }
  }

  // Navigate from search results to instance storage view
  const handleNavigateToInstance = useCallback(async (namespaceId: string, instanceId: string, key?: string): Promise<void> => {
    try {
      // Fetch namespace and instance data
      const [namespace, instanceData] = await Promise.all([
        namespaceApi.get(namespaceId),
        instanceApi.get(instanceId),
      ])
      
      // Navigate to instance view, optionally opening the key edit dialog
      setCurrentView({ type: 'instance', namespace, instance: instanceData, initialEditKey: key })
    } catch (err) {
      console.error('Failed to navigate to instance:', err)
      // Could show a toast/error here, but for now just log it
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {currentView.type === 'list' && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="namespaces" className="flex items-center gap-2">
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
              <GlobalSearch onNavigateToInstance={(nsId, instId, key) => void handleNavigateToInstance(nsId, instId, key)} />
            </TabsContent>

            <TabsContent value="webhooks">
              <WebhookManager />
            </TabsContent>
          </Tabs>
        )}

        {currentView.type === 'namespace' && (
          <NamespaceView
            namespace={currentView.namespace}
            onBack={handleBackToList}
            onSelectInstance={handleSelectInstance}
            onNamespaceUpdate={handleNamespaceUpdate}
          />
        )}

        {currentView.type === 'instance' && (
          <StorageViewer
            namespace={currentView.namespace}
            instance={currentView.instance}
            onBack={handleBackToNamespace}
            initialEditKey={currentView.initialEditKey}
          />
        )}
      </main>
    </div>
  )
}

