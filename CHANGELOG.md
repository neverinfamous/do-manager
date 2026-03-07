# Changelog

All notable changes to DO Manager.

---

## [Unreleased]

### Documentation

- **Changelog Migrated:** Moved `Changelog.md` from the wiki repository into the main project root as `CHANGELOG.md`.

---

## [1.3.2] - 2026-03-06

### CI/CD

- **Docker Publish Trigger Fix**: Docker images now only build on tag pushes (`v*`), preventing duplicate builds on every push to main
- **Tag Condition Fix**: Updated `refs/heads/main` conditions to `startsWith(github.ref, 'refs/tags/v')` for tag-triggered workflows

### Security

- **P111 Exact Pin**: Changed minimatch override from `^10.2.4` (caret) to `10.2.4` (exact) to prevent lockfile drift from Dockerfile patch version

---

## [1.3.1] - 2026-03-06

### Changed

- **Node.js 24 LTS Baseline**: Upgraded from Node 20 to Node 24 LTS across all configurations
  - Dockerfile updated to use `node:24-alpine` for both builder and runtime stages
  - GitHub Actions workflows updated to use Node 24.x as primary version
  - `package.json` now includes `engines` field requiring Node.js >=24.0.0
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **ESLint Zero-Suppression Sweep**: Achieved 100% zero-suppression frontend codebase
  - **Created `src/lib/logger.ts`** - Centralized logging utility with structured context support
  - **Removed all eslint-disable comments** from application code (only `logger.ts` retained via `eslint.config.js` override)
  - **Files refactored to use logger**: `retry.ts`, `batchApi.ts`, `App.tsx`, `BatchBackupDialog.tsx`, `BatchDeleteDialog.tsx`, `BatchDownloadDialog.tsx`, `GlobalSearch.tsx`, `InstanceListView.tsx`, `NamespaceCard.tsx`, `NamespaceListView.tsx`, `SqlConsole.tsx`, `StorageViewer.tsx`
  - **Fixed `react-hooks/exhaustive-deps`** in `UnfreezeInstanceDialog.tsx` by wrapping `checkFreezeStatus` in `useCallback`
  - **Fixed `react-refresh/only-export-components`:**
    - `button.tsx` - Made `buttonVariants` internal (removed export)
    - `ThemeContext.tsx` - Split into `theme-context.ts` (types/context) + `ThemeContext.tsx` (component only)
