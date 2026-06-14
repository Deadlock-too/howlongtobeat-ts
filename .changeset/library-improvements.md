---
'howlongtobeat-ts': major
---

Type-safety, resilience and tooling overhaul:

- `search()` now returns a discriminated-union result; the constructor and `search()` accept options objects; `HowLongToBeatEntry.json` became the typed `raw` field.
- Added `searchOne()` and `getById()`, configurable timeouts/retries/`429` handling, an injectable `fetch`, `AbortSignal` support, an injectable `Logger` (silent by default) and improved search matching.
- Added ESLint + Prettier, separated unit/integration tests, coverage thresholds, an `exports` map, `engines`, `sideEffects`, CI on push/PR, dist smoke tests and Changesets-based releases.
