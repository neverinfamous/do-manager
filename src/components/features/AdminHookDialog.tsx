import { useState } from 'react'
import { Code, Package, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { AdminHookTemplate } from './AdminHookTemplate'

interface AdminHookDialogProps {
  defaultClassName?: string
  defaultStorageBackend?: 'sqlite' | 'kv'
}

export function AdminHookDialog({
  defaultClassName = 'MyDurableObject',
  defaultStorageBackend = 'sqlite',
}: AdminHookDialogProps): React.ReactElement {
  const [className, setClassName] = useState(defaultClassName)
  const [storageBackend, setStorageBackend] = useState<'sqlite' | 'kv'>(
    defaultStorageBackend
  )
  const [copiedNpm, setCopiedNpm] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const npmInstallCommand = 'npm install do-manager-admin-hooks'
  
  const npmUsageCode = `import { withAdminHooks } from 'do-manager-admin-hooks';

export class ${className} extends withAdminHooks() {
  async fetch(request: Request): Promise<Response> {
    // Handle admin requests first (required for DO Manager)
    const adminResponse = await this.handleAdminRequest(request);
    if (adminResponse) return adminResponse;

    // Your custom logic here
    return new Response('Hello from ${className}!');
  }
}`

  const handleCopyNpm = async (): Promise<void> => {
    await navigator.clipboard.writeText(npmInstallCommand)
    setCopiedNpm(true)
    setTimeout(() => setCopiedNpm(false), 2000)
  }

  const handleCopyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(npmUsageCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Code className="h-4 w-4 mr-2" />
          Get Admin Hook Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admin Hook Setup</DialogTitle>
          <DialogDescription>
            Enable DO Manager to access your Durable Object&apos;s storage
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="npm" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="npm" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              NPM Package (Recommended)
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Manual Copy-Paste
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="npm" className="space-y-4 mt-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                ✨ Easiest Setup
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                Install the NPM package and extend your DO class. Automatic updates, full TypeScript support, no copy-paste errors.
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">1. Install the package</Label>
                <div className="mt-2 relative">
                  <pre className="bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto">
                    {npmInstallCommand}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={() => void handleCopyNpm()}
                  >
                    {copiedNpm ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">2. Enter your class name</Label>
                <Input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="MyDurableObject"
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">3. Update your Durable Object class</Label>
                <div className="mt-2 relative">
                  <pre className="bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    {npmUsageCode}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={() => void handleCopyCode()}
                  >
                    {copiedCode ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">4. Deploy and configure</Label>
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  <p>• Deploy your Worker: <code className="bg-muted px-1 rounded">wrangler deploy</code></p>
                  <p>• In DO Manager Settings, set the <strong>Admin Hook Endpoint URL</strong> to your Worker URL</p>
                  <p>• Admin hooks are automatically enabled when you save the URL</p>
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <a
                href="https://github.com/neverinfamous/do-manager-admin-hooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View package documentation
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Manual Setup
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Copy and paste this code into your Durable Object class. Use this if you can&apos;t install NPM packages.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="MyDurableObject"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Storage Backend</legend>
                <div className="flex gap-4 h-10 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="storage"
                      id="hook-storage-sqlite"
                      value="sqlite"
                      checked={storageBackend === 'sqlite'}
                      onChange={() => setStorageBackend('sqlite')}
                      className="accent-primary"
                    />
                    <span className="text-sm">SQLite</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="storage"
                      id="hook-storage-kv"
                      value="kv"
                      checked={storageBackend === 'kv'}
                      onChange={() => setStorageBackend('kv')}
                      className="accent-primary"
                    />
                    <span className="text-sm">KV (Legacy)</span>
                  </label>
                </div>
              </fieldset>
            </div>
            <AdminHookTemplate
              className={className}
              storageBackend={storageBackend}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