- **ESLint 10 Migration**: Upgraded from ESLint 9 to ESLint 10
  - Updated `eslint` 9.39.2 → 10.0.1 and `@eslint/js` 9.39.2 → 10.0.1
  - Fixed 2 `no-useless-assignment` violations in `worker/index.ts` and `worker/routes/webhooks.ts`
  - Updated `tsconfig.app.json` target/lib from ES2020 → ES2022 (required for `Error` `cause` option)
  - Added `eslint-plugin-react-hooks` eslint peer dep override (plugin hasn't declared ESLint 10 support yet)
  - Removed `brace-expansion` override (no longer needed; was incompatible with minimatch 10.x)
- **Docker Build Optimization**: Added `.dockerignore` to exclude unnecessary files from build context
  - Excludes documentation, IDE files, test files, `.git`, `.github`, and other non-essential files
  - Reduces Docker build context transfer size and improves build speed

### CI/CD

- **Automated Dependency Maintenance**: Added GitHub Agentic Workflow (`dependency-maintenance.md`) powered by Copilot (Claude Opus 4)
  - Runs weekly on Mondays at 9am EST and on manual dispatch
  - Batches all npm updates, Dockerfile transitive dep audits, and validation into a single PR
  - Replaces per-dependency Dependabot PRs to avoid excessive Docker/npm deploys
- **Dependabot npm PRs Suppressed**: Set `open-pull-requests-limit: 0` for npm ecosystem — vulnerability detection remains active, but individual PRs are no longer created
- **Removed Dependabot Auto-Merge Workflow**: Deleted `dependabot-auto-merge.yml` to prevent automatic merging of dependency PRs
  - Dependabot will still open PRs for visibility into available updates
  - Dependencies are now updated manually in batched local sessions to avoid unnecessary Docker deployments

### Dependencies

- **@cloudflare/workers-types**: Updated 4.20260210.0 → 4.20260307.1
- **@tailwindcss/postcss**: Updated 4.1.18 → 4.2.1
- **@types/node**: Updated 25.2.3 → 25.3.5
- **@types/prismjs**: Updated 1.26.5 → 1.26.6
- **@types/react**: Updated 19.2.13 → 19.2.14
- **eslint**: Updated 9.39.2 → 10.0.3
- **@eslint/js**: Updated 9.39.2 → 10.0.1
- **eslint-plugin-react-refresh**: Updated 0.5.0 → 0.5.2
- **globals**: Updated 17.3.0 → 17.4.0
- **jose**: Updated 6.1.3 → 6.2.0
- **lucide-react**: Updated 0.563.0 → 0.577.0
- **postcss**: Updated 8.5.6 → 8.5.8
- **sql-formatter**: Updated 15.7.0 → 15.7.2
- **tailwind-merge**: Updated 3.4.0 → 3.5.0
- **tailwindcss**: Updated 4.1.18 → 4.2.1
- **typescript-eslint**: Updated 8.55.0 → 8.56.1
- **wrangler**: Updated 4.64.0 → 4.71.0

### Security

- **GHSA-3ppc-4f35-3m26** (minimatch ReDoS): Resolved all npm audit vulnerabilities
  - ESLint 10 upgrade eliminated eslint-chain minimatch vulnerability
  - Promoted minimatch override to top-level `^10.2.3` (was scoped to `@typescript-eslint/typescript-estree`)
  - Removed `brace-expansion` ^2.0.2 override (incompatible with minimatch 10.x; original vulnerability no longer relevant)
- **GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74** (minimatch ReDoS v2): Fixed matchOne() combinatorial backtracking via top-level minimatch override `^10.2.3` and Docker P111 patching to minimatch@10.2.4
- **GHSA-mw96-cpmx-2vgc** (rollup path traversal): Updated rollup 4.55.1 → 4.59.0 via npm audit fix
- **CVE-2026-26960** (tar path traversal): Updated tar override 7.5.2 → 7.5.10
- **Docker P111 patching**: Added minimatch@10.2.4 to npm CLI patching in both builder and runtime stages; updated tar patch 7.5.2 → 7.5.10

---

## [1.3.0] - 2026-01-08

### Changed

- **Dependency Updates**
  - `@cloudflare/workers-types` 4.20251229.0 → 4.20260109.0
  - `globals` 16.5.0 → 17.0.0
  - `typescript-eslint` 8.50.1 → 8.52.0
  - `vite` 7.3.0 → 7.3.1
  - `wrangler` 4.56.0 → 4.58.0

### Added

- **Granular Webhook Events** - Added 7 new webhook event types for fine-grained notifications
  - **Storage events**: `storage_create`, `storage_update`, `storage_delete`
  - **Instance events**: `instance_create`, `instance_delete`
  - **Import/Export events**: `import_complete`, `export_complete`
  - Total webhook events: 6 → 13 (matching kv-manager parity)
- **Enhanced Metrics Dashboard** - Complete rewrite using Cloudflare's GraphQL Analytics API
  - **Tabbed interface**: Invocations | Storage | Subrequests views
  - **All 4 DO datasets**: Now queries `durableObjectsInvocationsAdaptiveGroups`, `durableObjectsPeriodicGroups`, `durableObjectsStorageGroups`, and `durableObjectsSubrequestsAdaptiveGroups`
  - **Namespace filtering**: Filter metrics to specific DO namespaces via `scriptName`
  - **Latency percentiles**: Real P50/P90/P99 wall time metrics (replacing estimated values)
  - **Storage tab**: Storage bytes and keys tracking with trend visualization
  - **Subrequests tab**: External API call monitoring unique to Durable Objects
  - **Time range selection**: Switch between 24h/7d/30d views
  - **2-minute caching**: Fast metrics with skip-cache refresh option
  - Query all 4 Durable Objects GraphQL datasets for comprehensive analytics

---

## [1.2.0] - 2026-01-05

### Added

- **Instance Migration** - Migrate instances between namespaces with full data transfer
  - **Three Cutover Modes:**
    - `Copy Only` — Source instance remains unchanged
    - `Copy + Freeze Source` — Source becomes read-only after migration (writes blocked)
    - `Copy + Delete Source` — Source instance deleted after successful migration
  - **Optional Verification** — Post-migration key count comparison to ensure data integrity
  - **Alarm Migration** — Optionally migrate scheduled alarm state to new instance
  - **UI Integration** — "Migrate to Namespace..." button in both grid and list views
  - New API endpoint: `POST /api/instances/:id/migrate`
  - New job type: `migrate_instance` in Job History

### Changed

- **Admin Hooks Package** (`do-manager-admin-hooks`) - Added freeze/unfreeze functionality
  - New endpoints: `PUT /admin/:name/freeze`, `DELETE /admin/:name/freeze`, `GET /admin/:name/freeze`
  - Frozen instances return 423 (Locked) on write operations (put, delete, import)
  - Required for `Copy + Freeze Source` migration mode

### Fixed

- **Local Development Auth** — Fixed authentication bypass detection when running `wrangler dev` with custom routes configured

---

## [1.1.0] - 2025-12-10

### Documentation

- **Added** [Migration Guide](Migration-Guide) to wiki - Comprehensive documentation for the automated in-app migration system covering all 6 schema migrations

### Security

- **CVE-2025-62408** - Fixed c-ares vulnerability in Docker image by explicitly upgrading from 1.34.5-r0 to 1.34.6-r0
- Added Cloudflare Dashboard icon-link to the main header for quick access to Durable Objects panel.
- **Search Optimization** - Significant performance improvements for all search features
  - **Frontend Caching**: Implemented 5-minute cache TTL for search results using `searchApi` caching layer
  - **Bypassing Cache**: API functions now support `skipCache` param; UI uses cache on mount but bypasses on manual refresh
  - **Backend Parallelization**: Replaced sequential instance querying with batched parallel execution (max 5 items concurrently) for Key and Value searches
  - **Upfront Indexing**: Backend now builds namespace-to-instance index upfront to reduce D1 query volume
  - **Structured Error Logging**: Refactored search backend to use centralized `error-logger` with consistent formatting and metadata
  - Improves response times for global searches across multiple namespaces
- **Build Optimization**: Reduced main bundle size by 48% (702 KB → 364 KB)
  - Added `sql-tools` chunk for sql-formatter and prismjs (270 KB on-demand)
  - Added `fflate` chunk for ZIP library (9 KB on-demand)
  - Lazy-loaded SqlConsole component (60 KB, loads only when accessing SQLite tab)
  - Main bundle now well under Vite's 500 KB warning threshold
- **Namespace Color Tags** - Color tags for visual organization of namespaces
  - Grid view: Colored left border + color picker button below namespace title
  - List view: Color column with palette picker
  - Same 9 color palette as instances (red, orange, yellow, green, teal, blue, purple, pink, gray)
  - New database migration (`phase9.sql`) adds `color TEXT` column to namespaces table
  - New API endpoint: `PUT /api/namespaces/:id/color`
- **Expanded Color Picker** - Upgraded from 9 to 27 colors for both Instances and Namespaces
  - New 6-column grid layout matching d1-manager design
  - Colors organized by hue families (Reds & Pinks, Oranges & Yellows, Greens & Teals, Blues & Purples, Neutrals)
  - New colors include: light/dark variants, rose, amber, lime, emerald, cyan, sky, indigo, violet, fuchsia, slate, zinc
  - Fixed dropdown positioning for better behavior in scrollable containers
- **Instance Tags** - Tag instances for organization and searchability
  - Add freeform text tags to any instance (max 20 tags, 50 chars each)
  - Tags can be `key:value` style (e.g., `team:backend`, `env:production`)
  - New **Tag Search** tab in Global Search (works for ALL namespaces, no admin hooks required)
  - Tag filtering in Instance List search box (searches name, object ID, and tags)
  - Edit tags via new Tag button in Instance List view actions
  - New `TagEditor` component with keyboard navigation, paste support, and accessibility
  - New database migration (`phase10.sql`) adds `tags` column to instances table
  - New API endpoints: `PUT /api/instances/:id/tags`, `POST /api/search/tags`

### Added

- **Automated Database Migrations**: In-app database upgrade system with visual banner
  - Yellow upgrade banner appears when schema migrations are pending
  - One-click "Upgrade Now" button to apply all pending migrations
  - Automatic legacy installation detection for existing deployments
  - Green success banner after successful upgrade (auto-hides after 5 seconds)
  - Schema version tracking via `schema_version` table
  - Four migrations: initial_schema, webhooks, alarm_history, saved_queries_and_colors
  - New API endpoints: `GET /api/migrations/status`, `POST /api/migrations/apply`, `POST /api/migrations/mark-legacy`
  - Full WCAG accessibility compliance with ARIA labels and keyboard navigation
- **List/Grid View Toggle** - New List view for Namespaces and Instances with Grid/List toggle
  - Sortable table columns (Namespaces: Name, Added; Instances: Name, Size, Last Accessed)
  - Inline action buttons (Browse, Download, Clone, Settings/Rename, Delete)
  - Status badges for storage type, Admin Hook, alarms, storage quota
  - List mode is the default; user preference persisted to localStorage per view
- **Instance Count on Namespaces Page** - Display number of tracked instances per namespace
  - Grid view: Shows "Instances: X" row in each namespace card
  - List view: Sortable "Instances" column in the table
  - Efficient SQL query using LEFT JOIN with COUNT (leverages existing index)
- **SQL Console Enhancements** - Rich SQL editor features migrated from d1-manager
  - Prism.js syntax highlighting with line numbers
  - Real-time SQL validation with inline error indicators (squiggly underlines)
  - Hover documentation tooltips for SQL keywords and functions
  - Context-aware autocomplete popup (keywords, table names, column names)
  - Smart bracket pairing and indentation
  - Format button (using `sql-formatter` with SQLite dialect)
  - Copy button with clipboard feedback
  - Word wrap toggle in editor toolbar
  - Enable/disable SQL suggestions toggle (persisted to localStorage)
  - Allow destructive queries toggle (DROP, DELETE, TRUNCATE)
  - **Quick Queries** dropdown with grouped SQL templates (Information, Select Data, Modify Data, Table Management)
- **Deep Clone Namespace** - Clone entire namespace including all instances and their storage data
  - Toggle option in Clone Namespace dialog: "Configuration only" or "Deep Clone"
  - Deep Clone requires admin hooks to be enabled
  - **Two-phase atomic approach**: Phase 1 clones all storage, Phase 2 batch-inserts D1 records
  - Uses D1 batch operations for atomic instance record creation
  - Automatic rollback on failure (deletes partial data if cloning fails midway)
  - Progress info and warnings for any instances that fail to clone

- **Rename Instance** - Rename tracked instances via pencil icon in the instance list
- **Rename Key** - Edit storage key names directly in the Edit Key dialog (previously the key field was read-only)
- **Import Keys: JSON Paste Support** - Paste JSON directly into the Import Keys dialog as an alternative to file upload
- **Centralized Error Logging System** - Full integration of structured error logging across all worker modules
  - **Converted 89 ad-hoc console calls** to use centralized `error-logger.ts` utility
  - **Routes converted** (14 files): storage, namespaces, backup, instances, webhooks, alarms, queries, metrics, batch, health, search, jobs, diff, export
  - **Utilities converted** (4 files): auth, helpers, webhooks, index.ts
  - **Module-prefixed error codes**: `NS` (namespaces), `INST` (instances), `STG` (storage), `ALM` (alarms), `BKP` (backup), `BCH` (batch), `SRC` (search), `MTR` (metrics), `JOB` (jobs), `WHK` (webhooks), `AUTH` (auth), `HLT` (health), `QRY` (queries), `DIF` (diff), `EXP` (export)
  - **Severity levels**: error, warning, info
  - **Automatic webhook triggers** for critical errors and job failures
  - **Consistent log format**: `[LEVEL] [module] [CODE] message (context)`
  - **Stack trace capture** for debugging
  - **Context-rich metadata**: module, operation, namespaceId, instanceId, userId
  - **Zero console calls in routes** — all routing logic uses centralized logger
  - **Intentional exceptions** documented in webhooks.ts (circular dependency) and helpers.ts (no env access)

### Fixed

- **Alarm Job History** - `delete_alarm` now logs to Job History (previously only `set_alarm` was tracked)
- **Alarm Indicator Persistence** - Alarm indicator on Instances page now correctly clears after deleting an alarm (cache invalidation was missing)
- **Alarm Completion Detection** - `alarm_completed` now appears in Job History when alarms fire; alarm indicators update correctly when viewing Instances page (previously required visiting Health tab)

### Changed

- **Maximum TypeScript Strictness** - All strict type-checking options enabled
  - All `strict` family options explicitly enabled
  - `exactOptionalPropertyTypes: true`
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
  - `noPropertyAccessFromIndexSignature: true`
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
  - `allowUnusedLabels: false`
  - `allowUnreachableCode: false`
  - `noUncheckedSideEffectImports: true`
  - `useUnknownInCatchVariables: true`
  - `forceConsistentCasingInFileNames: true`
  - `verbatimModuleSyntax: true` (worker)
- **Maximum ESLint Strictness** - Using `strictTypeChecked` + `stylisticTypeChecked` rulesets
  - `@typescript-eslint/explicit-function-return-type` - Require explicit return types
  - `@typescript-eslint/strict-boolean-expressions` - Enforce strict boolean expressions
  - `@typescript-eslint/prefer-nullish-coalescing` - Enforce `??` over `||`
  - `@typescript-eslint/prefer-optional-chain` - Enforce `?.` syntax
  - `@typescript-eslint/consistent-type-imports` - Enforce `type` imports
  - `@typescript-eslint/consistent-type-exports` - Enforce `type` exports
  - `@typescript-eslint/no-unsafe-*` rules - All enabled for strict `any` handling
  - `@typescript-eslint/prefer-regexp-exec` - Prefer `RegExp.exec()` over `String.match()`
  - `@typescript-eslint/array-type` - Enforce `T[]` over `Array<T>`
- **Code Quality Improvements**
  - Fixed all `exactOptionalPropertyTypes` violations using conditional spreads
  - Separated non-component exports for React Fast Refresh compatibility
  - Created `lib/instanceColors.ts` and `lib/storageUtils.ts` utility modules
  - Converted all `String.match()` to `RegExp.exec()` for performance
  - Converted all `Array<T>` to `T[]` for consistency
  - Replaced all `||` with `??` for nullish coalescing
  - Converted all validation checks to optional chaining
  - Fixed index signature property access to use bracket notation
- **Build Optimization**: Reduced bundle size and improved initial page load
  - Replaced 2MB Vite placeholder favicon with inline SVG data URI (~300 bytes)
  - Implemented lazy loading for tab-based feature components with React.lazy and Suspense:
    - HealthDashboard, JobHistory, MetricsDashboard, GlobalSearch, WebhookManager now load on-demand
    - Added loading spinner fallback during chunk loading
  - Main bundle reduced from 398KB → 360KB (-10%)
  - ~42KB of feature code now loads only when respective tabs are accessed

---

### Performance Improvements

- **Frontend Caching Layer**
  - Implemented centralized in-memory caching with configurable TTLs (5min default, 2min for metrics/health)
  - Added smart validation with `skipCache` parameters for all API services
  - Implemented "stale-while-revalidate" pattern for instant page loads on return visits
  - Automatic cache invalidation for all mutation operations (create, update, delete)
- **Rate Limit Protection**
  - Added exponential backoff retry logic (2s -> 4s -> 8s) for 429/503/504 errors
  - Implemented resilient fetch wrapper for all API calls to handle network flakiness
  - Prevents UI crashes during transient API failures
- **Backend Optimization**
  - **Batch Query Execution**: Refactored `health.ts` to execute 8 independent D1 queries in parallel
  - **Instance List Optimization**: Batched count and list queries in `instances.ts`
  - Significantly reduced Health Dashboard load latency by ~60%

### Changed

- Refactored all 14 API service files to use shared `apiFetch` utility with built-in retry and caching support
- Standardized error handling across frontend data layer

## [1.0.0] - 2025-11-29

**Initial Public Release**

First stable release of DO Manager — a full-featured web application for managing Cloudflare Durable Objects with enterprise-grade authentication via Cloudflare Access (Zero Trust).

### Features

#### Namespace Management

- Auto-discover DO namespaces from Cloudflare API
- Manual configuration for custom setups
- Clone namespace configurations
- Download namespace settings as JSON
- System namespace filtering (kv-manager, d1-manager, do-manager)
- Real-time search & filter by name, class name, or script name
- Support for SQLite and KV storage backends

#### Instance Management

- Track DO instances by name or hex ID
- Create new instances with custom names
- Clone instances with full storage copy
- Download instance storage as JSON
- Real-time search & filter by instance name or object ID
- Color tags for visual organization (9 preset colors)
- Instance diff — compare storage between two instances

#### SQL Console (SQLite-backed DOs)

- Execute raw SQL queries against SQLite storage
- Query Builder with pre-built templates:
  - Select All Rows, Row Count, Table Schema
  - List All Tables, List Indexes, Sample Rows
  - Create Table boilerplate
- Saved queries per namespace
- Query history for quick access
- Sortable results table

#### Multi-Select & Batch Operations

- Always-visible checkboxes on lists
- Batch download (namespaces) — ZIP with manifest
- Batch download (instances) — ZIP with manifest
- Batch download (keys) — JSON with metadata
- Batch delete with confirmation
- Batch backup to R2 with progress tracking
- Compare exactly 2 instances side-by-side
- Floating selection toolbar with count and actions

#### Storage Management

- Key search & filter
- Multi-select keys for batch operations
- Batch export keys as JSON
- Batch delete keys
- Import keys from JSON files
- View/edit storage values with JSON support
- Clickable key rows for easy editing

#### Admin Hook System

- NPM package (`do-manager-admin-hooks`) for easy integration
- Copy-paste template option for custom setups
- Support for both SQLite and KV backends
- Full endpoint documentation

#### Alarms

- View current alarm state
- Set new alarms with date/time picker
- Delete existing alarms

#### R2 Backup & Restore

- Snapshot DO storage to R2
- Browse backup history
- Restore from any backup with auto-refresh

#### Metrics Dashboard

- Request volume over time
- Storage usage visualization
- CPU time metrics (average and total)

#### Global Search

- Cross-namespace key search
- Value search within JSON
- Namespace filtering
- Result grouping by namespace
- Match highlighting
- Value previews
- Job tracking integration

#### Job History

- Comprehensive operation tracking:
  - Namespace operations (create, delete, clone, download)
  - Instance operations (create, delete, clone, download)
  - Storage key operations (CRUD, batch delete, batch export, import)
  - Alarm management (set, delete)
  - Backup/restore operations
  - Search operations (key search, value search)
- View status, progress, and timing
- Error details for failed operations
- Filter by status or namespace

#### Webhook Notifications

- Event-driven webhooks for key events:
  - `backup_complete`, `restore_complete`
  - `alarm_set`, `alarm_deleted`
  - `job_failed`, `batch_complete`
- Optional HMAC signature verification
- Test webhook endpoint connectivity

#### Health Dashboard

- System overview (namespaces, instances, alarms)
- Stale instance detection (7+ days inactive)
- Storage quota alerts (80% warning, 90% critical of 10GB limit)
- Active alarms with countdown timers
- Aggregate storage usage summary
- Recent activity timeline (24h/7d)

#### User Experience

- Dark/Light/System theme modes
- Responsive design
- Enterprise auth via Cloudflare Access
- Accessible UI with proper ARIA attributes

### Tech Stack

| Layer        | Technologies                                                               |
| ------------ | -------------------------------------------------------------------------- |
| **Frontend** | React 19.2.0, TypeScript 5.9.3, Vite 7.2.4, Tailwind CSS 4.1.17, shadcn/ui |
| **Backend**  | Cloudflare Workers, D1, R2, Zero Trust                                     |

### Deployment Options

- **Cloudflare Workers** — Native deployment
- **Docker** — Self-hosted container (`writenotenow/do-manager`)

---

## Links

- [GitHub Repository](https://github.com/neverinfamous/do-manager)
- [Live Demo](https://do.adamic.tech/)
- [Docker Hub](https://hub.docker.com/r/writenotenow/do-manager)
- [Admin Hooks NPM Package](https://www.npmjs.com/package/do-manager-admin-hooks)
