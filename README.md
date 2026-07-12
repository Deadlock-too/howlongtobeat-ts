# howlongtobeat-ts

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Deadlock-too/howlongtobeat-ts)
[![GitHub](https://img.shields.io/github/license/Deadlock-too/howlongtobeat-ts)](https://github.com/Deadlock-too/howlongtobeat-ts)
[![npm](https://img.shields.io/npm/v/howlongtobeat-ts)](https://www.npmjs.com/package/howlongtobeat-ts)
[![npm](https://img.shields.io/npm/dt/howlongtobeat-ts)](https://www.npmjs.com/package/howlongtobeat-ts)
[![CI](https://github.com/Deadlock-too/howlongtobeat-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Deadlock-too/howlongtobeat-ts/actions/workflows/ci.yml)

A TypeScript library for interacting with the HowLongToBeat website API. Easily search for games and retrieve estimates on how long it takes to complete them.

This project is heavily inspired by [howlongtobeat-js](https://github.com/toasttsunami/hltb-js/) by [toasttsunami](https://github.com/toasttsunami), but has been rewritten in TypeScript for improved type safety and maintainability.

As also noted by toasttsunami in his implementation, this library was created due to the inactivity of [ckatzorke's howlongtobeat](https://github.com/ckatzorke/howlongtobeat) project, which appears to be abandoned. Additionally, recent changes to the HowLongToBeat.com API have rendered it non-functional, making alternative solutions necessary.

> ⚠️ **Disclaimer:** This library is not an official API and is not affiliated nor endorsed with HowLongToBeat.com or Ziff Davis LLC
> in any way. Please use this library responsibly and do not abuse or overload the HowLongToBeat servers. Use at your own risk.

## Features

- Search for games on HowLongToBeat
- Retrieve completion time data for games
- Fetch a single best match (`searchOne`) or look a game up directly by id (`getById`)
- Resilient networking: configurable timeouts, retries with backoff, `429` handling, an injectable `fetch` and `AbortSignal` support
- Fully typed, with a discriminated-union result type and zero `console` noise

## Installation

```bash
npm install howlongtobeat-ts
```

Requires Node.js 18 or newer (the library uses the global `fetch`). Ships both ESM and CommonJS builds.

## Usage

```typescript
import { HowLongToBeatService, SearchModifier } from 'howlongtobeat-ts'

const hltb = new HowLongToBeatService()

const results = await hltb.search('The Last of Us')
if (results.success) {
  // `data` is only available on the success branch.
  console.log(results.data)
} else {
  // `error` is only available on the failure branch.
  console.error(results.error)
}

// Filter DLCs in/out via the options object.
await hltb.search('Zelda', { modifier: SearchModifier.HIDE_DLC })

// Just the single best match (or null).
const best = await hltb.searchOne('Hades')
if (best.success && best.data) {
  console.log(best.data.name)
}

// Look a game up directly by its HowLongToBeat id.
const elden = await hltb.getById(68151)
```

### Working with completion times

All `*Time` fields are expressed in **seconds**. Use the `toHours` helper to convert:

```typescript
import { toHours } from 'howlongtobeat-ts'

const result = await hltb.searchOne('Elden Ring')
if (result.success && result.data) {
  console.log(`Main story: ${toHours(result.data.mainTime)} hours`)
}
```

### Configuration

Pass an options object to the constructor (a bare `number` is still accepted as `minSimilarity` for backwards compatibility):

```typescript
import { HowLongToBeatService, consoleLogger } from 'howlongtobeat-ts'

const hltb = new HowLongToBeatService({
  minSimilarity: 0.5, // min similarity threshold (0–1), clamped
  timeout: 30_000, // per-request timeout in ms
  retries: 2, // retry attempts on transient failures / 429 / 5xx
  logger: consoleLogger, // opt in to diagnostic logging (default: silent)
  // fetch: myCustomFetch,  // inject a custom fetch (proxy, undici agent, …)
})

// Cancel an in-flight request.
const controller = new AbortController()
const promise = hltb.search('Halo', { signal: controller.signal })
controller.abort()
```

## API

### `HowLongToBeatService`

- `constructor(options?: number | ScraperOptions)` — `ScraperOptions` extends the HTTP options (`timeout`, `retries`, `retryDelay`, `fetch`, `userAgents`, `logger`) with `minSimilarity`.
- `search(searchKey, options?): Promise<SearchResult>` — `options` is `{ modifier?, signal? }`.
- `searchOne(searchKey, options?): Promise<EntryResult>` — the best match or `null`.
- `getById(id, options?): Promise<EntryResult>` — fetch by id (experimental; relies on the public game page).

### `SearchResult` / `EntryResult`

Discriminated unions:

```typescript
type SearchResult = { success: true; data: HowLongToBeatEntry[] } | { success: false; error: string }
type EntryResult = { success: true; data: HowLongToBeatEntry | null } | { success: false; error: string }
```

### `SearchModifier`

`NONE` (all results), `HIDE_DLC`, `ONLY_DLC`.

### `HowLongToBeatEntry`

`id`, `name`, `alias`, `type`, the `*Time` fields (in seconds) and matching `*Count` fields, `imageUrl`, `reviewScore`, `platforms`, `similarity`, `releaseYear`, and `raw` — the typed `HowLongToBeatResultEntry` exactly as returned by HowLongToBeat.

## Development

```bash
git clone https://github.com/Deadlock-too/howlongtobeat-ts.git
cd howlongtobeat-ts
npm install

npm run build            # build with tsup
npm test                 # unit tests
npm run test:integration # live API tests (hit HowLongToBeat)
npm run test:coverage    # unit tests with coverage
npm run lint             # eslint
npm run format           # prettier
```

Releases are managed with [Changesets](https://github.com/changesets/changesets): run `npm run changeset` to record a change; the release workflow publishes to npm once the generated version PR is merged.

## Issues, Questions & Discussions

If you found a bug, report it as soon as possible creating an [issue](https://github.com/Deadlock-too/howlongtobeat-ts/issues/new), the code is not perfect for sure, and I will be happy to fix it.
If you need any new feature, or want to discuss the current implementation/features, consider opening a [discussion](https://github.com/Deadlock-too/howlongtobeat-ts/discussions/) or even propose a change with a [Pull Request](https://github.com/Deadlock-too/howlongtobeat-ts/pulls).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Deadlock-too/howlongtobeat-ts/blob/main/LICENSE) file for details.
