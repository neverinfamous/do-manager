-- DO Manager Metadata Schema
-- Run: wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql

-- Tracked namespaces (manually added or auto-discovered)
CREATE TABLE IF NOT EXISTS namespaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  script_name TEXT,
  class_name TEXT NOT NULL,
  storage_backend TEXT DEFAULT 'sqlite' CHECK (storage_backend IN ('sqlite', 'kv')),
  endpoint_url TEXT,
  admin_hook_enabled INTEGER DEFAULT 0,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  metadata TEXT
);

-- Tracked instances within namespaces
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  name TEXT,
  object_id TEXT NOT NULL,
  last_accessed TEXT,
  storage_size_bytes INTEGER,
  has_alarm INTEGER DEFAULT 0,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  metadata TEXT,
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE
);

-- Job history for async operations
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  namespace_id TEXT,
  instance_id TEXT,
  user_email TEXT,
  progress INTEGER DEFAULT 0,
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE SET NULL,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
);

-- Audit log for tracking all operations
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_email TEXT,
  namespace_id TEXT,
  instance_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE SET NULL,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
);

-- R2 backup records
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  storage_type TEXT DEFAULT 'sqlite',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  metadata TEXT,
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

-- Webhook configurations for event notifications
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT NOT NULL, -- JSON array of event types
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Alarm history for tracking alarm lifecycle
CREATE TABLE IF NOT EXISTS alarm_history (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  scheduled_time TEXT NOT NULL, -- ISO timestamp when alarm should fire
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')), -- When alarm was set
  completed_at TEXT, -- When alarm fired or was cancelled
  created_by TEXT,
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

-- Saved SQL queries per namespace
CREATE TABLE IF NOT EXISTS saved_queries (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instances_namespace ON instances(namespace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_namespace ON jobs(namespace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_instance ON backups(instance_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_alarm_history_instance ON alarm_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_alarm_history_status ON alarm_history(status);
CREATE INDEX IF NOT EXISTS idx_saved_queries_namespace ON saved_queries(namespace_id);

