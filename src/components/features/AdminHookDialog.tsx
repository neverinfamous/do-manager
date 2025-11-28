import { useState } from 'react'
import { Code } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
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
}: AdminHookDialogProps) {
  const [className, setClassName] = useState(defaultClassName)
  const [storageBackend, setStorageBackend] = useState<'sqlite' | 'kv'>(
    defaultStorageBackend
  )

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
          <DialogTitle>Admin Hook Generator</DialogTitle>
          <DialogDescription>
            Generate the admin hook code for your Durable Object class
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

