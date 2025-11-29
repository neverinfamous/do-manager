-- Phase 8 Migration
-- Run: npx wrangler d1 execute do-manager-metadata --remote --file=worker/migrations/phase8.sql

-- Add color column to instances table
ALTER TABLE instances ADD COLUMN color TEXT;

-- Create saved_queries table
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

-- Add index for saved_queries
CREATE INDEX IF NOT EXISTS idx_saved_queries_namespace ON saved_queries(namespace_id);

