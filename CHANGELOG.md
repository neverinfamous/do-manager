# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/neverinfamous/do-manager/compare/v1.3.4...HEAD)

## [1.3.4](https://github.com/neverinfamous/do-manager/releases/tag/v1.3.4) - 2026-04-06

### CI/CD

- **CI Health:** Updated Docker actions to native Node 24 runtimes to comply with the upcoming June 2026 deprecation deadline.
- **CI Health:** Pinned `trufflesecurity/trufflehog` to robust `@v3` tag to avoid floating reference risks.
- **CI Health:** Added `docker` package ecosystem to Dependabot configuration.

### Documentation

- **Doc Audit:** Refined repository documentation, fixed Docker Hub character limits on DOCKER_README.md, and created .env.example.

### Changed

- **Dependency Updates:** Updated npm dependencies to their latest wanted/latest compatible versions.

### Security

- **Dependabot:** Fixed Prototype Pollution via parse() in NodeJS flatted (CVE-2024-XXXX)
- **Dependabot:** Fixed Malicious WebSocket 64-bit length overflows parser and crashes the client in Undici (CVE-2024-XXXX)
- **Dependabot:** Fixed HTTP Request/Response Smuggling issue in Undici (CVE-2024-XXXX)
- **Dependabot:** Fixed CRLF Injection in undici via upgrade option (CVE-2024-XXXX)
- **Dependabot:** Fixed Method Injection in POSIX Character Classes causes incorrect Glob Matching in picomatch (CVE-2024-XXXX)## [1.3.3] - 2026-03-07

### Changed

- Updated `glob` override and Dockerfile patch from `11.1.0` to `13.0.6`.
- **Documentation:** Migrated changelog from the wiki into the main project root.

## [1.3.2] - 2026-03-06

### Fixed

- **CI/CD:** Docker publish triggers now only run on tag pushes (`v*`), preventing duplicate builds.

### Security

- Pinned `minimatch` override exactly to `10.2.4` to prevent lockfile drift from Dockerfile patch version.

## [1.3.1] - 2026-03-06

### Added

- Automated GitHub Agentic Workflow for batched dependency maintenance.
- Added `.dockerignore` to optimize Docker build context transfer size.

### Changed

- Upgraded Node.js baseline to v24 LTS across Docker, GitHub Actions, and `package.json`.
- Upgraded ESLint to v10 and removed all `eslint-disable` comments to achieve 100% zero-suppression.
- Suppressed Dependabot npm PR thresholds and removed auto-merge workflow in favor of batched updates.
- Refactored frontend and backend for maximum ESLint/TypeScript strictness.
- Updated multiple dependencies including `@cloudflare/workers-types`, `tailwindcss`, `eslint`, and `wrangler`.

### Security

- Resolved `minimatch` ReDoS vulnerabilities (GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj) via overrides and Docker patching.
- Resolved `rollup` path traversal (GHSA-mw96-cpmx-2vgc) via update to `4.59.0`.
- Resolved `tar` path traversal (CVE-2026-26960) via override to `7.5.10`.

## [1.3.0] - 2026-01-08

### Added

- **Granular Webhook Events:** Added 7 new event types for fine-grained DO notifications (`storage_create`, `instance_delete`, etc.).
- **Enhanced Metrics Dashboard:** Complete rewrite using Cloudflare's GraphQL API for all 4 DO datasets with latency percentiles.

### Changed

- Updated multiple dependencies including `wrangler`, `vite`, `typescript-eslint`, and `@cloudflare/workers-types`.

## [1.2.0] - 2026-01-05

### Added

- **Instance Migration:** Migrate instances between namespaces with full data transfer, alarm synchronization, and copy/freeze/delete modes.
- Added freeze/unfreeze endpoints to `do-manager-admin-hooks` (returns 423 Locked on writes).

### Fixed

- Fixed authentication bypass detection when running `wrangler dev` with custom routes.

## [1.1.0] - 2025-12-10

### Added

- **Automated Database Migrations:** In-app schema upgrade system with legacy detection and UI flow.
- Added List/Grid view toggle with sortable columns and status badges.
- Added Deep Clone Namespace functionality utilizing atomic two-phase cloning.
- Added 27-color palette for namespaces and instance color tags.
- Added tag-based searching for global and namespace-level instance organization.
- Added centralized JSON pasting support to Import Keys dialog.
- Added fully-typed centralized Error Logging System unified across 18 routing modules.
- **Documentation:** Added Migration Guide to the wiki covering automated schema migrations.

### Changed

- **SQL Console:** Added syntax highlighting, real-time validation, tooltip documentation, and formatting via Prism and sql-formatter.
- **Performance:** Optimized backend search parallelization, dropping latencies by ~60%.
- **Performance:** Implemented frontend intelligent 5-minute caching with Stale-While-Revalidate pattern.
- **Performance:** Reduced main production bundle size by 48% (702 KB to 364 KB) via chunking and lazy-loading.
- Enabled absolute maximum TypeScript and ESLint `strictTypeChecked` strictness across all repositories.

### Fixed

- Fixed Alarm tracking bugs where `delete_alarm` and completions were not accurately recorded in the dashboard.

### Security

- Resolved `c-ares` vulnerability (CVE-2025-62408) by patching the Docker image.

## [1.0.0] - 2025-11-29

### Added

- Initial public release of DO Manager.
- Implemented Namespace and Instance tracking/discovery.
- Implemented KV & SQLite DO storage engines viewing and diffing.
- Implemented SQL Console for executing real-time data migrations and interactions.
- Implemented `do-manager-admin-hooks` npm package.
- Implemented multi-select Batch downloading, exporting, and backups.
- Included Job Tracking, Webhooks, Alarms visualization, and Enterprise Zero-Trust compliance.

[Unreleased]: https://github.com/neverinfamous/do-manager/compare/v1.3.4...HEAD
[1.3.4]: https://github.com/neverinfamous/do-manager/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/neverinfamous/do-manager/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/neverinfamous/do-manager/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/neverinfamous/do-manager/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/neverinfamous/do-manager/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/neverinfamous/do-manager/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/neverinfamous/do-manager/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/neverinfamous/do-manager/releases/tag/v1.0.0
