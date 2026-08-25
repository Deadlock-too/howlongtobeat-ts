# Changelog

## 1.3.1

### Patch Changes

- [#21](https://github.com/Deadlock-too/howlongtobeat-ts/pull/21) [`693f741`](https://github.com/Deadlock-too/howlongtobeat-ts/commit/693f741dbdb542856b6a0816f54618424575d043) Thanks [@Deadlock-too](https://github.com/Deadlock-too)! - Point the search and init requests at HowLongToBeat's current endpoints

  HowLongToBeat moved its API again: `api/bleed` and `api/bleed/init` no longer serve
  the search and init payloads, so every `search` and `searchOne` call failed against
  the live site. They now use `api/search/site` and `api/search/site/init`.

  No public API changes — `HowLongToBeatService.SEARCH_URL` and `INIT_URL` are still
  the override points if the endpoints move again.

  The unit suite's fetch doubles now derive their route matchers from those two
  constants instead of hardcoding a path fragment, so the next move only has to be
  made in one place.

## 1.3.0

### Minor Changes

- [#19](https://github.com/Deadlock-too/howlongtobeat-ts/pull/19) [`0810dfb`](https://github.com/Deadlock-too/howlongtobeat-ts/commit/0810dfba5d656ef7a8ad722c6113fa7037ad5e29) Thanks [@Deadlock-too](https://github.com/Deadlock-too)! - Report what kind of failure occurred, and stop naming the wrong subsystem

  Failures now carry a machine-readable `kind` (and, for HTTP failures, the `status`) so a consumer can tell a HowLongToBeat outage from a change that broke this library — without matching on message wording that is free to change in a patch release.

  ```ts
  const result = await hltb.search('The Last of Us')
  if (!result.success) {
    result.kind // 'input' | 'transport' | 'timeout' | 'aborted' | 'http' | 'parse' | 'unknown'
    result.status // set when kind is 'http' — 403 blocked, 429 rate-limited, …
    result.error // unchanged: prose, always present
  }
  ```

  Three defects made this necessary, and each is fixed:

  - **A transport failure reported itself as a parse failure.** `search` wrapped the request and the parse in one `try` whose catch fell back to "Failed to parse search results". Since everything the library throws is a `ScraperError`, that fallback was reached _only_ by errors from the HTTP layer — a dead socket, an elapsed deadline, a caller's abort — so the one message that could never describe a parse failure was the only one that claimed to. `getById` had the same shape with "Failed to fetch the game page". Fetching and parsing are now caught separately and each reports what it actually is.
  - **A 403 lost its reason entirely.** `getAuthInfo` returned `null` on any non-2xx with no status and no logging, so HowLongToBeat blocking the caller's IP range, DNS failing, and the init endpoint changing shape all collapsed into the single string "Failed to obtain search results". It now throws, and the reason survives to the caller — a 403 arrives as `{ kind: 'http', status: 403 }`. This is the request most likely to be the one a caller actually hits.
  - **Messages named the wrong subsystem.** The remaining generated messages now name what failed, so a bug report quoting only `error` points at the right repo.

  Failure messages that were already accurate are unchanged (`Search key is empty`, `A valid game id is required`, `Search request failed with status …`, `Game page request failed with status …`, and every message from the parser). The ones that changed are exactly those that were describing the wrong thing:

  | Was                               | Now                                                                                       |
  | --------------------------------- | ----------------------------------------------------------------------------------------- |
  | `Failed to obtain search results` | `Init request failed with status 403` / a parse message, per cause                        |
  | `Failed to parse search results`  | `Could not reach HowLongToBeat (network error)`, `The HowLongToBeat request timed out`, … |
  | `Failed to fetch the game page`   | the same, classified by cause                                                             |

  Also re-exports `FailureKind` and `HttpError` from the toolkit. `HttpError` extends `ScraperError`, so any existing `instanceof ScraperError` check keeps matching.

  Minor rather than patch: `kind` and `status` are new public API on a returned type, and requires `@deadlock-too/scrape-kit@^1.1.0` (a minor of its own). Existing consumers keep compiling — nothing was removed or renamed, and `error` keeps its meaning, its type and its position. Consumers who were regex-matching the three messages in the table above will need to move to `kind`, which is the point of the change.

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
