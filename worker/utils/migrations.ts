/**
 * Database Migration System
 *
 * Provides automated schema migrations for the DO Manager metadata database.
 * Tracks applied migrations in the schema_version table and applies pending
 * migrations when triggered by the user via the UI upgrade banner.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { logInfo, logWarning } from "./error-logger";

// ============================================
// Types
// ============================================

export interface Migration {
  version: number;
  name: string;
  description: string;
  sql: string;
}

export interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: AppliedMigration[];
  isUpToDate: boolean;
}

export interface AppliedMigration {
  version: number;
  migration_name: string;
  applied_at: string;
}

export interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  currentVersion: number;
  errors: string[];
}

export interface LegacyInstallationInfo {
  isLegacy: boolean;
  existingTables: string[];
  suggestedVersion: number;
}

// ============================================
// Migration Registry
// ============================================

/**
 * All migrations in order. Each migration should be idempotent where possible
 * (using IF NOT EXISTS, etc.) to handle edge cases gracefully.
 *
 * IMPORTANT: Never modify existing migrations. Always add new ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    description:
      "Base schema with namespaces, instances, jobs, audit_log, backups",
    sql: `
      -- Tracked namespaces
      CREATE TABLE IF NOT EXISTS namespaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        script_name TEXT,
        class_name TEXT NOT NULL,
        storage_backend TEXT DEFAULT 'sqlite' CHECK (storage_backend IN ('sqlite', 'kv')),
        endpoint_url TEXT,
        admin_hook_enabled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        metadata TEXT
      );

      -- Tracked instances
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        namespace_id TEXT NOT NULL,
        name TEXT,
        object_id TEXT NOT NULL,
        last_accessed TEXT,
        storage_size_bytes INTEGER,
        has_alarm INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE
      );

      -- Job history
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

      -- Audit log
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

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_instances_namespace ON instances(namespace_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_namespace ON jobs(namespace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_backups_instance ON backups(instance_id);
    `,
  },
  {
    version: 2,
    name: "webhooks",
    description: "Add webhooks table for event notifications",
    sql: `
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        events TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
    `,
  },
  {
    version: 3,
    name: "alarm_history",
    description: "Add alarm_history table for tracking alarm lifecycle",
    sql: `
      CREATE TABLE IF NOT EXISTS alarm_history (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        namespace_id TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        created_by TEXT,
        FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_alarm_history_instance ON alarm_history(instance_id);
      CREATE INDEX IF NOT EXISTS idx_alarm_history_status ON alarm_history(status);
    `,
  },
  {
    version: 4,
    name: "saved_queries_and_colors",
    description: "Add saved_queries table and instance color column (phase8)",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_saved_queries_namespace ON saved_queries(namespace_id);
    `,
  },
  {
    version: 5,
    name: "namespace_colors",
    description:
      "Add color column to namespaces table for visual organization (phase9)",
    sql: `
      ALTER TABLE namespaces ADD COLUMN color TEXT;
    `,
  },
  {
    version: 6,
    name: "instance_tags",
    description:
      "Add tags column to instances table for tagging and search (phase10)",
    sql: `
      ALTER TABLE instances ADD COLUMN tags TEXT DEFAULT '[]';
      CREATE INDEX IF NOT EXISTS idx_instances_tags ON instances(tags);
    `,
  },
];

// ============================================
// Migration Functions
// ============================================

/**
 * Ensures the schema_version table exists.
 */
