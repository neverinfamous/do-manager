## [Unreleased]

### Added
- P111: Implemented npm CLI dependency patching (`tar`, `minimatch`) in Docker builder and runtime stages.
- Added `queueMicrotask` batching for asynchronous data fetching within `useEffect` bodies across 16 feature components to resolve `react-hooks/set-state-in-effect` anti-patterns.
- Added component-level `now` state synchronization to `AlarmManager`, `JobHistory`, and `HealthDashboard` to ensure strict render purity (resolving `Date.now()` impurity lint errors).

### Fixed
- Fixed `react-hooks/preserve-manual-memoization` warning in `StorageViewer.tsx` by correcting dependency assertions.
- Fixed unused variable warnings in namespace and list components.

### Security
- Pinned `tar` to `7.5.13` and `minimatch` to `10.2.5` via `overrides` in `package.json` to resolve downstream vulnerabilities.
