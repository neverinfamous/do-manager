-- Phase 10: Add instance tagging support
-- Migration: Add tags column to instances table

-- Add tags column (JSON array stored as TEXT)
ALTER TABLE instances ADD COLUMN tags TEXT DEFAULT '[]';

-- Create index for tag search performance
CREATE INDEX IF NOT EXISTS idx_instances_tags ON instances(tags);
