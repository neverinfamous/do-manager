-- Phase 9: Add namespace color support for visual organization
-- Adds color column to namespaces table, matching instance color functionality

ALTER TABLE namespaces ADD COLUMN color TEXT;