export async function ensureSchemaVersionTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      migration_name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `,
    )
    .run();
}

/**
 * Gets the current schema version from the database.
 */
export async function getCurrentVersion(db: D1Database): Promise<number> {
  try {
    const result = await db
      .prepare("SELECT MAX(version) as version FROM schema_version")
      .first<{ version: number | null }>();

    return result?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Gets all applied migrations from the database.
 */
export async function getAppliedMigrations(
  db: D1Database,
): Promise<AppliedMigration[]> {
  try {
    const result = await db
      .prepare(
        "SELECT version, migration_name, applied_at FROM schema_version ORDER BY version ASC",
      )
      .all<AppliedMigration>();

    return result.results;
  } catch {
    return [];
  }
}

/**
 * Gets the migration status including current version and pending migrations.
 */
export async function getMigrationStatus(
  db: D1Database,
): Promise<MigrationStatus> {
  await ensureSchemaVersionTable(db);

  const currentVersion = await getCurrentVersion(db);
  const appliedMigrations = await getAppliedMigrations(db);
  const lastMigration = MIGRATIONS[MIGRATIONS.length - 1];
  const latestVersion = lastMigration?.version ?? 0;

  const pendingMigrations = MIGRATIONS.filter(
    (m) => m.version > currentVersion,
  );

  return {
    currentVersion,
    latestVersion,
    pendingMigrations,
    appliedMigrations,
    isUpToDate: currentVersion >= latestVersion,
  };
}

/**
 * Applies all pending migrations in order.
 */
export async function applyMigrations(
  db: D1Database,
): Promise<MigrationResult> {
  const errors: string[] = [];
  let migrationsApplied = 0;

  try {
    await ensureSchemaVersionTable(db);
    const currentVersion = await getCurrentVersion(db);
    const pendingMigrations = MIGRATIONS.filter(
      (m) => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      logInfo("No pending migrations", {
        module: "migrations",
        operation: "apply",
      });
      return {
        success: true,
        migrationsApplied: 0,
        currentVersion,
        errors: [],
      };
    }

    logInfo(`Applying ${pendingMigrations.length} migration(s)`, {
      module: "migrations",
      operation: "apply",
      metadata: { currentVersion, pendingCount: pendingMigrations.length },
    });

    for (const migration of pendingMigrations) {
      try {
        logInfo(`Applying migration ${migration.version}: ${migration.name}`, {
          module: "migrations",
          operation: "apply_single",
          metadata: { version: migration.version, name: migration.name },
        });

        // Split SQL into individual statements and execute each
        const statements = migration.sql
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          await db.prepare(statement).run();
        }

        // Record the migration as applied
        await db
          .prepare(
            "INSERT INTO schema_version (version, migration_name) VALUES (?, ?)",
          )
          .bind(migration.version, migration.name)
          .run();

        migrationsApplied++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push(
          `Migration ${migration.version} (${migration.name}): ${errorMessage}`,
        );

        logWarning(
          `Failed to apply migration ${migration.version}: ${errorMessage}`,
          {
            module: "migrations",
            operation: "apply_single",
            metadata: { version: migration.version, error: errorMessage },
          },
        );

        break;
      }
    }

    const newVersion = await getCurrentVersion(db);

    return {
      success: errors.length === 0,
      migrationsApplied,
      currentVersion: newVersion,
      errors,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(`Migration system error: ${errorMessage}`);

    const currentVersion = await getCurrentVersion(db).catch(() => 0);

    return {
      success: false,
      migrationsApplied,
      currentVersion,
      errors,
    };
  }
}

/**
 * Detects if the database has existing tables but no schema_version tracking.
 */
export async function detectLegacyInstallation(
  db: D1Database,
): Promise<LegacyInstallationInfo> {
  try {
    const result = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_version'",
      )
      .all<{ name: string }>();

    const existingTables = result.results.map((r) => r.name);

    const versionCheck = await getCurrentVersion(db);

    if (versionCheck > 0) {
      return {
        isLegacy: false,
        existingTables,
        suggestedVersion: versionCheck,
      };
    }

    // Detect which migrations have effectively been applied based on existing tables
    let suggestedVersion = 0;

    if (
      existingTables.includes("namespaces") &&
      existingTables.includes("instances")
    ) {
      suggestedVersion = 1;
    }
    if (existingTables.includes("webhooks")) {
      suggestedVersion = 2;
    }
    if (existingTables.includes("alarm_history")) {
      suggestedVersion = 3;
    }
    if (existingTables.includes("saved_queries")) {
      suggestedVersion = 4;
    }

    return {
      isLegacy: suggestedVersion > 0,
      existingTables,
      suggestedVersion,
    };
  } catch {
    return { isLegacy: false, existingTables: [], suggestedVersion: 0 };
  }
}

/**
 * Marks migrations as applied without running them.
 */
export async function markMigrationsAsApplied(
  db: D1Database,
  upToVersion: number,
): Promise<void> {
  await ensureSchemaVersionTable(db);

  const migrationsToMark = MIGRATIONS.filter((m) => m.version <= upToVersion);

  for (const migration of migrationsToMark) {
    const existing = await db
      .prepare("SELECT version FROM schema_version WHERE version = ?")
      .bind(migration.version)
      .first();

    if (!existing) {
      await db
        .prepare(
          "INSERT INTO schema_version (version, migration_name) VALUES (?, ?)",
        )
        .bind(migration.version, migration.name)
        .run();

      logInfo(`Marked migration ${migration.version} as applied (legacy)`, {
        module: "migrations",
        operation: "mark_applied",
        metadata: { version: migration.version, name: migration.name },
      });
    }
  }
}
