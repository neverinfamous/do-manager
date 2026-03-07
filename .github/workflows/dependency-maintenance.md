---
description: "Automated batched dependency maintenance — npm, Docker transitive deps, and validation"
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
- **Keep `package.json` overrides in sync with Dockerfile `npm pack` versions** (the P111 lifecycle sync pattern).

## Step 1: Check for Outdated Packages

Run `npm outdated --json` to see what's available. If nothing is outdated, note this and proceed to check Dockerfile patches (Step 3). Do not stop here — Dockerfile transitive deps may still need attention.

## Step 2: Update npm Packages

1. Run `npm update` to update packages within their semver ranges.
2. For packages where `wanted` equals `current` but `latest` is newer (beyond the caret range), install them explicitly: `npm install <package>@latest` for each.
3. Run `npm audit`. If vulnerabilities are found, run `npm audit fix`. If unfixable, check if `overrides` in `package.json` can pin transitive deps to patched versions.

## Step 3: Audit Dockerfile Transitive Dependencies

Parse the project's `Dockerfile` for all `npm pack <package>@<version>` lines. These are manually patched npm-bundled packages. For each package found:

1. Determine the major version line being used (e.g., `tar@7.5.8` → major line 7).
2. Check the latest version in that major line: `npm view <package>@<major> version` (e.g., `npm view tar@7 version`).
3. If a newer patch/minor version exists in the same major line, update **both**:
   - The `npm pack <package>@<new_version>` lines in **both** Dockerfile stages (builder + runtime)
   - The corresponding `overrides` entry in `package.json`
   - The security notes comment block in the Dockerfile
4. After updating overrides, run `npm install --package-lock-only` to sync the lockfile.

Common packages to check: `glob`, `tar`, `minimatch`.

## Step 4: Validate

Run all validation gates. **All must pass before proceeding:**

```bash
npm run lint
npm run typecheck
npx prettier --write .
```

If lint or typecheck fails, attempt to fix the issues. If unfixable, report the errors in the PR description and create the PR anyway (as draft) so the maintainer can review.

## Step 5: Update Dates

Update the "Last Updated" date in `README.md` and `DOCKER_README.md` to today's date in the format `Month Day, Year` (e.g., `March 10, 2026`).

**Do NOT modify `CHANGELOG.md`** — the changelog is maintained in the wiki and will be updated separately.

## Step 6: Commit and Create PR

1. Stage all changes: `git add -A`
2. Commit with message: `chore: update dependencies and security patches`
3. Create the PR via safe-output with a description that includes:
   - A **summary table** of all version changes (package | from | to)
   - Which Dockerfile patches were updated (if any)
   - Whether `npm audit` found and fixed any vulnerabilities
   - Validation results (lint, typecheck, prettier)
