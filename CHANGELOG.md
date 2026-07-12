# Changelog

## 1.2.0

### Minor Changes

- [#13](https://github.com/Deadlock-too/howlongtobeat-ts/pull/13) [`3b72e10`](https://github.com/Deadlock-too/howlongtobeat-ts/commit/3b72e103bb233251c22beb3e818c4f96d3473c31) Thanks [@Deadlock-too](https://github.com/Deadlock-too)! - Type-safety, resilience and tooling overhaul:

  - `search()` now returns a discriminated-union result; the constructor and `search()` accept options objects; `HowLongToBeatEntry.json` became the typed `raw` field.
  - Added `searchOne()` and `getById()`, configurable timeouts/retries/`429` handling, an injectable `fetch`, `AbortSignal` support, an injectable `Logger` (silent by default) and improved search matching.
  - Added ESLint + Prettier, separated unit/integration tests, coverage thresholds, an `exports` map, `engines`, `sideEffects`, CI on push/PR, dist smoke tests and Changesets-based releases.

All notable changes to this project are documented in this file. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases
are managed with [Changesets](https://github.com/changesets/changesets); each
version entry below is generated from the changesets merged for that release.
