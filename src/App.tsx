import { useState } from 'react'
import { Box, History, BarChart3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Header } from './components/layout/Header'
import { NamespaceList } from './components/features/NamespaceList'
import { NamespaceView } from './components/features/NamespaceView'
import { StorageViewer } from './components/features/StorageViewer'
import { MetricsDashboard } from './components/features/MetricsDashboard'
import { JobHistory } from './components/features/JobHistory'
import type { Namespace, Instance } from './types'

type View =
  | { type: 'list' }
  | { type: 'namespace'; namespace: Namespace }
  | { type: 'instance'; namespace: Namespace; instance: Instance }

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
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="jobs" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Job History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="namespaces">
              <NamespaceList onSelectNamespace={handleSelectNamespace} />
            </TabsContent>

            <TabsContent value="metrics">
              <MetricsDashboard />
            </TabsContent>

            <TabsContent value="jobs">
              <JobHistory />
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
          />
        )}
      </main>
    </div>
  )
}

