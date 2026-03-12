---
description: "Automated batched dependency maintenance — npm, Docker transitive deps, Alpine packages, and validation"
private: true
labels: [dependencies, automation, maintenance]

on:
  schedule:
    - cron: "0 14 * * 1" # Every Monday at 9am EST (14:00 UTC)
  workflow_dispatch: # Manual trigger on-demand

engine:
  id: copilot
  model: claude-opus-4-20250514

runtimes:
  node:
    version: "24"

network:
  allowed:
    - defaults
    - node

permissions: read-all

safe-outputs:
  create-pull-request:
    title-prefix: "[deps] "
    labels: [dependencies, automated]
    reviewers: [neverinfamous]
    draft: false
    max: 1
    expires: 14
    fallback-as-issue: true
    if-no-changes: "ignore"

timeout-minutes: 30
concurrency: dependency-maintenance
---

# Dependency Maintenance Agent

You are maintaining the **do-manager** project — a Cloudflare Workers application with a React frontend, built with Node.js 24. Your job is to batch-update all dependencies across npm, Docker, and system layers, run validation, and create a single PR with all changes.

## Important Rules

- **Only act on actual command output.** Never guess package versions.
- **If nothing is outdated and no Dockerfile patches are needed, exit cleanly.** Do not create a PR with no changes.
- **Dockerfile `npm pack` patches must stay within the same major version line** as npm's bundled dependencies (e.g., glob@11.x, tar@7.x, minimatch@10.x).
- **Keep `package.json` overrides in sync with Dockerfile `npm pack` versions** — use **exact version pins** (e.g., `"10.2.4"` not `"^10.2.4"`) to prevent lockfile drift.

## Step 1: Check for Outdated Packages

Run `npm outdated --json` to see what's available. If nothing is outdated, note this and proceed to check Dockerfile patches (Step 3). Do not stop here — Dockerfile transitive deps may still need attention.

## Step 2: Update npm Packages

1. Run `npm update` to update packages within their semver ranges.
2. For packages where `wanted` equals `current` but `latest` is newer (beyond the caret range), install them explicitly: `npm install <package>@latest` for each.
3. **`0.x` caret-range edge case**: `npm update` respects semver but **will not cross minor boundaries for `0.x` packages** (e.g., `^0.575.0` won't resolve `0.577.0` because caret on `0.x` only allows patch bumps). Update the version range in `package.json` and run `npm install`.
4. **Skip intentionally pinned packages** where "Latest" on npm is actually a downgrade or incompatible. Common cases:
   - Pre-release/canary pins (e.g., `eslint-plugin-react-hooks` canary for ESLint 10 peer dependency support)
   - Exact-version pins where `Current` equals `Wanted` but differs from `Latest`
5. Run `npm audit`. If vulnerabilities are found, run `npm audit fix`. If unfixable via audit, check if `overrides` in `package.json` can pin transitive deps to patched versions.

After excluding intentional pins, `npm outdated` should show only expected pins (or nothing).

## Step 3: Audit Dockerfile Transitive Dependencies

> **This is the critical step that prevents Docker Scout blocks at deploy time.**

Parse the project's `Dockerfile` for all `npm pack <package>@<version>` lines. These are manually patched npm-bundled packages (the P111 lifecycle pattern). For each package found:

1. Determine the major version line being used (e.g., `tar@7.5.8` → major line 7).
2. Check the latest version in that major line: `npm view <package>@<major> version` (e.g., `npm view tar@7 version`).
3. If a newer patch/minor version exists in the same major line, update **all of**:
   - The `npm pack <package>@<new_version>` lines in **both** Dockerfile stages (builder + runtime)
   - The corresponding `overrides` entry in `package.json` (use exact version pins)
   - The `# Security Notes:` comment block in the Dockerfile
4. After updating overrides, run `npm install --package-lock-only` to sync the lockfile.

**Security Notes block**: These comments must accurately reflect what ships in the runtime image. Distinguish between:
- **npm CLI bundled dependencies** — packages patched via P111. List exact versions.
- **Application runtime dependencies** — refer to `package-lock.json` rather than listing inline.
- **Precautionary overrides** — if an override targets a devDependency-only package, do not list it as a runtime dependency.

Common packages to check: `glob`, `tar`, `minimatch`, `brace-expansion`.

## Step 4: Check Alpine System Packages

If the Dockerfile uses `--repository=https://dl-cdn.alpinelinux.org/alpine/edge/main` for specific packages (e.g., `curl`, `libexpat`, `zlib`), verify these are still the latest by checking Alpine edge package versions. No action needed unless a new CVE is published for an already-pinned package.

## Step 5: Validate

Run all validation gates. **All must pass before proceeding:**

```bash
npm run lint
npm run typecheck
npx prettier --write .
```

If lint or typecheck fails, attempt to fix the issues. If unfixable, report the errors in the PR description and create the PR anyway (as draft) so the maintainer can review.

## Step 6: npm Audit Report

Run `npm audit` one final time and capture the output. Include the result (clean or vulnerability count) in the PR description. If vulnerabilities remain, document which packages are affected and whether they are fixable.

## Step 7: Update Documentation

1. Add dependency updates to the `## [Unreleased]` section of `CHANGELOG.md`:
   - Under `### Security` for CVE/advisory fixes
   - Under `### Changed` → `**Dependency Updates**` for routine version bumps
   - **Do NOT create duplicate section headers** — check if `### Security` or `### Changed` already exist under `[Unreleased]` first.
2. Update the "Last Updated" date in `README.md` and `DOCKER_README.md` to today's date in the format `Month Day, Year` (e.g., `March 10, 2026`).

## Step 8: Commit and Create PR

1. Stage all changes: `git add -A`
2. Commit with message: `chore: update dependencies and security patches`
3. Create the PR via safe-output with a description that includes:
   - A **summary table** of all version changes (package | from | to)
   - Which Dockerfile patches were updated (if any)
   - Alpine package status
   - `npm audit` results (clean or remaining vulnerabilities)
   - Validation results (lint, typecheck, prettier)
   - CHANGELOG entries added
