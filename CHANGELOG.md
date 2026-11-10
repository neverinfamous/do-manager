# Changelog

All notable changes to this project are documented in this file.
This changelog is auto-generated from Git history using [lib-git-history](https://github.com/neverinfamous/adamic).

## [Unreleased]

### Security

- harden origin validation, CSRF protection, and prevent local dev auth bypass by **Chris** ([7c03b07](https://github.com/neverinfamous/do-manager/commit/7c03b07e19e4a6c4b15bc7bc6072dd4c03e173ba))

## [v1.3.10]

### Code Quality

- --- product: "DO Manager" version: "1.3.10" date: "2026-10-30" slug: "do-manager-v1-3-10" docker_image: "writenotenow/do-manager" github_repo: "neverinfamous/do-manager" description: "DO Manager v1.3.10 refreshes dependencies, pins CI actions to commit SHAs, and clears all Docker image vulnerabilities." --- # DO Manager v1.3.10 ## Highlights; **Clean Docker Image**: The runtime image now scans with zero known vulnerabilities. Bundled `undici` and `ip-address` are patched.; **Current Dependencies**: React 19.3, Vite 8.3, and Wrangler 4.155 are in. All open Dependabot alerts are resolved.; **Safer CI Pipeline**: GitHub Actions are pinned to commit SHAs, so workflow runs stay reproducible. ## Changed; **deps**: Updated 26 packages, including React, Radix UI, Vite, ESLint, Zod, and Wrangler.; **docker**: Moved the image build to `pnpm` 11 and copied `pnpm-workspace.yaml` into it. Builds now match the lockfile.; **ci**: Pinned `checkout`, `pnpm/action-setup`, and `codeql-action` to commit SHAs. Refreshed Docker and gitleaks action pins.; **build**: Allowed `esbuild` and `workerd` install scripts in `pnpm-workspace.yaml` for pnpm 11. ## Security; **docker**: Patched npm's bundled `undici` (6.29.1) and `ip-address` (10.7.4). This clears three high and three medium findings.; **docker**: Updated the pinned `picomatch` to 4.0.7.; **deps**: Updated `vite`, `undici`, `source-map-js`, and `sharp` past all open Dependabot advisories. ## Install ```bash docker pull writenotenow/do-manager:v1.3.10 ``` [Full Changelog](https://github.com/neverinfamous/do-manager/compare/v1.3.9-hotfix.2...v1.3.10) by **Chris LeRoux** ([f99e5c0](https://github.com/neverinfamous/do-manager/commit/f99e5c0b8d79a8244b6c189d26a9c534b14e6741))

## [v1.3.9-hotfix.1]

### Bug Fixes

- add packages array to pnpm-workspace to fix pnpm install in cloudflare (#118) by **Chris LeRoux** ([9277d36](https://github.com/neverinfamous/do-manager/commit/9277d361f748474f320cab04650b0ac103ef0977))

## [v1.3.9]

### Code Quality

- --- product: "DO Manager" version: "1.3.9" date: "2026-08-17" slug: "do-manager-v1-3-9" docker_image: "writenotenow/do-manager" github_repo: "neverinfamous/do-manager" description: "DO Manager v1.3.9 resolves UI crashes in the SQL Console, hardens build tooling with pnpm, and updates core dependencies." --- # DO Manager v1.3.9 ## Highlights; **SQL Console Stability**: Resolved a recurring UI crash caused by bundle misordering. The SQL extension is now dynamically loaded, guaranteeing a stable editor environment.; **Build Infrastructure Hardening**: Standardized build pipelines on `pnpm` and updated GitHub Actions to eliminate Node 20 deprecation warnings and ensure supply-chain integrity. ## Changed; **build**: Standardized internal scripts to use `pnpm` instead of `npm`, preventing `.npmrc` configuration warnings.; **build**: Replaced deprecated `__dirname` usage with `import.meta.dirname` in the Vite configuration.; **deps**: Removed obsolete `pnpm` config blocks and updated all core dependencies and security patches.; **actions**: Upgraded GitHub Actions workflows to v4 to resolve Node 20 deprecations and fix lockfile validation checks. ## Fixed; **ui**: Fixed a `ReferenceError` crash in the SQL Console by dynamically importing `prism-sql` after the global Prism instance is fully initialized.; **ui**: Implemented robust type assertions for global dependencies to satisfy strict TypeScript and ESLint standards. ## Install ```bash docker pull writenotenow/do-manager:v1.3.9 ``` [Full Changelog](https://github.com/neverinfamous/do-manager/compare/v1.3.8...v1.3.9) by **Chris LeRoux** ([7974a18](https://github.com/neverinfamous/do-manager/commit/7974a18ac53fced49a4d99fcf95d651a9c651060))

## [v1.3.4]

### Features

- add docs-drift-detector and ci-health-monitor agentic workflows (#71) by **Chris LeRoux** (with Chris & Mike) ([30515e8](https://github.com/neverinfamous/do-manager/commit/30515e87e5218960f8ed0f72bcefaeeb8bb9334f))
- full automated dependency + version bump + deploy pipeline (#70) by **Chris LeRoux** (with Chris & Mike) ([b90ed47](https://github.com/neverinfamous/do-manager/commit/b90ed475d784f450a42ab7f8122183cb8d9da028))

### Bug Fixes

- address Copilot review feedback on v1.3.3 (#65) by **Chris LeRoux** (with Chris & Mike) ([3eb161c](https://github.com/neverinfamous/do-manager/commit/3eb161c53eeab000319571096de0376cc42f6308))

## [v1.3.3]

### Features

- add agentic dependency maintenance workflow with Copilot engine (Opus 4) by **Chris & Mike** ([55c67a2](https://github.com/neverinfamous/do-manager/commit/55c67a2292beffe63d1a9046ccd2d47b1ef2d5f8))

### Bug Fixes

- prevent duplicate Docker builds, fix tag conditions, and pin minimatch override by **Chris & Mike** ([cd29cb6](https://github.com/neverinfamous/do-manager/commit/cd29cb68e3b3f8adce8ea4af592df5b4f0c88444))

## [v1.1.0]

### Bug Fixes

- add wrangler.jsonc for Cloudflare Workers Git integration by **Temp** ([8990142](https://github.com/neverinfamous/do-manager/commit/8990142b3ab92c14dfc4d1fd2dbb8419c91c6ff3))
- update workflow to use main branch and new short description by **Temp** ([7a488d5](https://github.com/neverinfamous/do-manager/commit/7a488d5288e76e1902baafde23606de31d77c3e8))

## [v1.0.0]

### Features

- add Docker deployment infrastructure by **Temp** ([529ddc3](https://github.com/neverinfamous/do-manager/commit/529ddc3d3e7ca180037a16c2a356d2d49dd4ffa6))
