import { useState } from 'react'
import { ArrowLeft, Box, Code, Settings } from 'lucide-react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { InstanceList } from './InstanceList'
import { AdminHookDialog } from './AdminHookDialog'
import { NamespaceSettingsDialog } from './NamespaceSettingsDialog'
import type { Namespace, Instance } from '../../types'

interface NamespaceViewProps {
  namespace: Namespace
  onBack: () => void
  onSelectInstance: (instance: Instance) => void
  onNamespaceUpdate: (namespace: Namespace) => void
}

export function NamespaceView({
  namespace,
  onBack,
  onSelectInstance,
  onNamespaceUpdate,
}: NamespaceViewProps) {
  const [activeTab, setActiveTab] = useState('instances')
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Box className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">{namespace.name}</h2>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {namespace.class_name}
              {namespace.script_name && ` • ${namespace.script_name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminHookDialog
            defaultClassName={namespace.class_name}
            defaultStorageBackend={namespace.storage_backend}
          />
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <NamespaceSettingsDialog
        namespace={namespace}
        open={showSettings}
        onOpenChange={setShowSettings}
        onUpdate={onNamespaceUpdate}
      />

      {/* Status badges */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            namespace.storage_backend === 'sqlite'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          }`}
        >
          {namespace.storage_backend.toUpperCase()} Backend
        </span>
        {namespace.admin_hook_enabled === 1 ? (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Admin Hook Enabled
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Admin Hook Not Configured
          </span>
        )}
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="instances" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Instances
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Admin Hook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-6">
          <InstanceList
            namespace={namespace}
            onSelectInstance={onSelectInstance}
          />
        </TabsContent>

        <TabsContent value="code" className="mt-6">
          <div className="max-w-3xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Setup Admin Hook</h3>
              <p className="text-sm text-muted-foreground">
                To manage storage for instances in this namespace, you need to add
                admin hook methods to your Durable Object class. Click the button
                below to generate the code.
              </p>
            </div>
            <AdminHookDialog
              defaultClassName={namespace.class_name}
              defaultStorageBackend={namespace.storage_backend}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

