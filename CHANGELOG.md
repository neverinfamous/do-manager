# Changelog

All notable changes to this project are documented in this file.
This changelog is auto-generated from Git history using [lib-git-history](https://github.com/neverinfamous/adamic).

## [Unreleased]

### Fixed

- patch npm bundled undici and ip-address to resolve Scout CVEs by **Chris** ([9285d24](https://github.com/neverinfamous/do-manager/commit/9285d24f1bb47cec4318933e58f5a8d47d0700df))

## [v1.3.9-hotfix.1]

### Changed

- ---
product: "DO Manager"
version: "1.3.9"
date: "2026-08-17"
slug: "do-manager-v1-3-9"
docker_image: "writenotenow/do-manager"
github_repo: "neverinfamous/do-manager"
description: "DO Manager v1.3.9 resolves UI crashes in the SQL Console, hardens build tooling with pnpm, and updates core dependencies."
---

# DO Manager v1.3.9

## Highlights

- **SQL Console Stability**: Resolved a recurring UI crash caused by bundle misordering. The SQL extension is now dynamically loaded, guaranteeing a stable editor environment.
- **Build Infrastructure Hardening**: Standardized build pipelines on `pnpm` and updated GitHub Actions to eliminate Node 20 deprecation warnings and ensure supply-chain integrity.

## Changed

- **build**: Standardized internal scripts to use `pnpm` instead of `npm`, preventing `.npmrc` configuration warnings.
- **build**: Replaced deprecated `__dirname` usage with `import.meta.dirname` in the Vite configuration.
- **deps**: Removed obsolete `pnpm` config blocks and updated all core dependencies and security patches.
- **actions**: Upgraded GitHub Actions workflows to v4 to resolve Node 20 deprecations and fix lockfile validation checks.

## Fixed

- **ui**: Fixed a `ReferenceError` crash in the SQL Console by dynamically importing `prism-sql` after the global Prism instance is fully initialized.
- **ui**: Implemented robust type assertions for global dependencies to satisfy strict TypeScript and ESLint standards.

## Install

```bash
docker pull writenotenow/do-manager:v1.3.9
```

[Full Changelog](https://github.com/neverinfamous/do-manager/compare/v1.3.8...v1.3.9) by **Chris LeRoux** ([7974a18](https://github.com/neverinfamous/do-manager/commit/7974a18ac53fced49a4d99fcf95d651a9c651060))
- ---
product: "DO Manager"
version: "1.3.9"
date: "2026-08-17"
slug: "do-manager-v1-3-9"
docker_image: "writenotenow/do-manager"
github_repo: "neverinfamous/do-manager"
description: "DO Manager v1.3.9 resolves UI crashes in the SQL Console, hardens build tooling with pnpm, and updates core dependencies."
---

# DO Manager v1.3.9

## Highlights

- **SQL Console Stability**: Resolved a recurring UI crash caused by bundle misordering. The SQL extension is now dynamically loaded, guaranteeing a stable editor environment.
- **Build Infrastructure Hardening**: Standardized build pipelines on `pnpm` and updated GitHub Actions to eliminate Node 20 deprecation warnings and ensure supply-chain integrity.

## Changed

- **build**: Standardized internal scripts to use `pnpm` instead of `npm`, preventing `.npmrc` configuration warnings.
- **build**: Replaced deprecated `__dirname` usage with `import.meta.dirname` in the Vite configuration.
- **deps**: Removed obsolete `pnpm` config blocks and updated all core dependencies and security patches.
- **actions**: Upgraded GitHub Actions workflows to v4 to resolve Node 20 deprecations and fix lockfile validation checks.

## Fixed

- **ui**: Fixed a `ReferenceError` crash in the SQL Console by dynamically importing `prism-sql` after the global Prism instance is fully initialized.
- **ui**: Implemented robust type assertions for global dependencies to satisfy strict TypeScript and ESLint standards.

## Install

```bash
docker pull writenotenow/do-manager:v1.3.9
```

[Full Changelog](https://github.com/neverinfamous/do-manager/compare/v1.3.8...v1.3.9) by **Chris** ([e3152e3](https://github.com/neverinfamous/do-manager/commit/e3152e3d412d01289552c8ad0452efe0d32ad0ef))

### Fixed

- add packages array to pnpm-workspace to fix pnpm install in cloudflare (#118) by **Chris LeRoux** ([9277d36](https://github.com/neverinfamous/do-manager/commit/9277d361f748474f320cab04650b0ac103ef0977))
- add packages array to pnpm-workspace to fix pnpm install in cloudflare by **Chris** ([17435d5](https://github.com/neverinfamous/do-manager/commit/17435d5006b2960f69660d358c2adab1ce359c7a))
- use dynamic imports for prism-sql to prevent Rollup from misordering execution and causing ReferenceError by **Chris** ([78f38f6](https://github.com/neverinfamous/do-manager/commit/78f38f6d9106d48a6637b76dfabe8a776e3e3ca3))
- resolve ReferenceError Prism is not defined in SqlEditor by **Chris** ([6930509](https://github.com/neverinfamous/do-manager/commit/6930509027788909092d07399fc9605597df24c5))

## [v1.3.8]

### Changed

- ---
product: "DO Manager"
version: "1.3.8"
date: "2026-07-11"
slug: "do-manager-v1-3-8"
npm_package: "do-manager"
docker_image: "writenotenow/do-manager"
github_repo: "neverinfamous/do-manager"
description: "Security enforcement, automated changelog generation, and dependency updates for DO Manager."
---

# DO Manager v1.3.8

## Highlights

- **Strict Security Gates**: The CI pipeline now enforces hard-fails on security checks, ensuring higher code integrity and peace of mind before deployments.
- **Automated Changelogs**: `CHANGELOG.md` generation is now fully automated from the Git history, keeping project history precise and up to date without manual overhead.

## Changed

- **deps**: Bumped `@cloudflare/workers-types` and `@types/node` to their latest major versions to stay current with upstream ecosystem improvements.
- **deps**: Updated project dependencies and patched security vulnerabilities, improving overall stability.
- **core**: Standardized VS Code settings and `pnpm` build approvals to unify the developer experience.
- **core**: Cleaned up the project by removing the deprecated `pnpm` field from `package.json` and updating `.gitignore`.

## Security

- **ci**: Enforced hard-fails on security gates, preventing vulnerable code from passing CI.

## Install

```bash
docker pull writenotenow/do-manager:v1.3.8
```

[Full Changelog](https://github.com/neverinfamous/do-manager/compare/v1.3.7...v1.3.8) by **Chris** ([a27cb0d](https://github.com/neverinfamous/do-manager/commit/a27cb0d7a40af43f99594e0d2f348d76136f4d4b))

### Fixed

- migrate Dockerfile to use pnpm for dependency installation by **Chris** ([19ebc45](https://github.com/neverinfamous/do-manager/commit/19ebc45a93726a8b525099de55c77fd2662f3810))
- remove invalid pnpm-workspace.yaml causing setup-node cache failures by **Chris** ([7ef2136](https://github.com/neverinfamous/do-manager/commit/7ef2136cb2a6b306f85f8cba2b4ac7e6dee68342))
- update setup-node to v6.4.0 for Node 24 support and add GITHUB_TOKEN to gitleaks by **Chris** ([127941a](https://github.com/neverinfamous/do-manager/commit/127941a91141c20a88142f7696008e473f7e801e))
- update actions/setup-node to support Node 24 and fix trufflehog base SHA by **Chris** ([db2f561](https://github.com/neverinfamous/do-manager/commit/db2f5619f48ddde2334e009b294c20e6cc5aeaae))

## [v1.3.4]

### Features

- add docs-drift-detector and ci-health-monitor agentic workflows (#71) by **Chris LeRoux** (with Chris & Mike) ([30515e8](https://github.com/neverinfamous/do-manager/commit/30515e87e5218960f8ed0f72bcefaeeb8bb9334f))
- add docs-drift-detector and ci-health-monitor agentic workflows by **Chris & Mike** ([98ad6a4](https://github.com/neverinfamous/do-manager/commit/98ad6a4334e18fce11e7247b76aa08df6375a880))
- full automated dependency + version bump + deploy pipeline (#70) by **Chris LeRoux** (with Chris & Mike) ([b90ed47](https://github.com/neverinfamous/do-manager/commit/b90ed475d784f450a42ab7f8122183cb8d9da028))
- full automated dependency + version bump + deploy pipeline by **Chris & Mike** ([8f60fbf](https://github.com/neverinfamous/do-manager/commit/8f60fbf4cae182fef28c662ec7247b2a43b3fc8b))

### Bug Fixes

- address Copilot review - trigger types, scope, dedup, prompt wording by **Chris & Mike** ([94f9241](https://github.com/neverinfamous/do-manager/commit/94f92418d41afa3626e5844b89cc50a29802fde0))
- address Copilot review feedback - contains condition, glob@13.x example by **Chris & Mike** ([5ec84ff](https://github.com/neverinfamous/do-manager/commit/5ec84ff3eeeeeff51b3a41b4460ac93860e7ddee))
- force Node.js 24 for gitleaks-action to suppress deprecation warning by **Chris & Mike** ([fb106b1](https://github.com/neverinfamous/do-manager/commit/fb106b10e18447e60cadd0c10290944a87ce9084))
- address Copilot review feedback on v1.3.3 (#65) by **Chris LeRoux** (with Chris & Mike) ([3eb161c](https://github.com/neverinfamous/do-manager/commit/3eb161c53eeab000319571096de0376cc42f6308))
- clarify Dockerfile security notes per Copilot review by **Chris & Mike** ([b1552d5](https://github.com/neverinfamous/do-manager/commit/b1552d5efca4491c8dd531ea86e04d1364434f29))
- address Copilot review feedback on v1.3.3 PR by **Chris & Mike** ([1aad596](https://github.com/neverinfamous/do-manager/commit/1aad596a320f8b9e553d12e903c89f00d212905c))

## [v1.3.3]

### Features

- add agentic dependency maintenance workflow with Copilot engine (Opus 4) by **Chris & Mike** ([55c67a2](https://github.com/neverinfamous/do-manager/commit/55c67a2292beffe63d1a9046ccd2d47b1ef2d5f8))

### Bug Fixes

- prevent duplicate Docker builds, fix tag conditions, and pin minimatch override by **Chris & Mike** ([cd29cb6](https://github.com/neverinfamous/do-manager/commit/cd29cb68e3b3f8adce8ea4af592df5b4f0c88444))
- align minimatch override to ^10.2.4 for P111 sync accuracy by **Chris & Mike** ([541ff7d](https://github.com/neverinfamous/do-manager/commit/541ff7dfa76f9aab54d380826996c2bacf0caff1))

## [v1.1.0]

### Bug Fixes

- add wrangler.jsonc for Cloudflare Workers Git integration by **Temp** ([8990142](https://github.com/neverinfamous/do-manager/commit/8990142b3ab92c14dfc4d1fd2dbb8419c91c6ff3))
- update workflow to use main branch and new short description by **Temp** ([7a488d5](https://github.com/neverinfamous/do-manager/commit/7a488d5288e76e1902baafde23606de31d77c3e8))

## [v1.0.0]

### Features

- add Docker deployment infrastructure by **Temp** ([529ddc3](https://github.com/neverinfamous/do-manager/commit/529ddc3d3e7ca180037a16c2a356d2d49dd4ffa6))
