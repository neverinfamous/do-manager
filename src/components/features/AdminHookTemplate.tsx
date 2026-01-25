import { useState } from "react";
import { Copy, Check, Code } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface AdminHookTemplateProps {
  className?: string;
  storageBackend?: "sqlite" | "kv";
}

export function AdminHookTemplate({
  className = "MyDurableObject",
  storageBackend = "sqlite",
}: AdminHookTemplateProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const sqliteTemplate = `// Admin Hook Methods for DO Manager
// Add these methods to your ${className} class

/**
 * List all storage keys/tables
 */
async adminList(): Promise<{ keys?: string[]; tables?: string[] }> {
  // Always list KV keys
  const entries = await this.ctx.storage.list();
  const keys = [...entries.keys()];

  if (this.ctx.storage.sql) {
    // SQLite backend - also list tables (exclude internal _cf_* tables)
    const tables = this.ctx.storage.sql
      .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
      .toArray()
      .map((row: { name: string }) => row.name);
    return { keys, tables };
  }
  // KV backend - just return keys
  return { keys };
}

/**
 * Get storage data
 */
async adminGet(key: string): Promise<unknown> {
  return await this.ctx.storage.get(key);
}

/**
 * Put storage data
 */
async adminPut(key: string, value: unknown): Promise<void> {
  await this.ctx.storage.put(key, value);
}

/**
 * Delete storage key
 */
async adminDelete(key: string): Promise<void> {
  await this.ctx.storage.delete(key);
}

/**
 * Execute SQL query (SQLite backend only)
 */
async adminSql(query: string): Promise<unknown[]> {
  if (!this.ctx.storage.sql) {
    throw new Error('SQL not available - this DO uses KV backend');
  }
  return this.ctx.storage.sql.exec(query).toArray();
}

/**
 * Get current alarm
 */
async adminGetAlarm(): Promise<number | null> {
  return await this.ctx.storage.getAlarm();
}

/**
 * Set alarm
 */
async adminSetAlarm(timestamp: number): Promise<void> {
  await this.ctx.storage.setAlarm(timestamp);
}

/**
 * Delete alarm
 */
async adminDeleteAlarm(): Promise<void> {
  await this.ctx.storage.deleteAlarm();
}

/**
 * Delete all storage (use with caution!)
 */
async adminDeleteAll(): Promise<void> {
  await this.ctx.storage.deleteAll();
}

/**
 * Get storage stats
 */
async adminStats(): Promise<{ 
  hasAlarm: boolean; 
  alarmTime: number | null;
  storageBackend: 'sqlite' | 'kv';
}> {
  const alarm = await this.ctx.storage.getAlarm();
  return {
    hasAlarm: alarm !== null,
    alarmTime: alarm,
    storageBackend: this.ctx.storage.sql ? 'sqlite' : 'kv',
  };
}`;

  const kvTemplate = `// Admin Hook Methods for DO Manager (KV Backend)
// Add these methods to your ${className} class

/**
 * List all storage keys
 */
async adminList(): Promise<{ keys: string[] }> {
  const entries = await this.ctx.storage.list();
  return { keys: [...entries.keys()] };
}

/**
 * Get storage data
 */
async adminGet(key: string): Promise<unknown> {
  return await this.ctx.storage.get(key);
}

/**
 * Put storage data
 */
async adminPut(key: string, value: unknown): Promise<void> {
  await this.ctx.storage.put(key, value);
}

/**
 * Delete storage key
 */
async adminDelete(key: string): Promise<void> {
  await this.ctx.storage.delete(key);
}

/**
 * Get current alarm
 */
async adminGetAlarm(): Promise<number | null> {
  return await this.ctx.storage.getAlarm();
}

/**
 * Set alarm
 */
async adminSetAlarm(timestamp: number): Promise<void> {
  await this.ctx.storage.setAlarm(timestamp);
}

/**
 * Delete alarm
 */
async adminDeleteAlarm(): Promise<void> {
  await this.ctx.storage.deleteAlarm();
}

/**
 * Delete all storage (use with caution!)
 */
async adminDeleteAll(): Promise<void> {
  await this.ctx.storage.deleteAll();
}

/**
 * Get storage stats
 */
async adminStats(): Promise<{ 
  hasAlarm: boolean; 
  alarmTime: number | null;
  storageBackend: 'kv';
}> {
  const alarm = await this.ctx.storage.getAlarm();
  return {
    hasAlarm: alarm !== null,
    alarmTime: alarm,
    storageBackend: 'kv',
  };
}`;

  const template = storageBackend === "sqlite" ? sqliteTemplate : kvTemplate;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback - create temporary element and use selection API
      const textArea = document.createElement("textarea");
      textArea.value = template;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const selection = document.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <CardTitle>Admin Hook Template</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Add these methods to your Durable Object class to enable management
          features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm font-mono whitespace-pre-wrap">
            {template}
          </pre>
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            How to use
          </h4>
          <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
            <li>Copy the code above</li>
            <li>Paste it into your Durable Object class</li>
            <li>Deploy your Worker with the updated code</li>
            <li>Configure the endpoint URL in your namespace settings</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
