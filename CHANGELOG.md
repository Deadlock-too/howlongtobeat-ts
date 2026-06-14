# Changelog

All notable changes to this project are documented in this file. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Going
forward, releases are managed with [Changesets](https://github.com/changesets/changesets).

## 2.0.0

### Breaking changes

- `search()` now returns a discriminated union (`{ success: true, data } | { success: false, error }`).
  On failure there is no longer an empty `data` array — narrow on `success` first.
- The constructor now also accepts an options object: `new HowLongToBeatService({ minSimilarity, timeout, retries, fetch, logger, ... })`.
  Passing a bare `number` (the old `minSimilarity` argument) is still supported.
- `search()` takes its search modifier via an options object: `search(key, { modifier })` instead of a positional argument.
- `HowLongToBeatEntry.json` (a stringified blob) was replaced by `HowLongToBeatEntry.raw`, the typed `HowLongToBeatResultEntry`.
- The library no longer writes to `console`. Pass `consoleLogger` (or your own `Logger`) to observe diagnostics.

### Added

- `searchOne()` — returns the single best match (or `null`).
- `getById()` — fetches a game directly by its HowLongToBeat id (experimental).
- Configurable HTTP behaviour: per-request `timeout`, automatic `retries` with exponential backoff, `429 Retry-After` handling, an injectable `fetch`, and `AbortSignal` propagation.
- Improved search matching (`getMatchScore`) so short queries still match longer titles, with title normalisation (accents/punctuation).
- `toHours()` helper, and JSDoc clarifying that all time fields are expressed in seconds.
- Proper ESM/CJS `exports` map, `engines`, and `sideEffects: false` for better bundling.
