/**
 * Migration Routes
 *
 * API endpoints for managing database schema migrations.
 */

import type { Env, CorsHeaders, ErrorContext } from "../types";
import {
  getMigrationStatus,
  applyMigrations,
  detectLegacyInstallation,
  markMigrationsAsApplied,
} from "../utils/migrations";
import { logInfo, logWarning, logError } from "../utils/error-logger";

/**
 * Helper to create JSON response headers
 */
function jsonHeaders(corsHeaders: CorsHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  headers.set("Content-Type", "application/json");
  return headers;
}

/**
 * Helper to create error context
 */
function createContext(
  operation: string,
  userEmail: string | null,
  metadata?: Record<string, unknown>,
): ErrorContext {
  const ctx: ErrorContext = { module: "migrations", operation };
  if (userEmail) {
    ctx.userId = userEmail;
  }
  if (metadata) {
    ctx.metadata = metadata;
  }
  return ctx;
}

/**
 * Handle migration-related API routes
 */
export async function handleMigrationRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: CorsHeaders,
  isLocalDev: boolean,
  userEmail: string | null,
): Promise<Response> {
  const db = env.METADATA;

  // GET /api/migrations/status
  if (request.method === "GET" && url.pathname === "/api/migrations/status") {
    logInfo("Checking migration status", createContext("status", userEmail));

    if (isLocalDev) {
      const mockStatus = {
        currentVersion: 4,
        latestVersion: 4,
        pendingMigrations: [],
        appliedMigrations: [
          {
            version: 1,
            migration_name: "initial_schema",
            applied_at: new Date().toISOString(),
          },
          {
            version: 2,
            migration_name: "webhooks",
            applied_at: new Date().toISOString(),
          },
          {
            version: 3,
            migration_name: "alarm_history",
            applied_at: new Date().toISOString(),
          },
          {
            version: 4,
            migration_name: "saved_queries_and_colors",
            applied_at: new Date().toISOString(),
          },
        ],
        isUpToDate: true,
      };

      return new Response(
        JSON.stringify({ result: mockStatus, success: true }),
        {
          headers: jsonHeaders(corsHeaders),
        },
      );
    }

    try {
      const status = await getMigrationStatus(db);
      const legacyInfo = await detectLegacyInstallation(db);

      return new Response(
        JSON.stringify({
          result: { ...status, legacy: legacyInfo },
          success: true,
        }),
        {
          headers: jsonHeaders(corsHeaders),
        },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWarning(
        `Failed to get migration status: ${errorMessage}`,
        createContext("status", userEmail),
      );

      return new Response(
        JSON.stringify({
          error: "Failed to get migration status",
          success: false,
        }),
        {
          status: 500,
          headers: jsonHeaders(corsHeaders),
        },
      );
    }
  }

  // POST /api/migrations/apply
  if (request.method === "POST" && url.pathname === "/api/migrations/apply") {
    logInfo("Applying migrations", createContext("apply", userEmail));

    if (isLocalDev) {
      const mockResult = {
        success: true,
        migrationsApplied: 0,
        currentVersion: 4,
        errors: [],
      };

      return new Response(
        JSON.stringify({ result: mockResult, success: true }),
        {
          headers: jsonHeaders(corsHeaders),
        },
      );
    }

    try {
      const result = await applyMigrations(db);

      if (result.success) {
        logInfo(
          `Successfully applied ${result.migrationsApplied} migration(s)`,
          createContext("apply", userEmail, {
            migrationsApplied: result.migrationsApplied,
            currentVersion: result.currentVersion,
          }),
        );
      } else {
        void logError(
          env,
          `Migration failed: ${result.errors.join(", ")}`,
          createContext("apply", userEmail, { errors: result.errors }),
          isLocalDev,
        );
      }

      return new Response(
        JSON.stringify({
          result,
          success: result.success,
        }),
        {
          status: result.success ? 200 : 500,
          headers: jsonHeaders(corsHeaders),
        },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      void logError(
        env,
        `Failed to apply migrations: ${errorMessage}`,
        createContext("apply", userEmail),
        isLocalDev,
      );

      return new Response(
        JSON.stringify({
          error: "Failed to apply migrations",
          success: false,
        }),
        {
          status: 500,
          headers: jsonHeaders(corsHeaders),
        },
      );
    }
  }

  // POST /api/migrations/mark-legacy
  if (
    request.method === "POST" &&
    url.pathname === "/api/migrations/mark-legacy"
  ) {
    logInfo(
      "Marking legacy migrations",
      createContext("mark_legacy", userEmail),
    );

    if (isLocalDev) {
      return new Response(
        JSON.stringify({ result: { markedUpTo: 4 }, success: true }),
        {
          headers: jsonHeaders(corsHeaders),
        },
      );
    }

    try {
      const body = (await request.json()) as { version?: number };
      const targetVersion = body.version;

      if (typeof targetVersion !== "number" || targetVersion < 1) {
        return new Response(
          JSON.stringify({
            error: "Invalid version",
            success: false,
          }),
          {
            status: 400,
            headers: jsonHeaders(corsHeaders),
          },
        );
      }

      const legacyInfo = await detectLegacyInstallation(db);

      if (!legacyInfo.isLegacy && legacyInfo.suggestedVersion === 0) {
        return new Response(
          JSON.stringify({
            error: "Not a legacy installation",
            success: false,
          }),
          {
            status: 400,
            headers: jsonHeaders(corsHeaders),
          },
        );
      }

      await markMigrationsAsApplied(db, targetVersion);

      logInfo(
        `Marked migrations up to version ${targetVersion} as applied`,
        createContext("mark_legacy", userEmail, { version: targetVersion }),
      );

      return new Response(
        JSON.stringify({
          result: { markedUpTo: targetVersion },
          success: true,
        }),
        {
          headers: jsonHeaders(corsHeaders),
        },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWarning(
        `Failed to mark legacy migrations: ${errorMessage}`,
        createContext("mark_legacy", userEmail),
      );

      return new Response(
        JSON.stringify({
          error: "Failed to mark migrations",
          success: false,
        }),
        {
          status: 500,
          headers: jsonHeaders(corsHeaders),
        },
      );
    }
  }

  // Route not handled - 404
  return new Response(
    JSON.stringify({
      error: "Not Found",
      message: `Migration route ${url.pathname} not found`,
    }),
    {
      status: 404,
      headers: jsonHeaders(corsHeaders),
    },
  );
}
