import { describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { HowLongToBeatService, SearchModifier, ScraperError, toHours } from '../src'
import { type InitResponse, getMatchScore, getSimilarity } from '../src'
import { parseGamePage, parseJsonResult } from '../src/lib/parser'
import { normalize } from '../src/lib/utils'
import { HttpClient, HttpError, type FetchLike, clampSimilarity } from '@deadlock-too/scrape-kit'

const searchFixture = readFileSync('tests/fixtures/search-response.json', 'utf8')
const gamePageFixture = readFileSync('tests/fixtures/game-page.html', 'utf8')

const AUTH_BODY = JSON.stringify({ token: 'tok', hpKey: 'hp', hpVal: 'val' })

/**
 * Route matchers derived from the service's own constants, so a change to the
 * endpoint paths does not have to be mirrored in every route below. The init
 * URL sits under the search URL, so search matches exactly while init — which
 * carries a cache-busting query string — matches on prefix.
 */
const isSearchUrl = (u: string) => u === HowLongToBeatService.SEARCH_URL
const isInitUrl = (u: string) => u.startsWith(HowLongToBeatService.INIT_URL)

type Route = { match: (url: string) => boolean; respond: () => Response }

/** Builds a fetch double that routes by URL and never touches the network. */
function fetchStub(routes: Route[]): FetchLike {
  return async (input) => {
    const url = String(input)
    const route = routes.find((r) => r.match(url))
    if (!route) throw new Error(`unexpected request to ${url}`)
    return route.respond()
  }
}

const initRoute = (): Route => ({ match: isInitUrl, respond: () => new Response(AUTH_BODY) })

function makeService(routes: Route[]): HowLongToBeatService {
  return new HowLongToBeatService({ fetch: fetchStub(routes), retries: 0 })
}

/**
 * Reproduces the shape `fetch` gives a socket failure: a bare
 * `TypeError: fetch failed` whose `cause` carries the real errno. Building it
 * by hand keeps the unit suite off the network while still exercising the
 * chain-walking that a real failure requires.
 */
function fetchFailure(code: string): TypeError {
  const cause = Object.assign(new Error(`connect ${code} 127.0.0.1:1`), { code })
  return Object.assign(new TypeError('fetch failed'), { cause })
}

/** A fetch double that never settles until its `init.signal` aborts. */
const hangingFetch: FetchLike = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) return
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })

describe('HowLongToBeatService – request building', () => {
  const initResponse = {
    token: 'test-token',
    hpKey: 'test-hp-key',
    hpVal: 'test-hp-val',
    userAgent: 'UA',
  } as InitResponse

  test('getSearchRequestHeaders returns the expected headers', () => {
    const headers = HowLongToBeatService.getSearchRequestHeaders(initResponse)
    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: '*/*',
      Referer: HowLongToBeatService.REFERER_HEADER,
      'X-Auth-Token': initResponse.token,
      'X-Hp-Key': initResponse.hpKey,
      'X-Hp-Val': initResponse.hpVal,
      'User-Agent': 'UA',
    })
    expect(Object.keys(headers)).toHaveLength(7)
  })

  test('getSearchRequestData builds a valid payload with modifier and page', () => {
    const payload = JSON.parse(
      HowLongToBeatService.getSearchRequestData('Test Game', SearchModifier.ONLY_DLC, 2, initResponse),
    )
    expect(payload).toMatchObject({ searchType: 'games', searchTerms: ['Test', 'Game'], searchPage: 2 })
    expect(payload.searchOptions.games.modifier).toBe(SearchModifier.ONLY_DLC)
  })

  test('search forwards the chosen modifier in the request body', async () => {
    let sentBody: string | undefined
    const service = new HowLongToBeatService({
      fetch: async (input, init) => {
        if (isInitUrl(String(input))) return new Response(AUTH_BODY)
        sentBody = init?.body as string
        return new Response(searchFixture)
      },
      retries: 0,
    })
    const result = await service.search('Elden Ring', { modifier: SearchModifier.HIDE_DLC })
    expect(result.success).toBe(true)
    expect(JSON.parse(sentBody!).searchOptions.games.modifier).toBe(SearchModifier.HIDE_DLC)
  })
})

describe('HowLongToBeatService – search', () => {
  test('rejects an empty search key', async () => {
    const result = await new HowLongToBeatService().search('')
    expect(result).toEqual({ success: false, error: 'Search key is empty', kind: 'input' })
  })

  test('returns parsed, similarity-sorted results', async () => {
    const service = makeService([initRoute(), { match: isSearchUrl, respond: () => new Response(searchFixture) }])
    const result = await service.search('Elden Ring')

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    // "Far Cry 3" is filtered out by the default similarity threshold.
    expect(result.data.map((e) => e.id)).toEqual([68151, 112501])
    expect(result.data[0].similarity).toBe(1)
    expect(result.data[0].mainTime).toBe(208800)
    expect(result.data[0].raw.game_id).toBe(68151)
  })

  test('surfaces a clear error when the response shape changed', async () => {
    const service = makeService([
      initRoute(),
      { match: isSearchUrl, respond: () => new Response(JSON.stringify({ nope: true })) },
    ])
    const result = await service.search('Elden Ring')
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/structure may have changed/)
  })
})

/**
 * The point of these is the `kind`, not the fact of failure. A consumer has to
 * be able to answer "is HowLongToBeat down, or has it changed shape and broken
 * this library?" without matching on message wording, so every case below
 * asserts the discriminator.
 */
describe('HowLongToBeatService – failure classification', () => {
  describe('the source could not be reached', () => {
    test('a refused connection reports transport, not a parse failure', async () => {
      const service = new HowLongToBeatService({
        fetch: async () => {
          throw fetchFailure('ECONNREFUSED')
        },
        retries: 0,
      })
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Could not reach HowLongToBeat (network error)',
        kind: 'transport',
      })
    })

    test('a DNS failure reports transport', async () => {
      const service = new HowLongToBeatService({
        fetch: async () => {
          throw fetchFailure('ENOTFOUND')
        },
        retries: 0,
      })
      const result = await service.search('Elden Ring')
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected failure')
      expect(result.kind).toBe('transport')
    })

    test('a caller abort reports aborted, and blames neither the site nor the parser', async () => {
      const service = new HowLongToBeatService({ fetch: hangingFetch, retries: 0 })
      const controller = new AbortController()
      const promise = service.search('Elden Ring', { signal: controller.signal })
      queueMicrotask(() => controller.abort())

      const result = await promise
      expect(result).toEqual({
        success: false,
        error: 'The HowLongToBeat request was aborted by the caller',
        kind: 'aborted',
      })
    })

    test("the client's own per-request timeout reports timeout", async () => {
      const service = new HowLongToBeatService({ fetch: hangingFetch, retries: 0, timeout: 5 })
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'The HowLongToBeat request timed out',
        kind: 'timeout',
      })
    })

    test('getById classifies transport failures the same way', async () => {
      const service = new HowLongToBeatService({
        fetch: async () => {
          throw fetchFailure('ECONNRESET')
        },
        retries: 0,
      })
      const result = await service.getById(68151)
      expect(result).toEqual({
        success: false,
        error: 'Could not reach HowLongToBeat (network error)',
        kind: 'transport',
      })
    })
  })

  describe('the source answered with an error status', () => {
    test('a 403 from the init endpoint carries the status instead of losing it', async () => {
      const service = makeService([{ match: isInitUrl, respond: () => new Response('', { status: 403 }) }])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Init request failed with status 403',
        kind: 'http',
        status: 403,
      })
    })

    test('a 5xx from the search endpoint carries the status', async () => {
      const service = makeService([
        initRoute(),
        { match: isSearchUrl, respond: () => new Response('', { status: 503 }) },
      ])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Search request failed with status 503',
        kind: 'http',
        status: 503,
      })
    })

    test('a 404 from the search endpoint carries the status', async () => {
      const service = makeService([
        initRoute(),
        { match: isSearchUrl, respond: () => new Response('', { status: 404 }) },
      ])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Search request failed with status 404',
        kind: 'http',
        status: 404,
      })
    })

    test('a 5xx on the game page carries the status', async () => {
      const service = makeService([
        { match: (u) => u.includes('/game/'), respond: () => new Response('', { status: 500 }) },
      ])
      const result = await service.getById(68151)
      expect(result).toEqual({
        success: false,
        error: 'Game page request failed with status 500',
        kind: 'http',
        status: 500,
      })
    })
  })

  describe('the source answered, but unreadably', () => {
    test('a 200 whose search body is not JSON reports parse', async () => {
      const service = makeService([
        initRoute(),
        { match: isSearchUrl, respond: () => new Response('<!doctype html><html lang="en"></html>') },
      ])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Failed to parse the HowLongToBeat response as JSON',
        kind: 'parse',
      })
    })

    test('a 200 whose JSON is missing the data array reports parse', async () => {
      const service = makeService([
        initRoute(),
        { match: isSearchUrl, respond: () => new Response(JSON.stringify({ count: 0 })) },
      ])
      const result = await service.search('Elden Ring')
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected failure')
      expect(result.kind).toBe('parse')
      expect(result.error).toMatch(/missing "data" array/)
    })

    test('a 200 whose init body is not JSON reports parse, naming the init response', async () => {
      const service = makeService([{ match: isInitUrl, respond: () => new Response('<html></html>') }])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Failed to parse the HowLongToBeat init response as JSON',
        kind: 'parse',
      })
    })

    test('an init response with no token reports parse, not a network failure', async () => {
      const service = makeService([
        {
          match: isInitUrl,
          respond: () => new Response(JSON.stringify({ hpKey: 'hp', hpVal: 'val' })),
        },
      ])
      const result = await service.search('Elden Ring')
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected failure')
      expect(result.kind).toBe('parse')
      expect(result.error).toMatch(/no auth token/)
    })

    test('an init body of `null` reports parse', async () => {
      const service = makeService([{ match: isInitUrl, respond: () => new Response('null') }])
      const result = await service.search('Elden Ring')
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected failure')
      expect(result.kind).toBe('parse')
    })

    // Walking a payload whose shape moved throws a bare TypeError that looks
    // like nothing in particular. In a parse `catch` it can only be a parse
    // failure, and reporting it as anything else is what sent people to the
    // wrong repo.
    test('a data array holding something unexpected still reports parse', async () => {
      const service = makeService([
        initRoute(),
        { match: isSearchUrl, respond: () => new Response(JSON.stringify({ data: [null] })) },
      ])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'Failed to parse the HowLongToBeat response (the site structure may have changed)',
        kind: 'parse',
      })
    })

    test('a game page with no embedded payload reports parse', async () => {
      const service = makeService([
        { match: (u) => u.includes('/game/'), respond: () => new Response('<html lang="en"></html>') },
      ])
      const result = await service.getById(68151)
      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected failure')
      expect(result.kind).toBe('parse')
    })
  })

  describe('everything else', () => {
    test('an unattributable throw reports unknown rather than guessing', async () => {
      const service = makeService([
        initRoute(),
        {
          match: isSearchUrl,
          respond: () => {
            throw new Error('socket hang up')
          },
        },
      ])
      const result = await service.search('Elden Ring')
      expect(result).toEqual({
        success: false,
        error: 'The HowLongToBeat request failed for an unknown reason',
        kind: 'unknown',
      })
    })

    test('an invalid game id reports input, without touching the network', async () => {
      const result = await new HowLongToBeatService().getById(0)
      expect(result).toEqual({ success: false, error: 'A valid game id is required', kind: 'input' })
    })

    test('the failure survives a JSON round trip, which a thrown Error would not', async () => {
      const service = makeService([{ match: isInitUrl, respond: () => new Response('', { status: 403 }) }])
      const result = await service.search('Elden Ring')
      expect(JSON.parse(JSON.stringify(result))).toEqual({
        success: false,
        error: 'Init request failed with status 403',
        kind: 'http',
        status: 403,
      })
    })
  })

  test('the thrown HttpError is still a ScraperError, so existing catches match', () => {
    expect(new HttpError('boom', 403)).toBeInstanceOf(ScraperError)
  })
})

describe('HowLongToBeatService – searchOne & getById', () => {
  test('searchOne returns the single best match', async () => {
    const service = makeService([initRoute(), { match: isSearchUrl, respond: () => new Response(searchFixture) }])
    const result = await service.searchOne('Elden Ring')
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data?.id).toBe(68151)
  })

  test('searchOne propagates a search failure with its discriminator intact', async () => {
    const service = makeService([{ match: isInitUrl, respond: () => new Response('', { status: 403 }) }])
    const result = await service.searchOne('Elden Ring')
    expect(result).toEqual({
      success: false,
      error: 'Init request failed with status 403',
      kind: 'http',
      status: 403,
    })
  })

  test('searchOne returns null when nothing matches', async () => {
    const service = makeService([
      initRoute(),
      { match: isSearchUrl, respond: () => new Response(JSON.stringify({ data: [] })) },
    ])
    const result = await service.searchOne('Elden Ring')
    expect(result).toEqual({ success: true, data: null })
  })

  test('getById validates the id', async () => {
    const result = await new HowLongToBeatService().getById(0)
    expect(result).toEqual({ success: false, error: 'A valid game id is required', kind: 'input' })
  })

  test('getById parses the embedded game payload', async () => {
    const service = makeService([{ match: (u) => u.includes('/game/'), respond: () => new Response(gamePageFixture) }])
    const result = await service.getById(68151)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data?.name).toBe('Elden Ring')
    expect(result.data?.mainTime).toBe(208800)
  })

  test('getById returns null when the page has no matching entry', async () => {
    const service = makeService([{ match: (u) => u.includes('/game/'), respond: () => new Response(gamePageFixture) }])
    const result = await service.getById(999999)
    expect(result).toEqual({ success: true, data: null })
  })
})

describe('HowLongToBeatService – options', () => {
  test('a low similarity threshold widens the result set', async () => {
    const service = new HowLongToBeatService({
      minSimilarity: 0.1,
      fetch: fetchStub([initRoute(), { match: isSearchUrl, respond: () => new Response(searchFixture) }]),
      retries: 0,
    })
    const result = await service.search('Elden Ring')
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    // With a low threshold "Far Cry 3" is now included.
    expect(result.data).toHaveLength(3)
  })
})

describe('parser', () => {
  test('parses the search fixture into typed entries', () => {
    const entries = parseJsonResult(searchFixture, 'Elden Ring', 0.5)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: 68151, name: 'Elden Ring', type: 'game', reviewScore: 92 })
    expect(entries[0].platforms).toContain('PC')
    expect(entries[0].raw.game_id).toBe(68151)
  })

  test('omits single-player times when comp_lvl_sp is falsy', () => {
    const payload = JSON.parse(searchFixture)
    payload.data = [{ ...payload.data[0], comp_lvl_sp: 0, comp_lvl_co: 0, comp_lvl_mp: 0 }]
    const [entry] = parseJsonResult(JSON.stringify(payload), 'Elden Ring', 0.5)
    expect(entry.mainTime).toBeUndefined()
    expect(entry.coopTime).toBeUndefined()
    expect(entry.multiplayerTime).toBeUndefined()
  })

  test('throws a ScraperError on invalid JSON', () => {
    expect(() => parseJsonResult('{ not json }', 'x', 0.5)).toThrow(ScraperError)
  })

  test('throws a ScraperError when the shape is unexpected', () => {
    expect(() => parseJsonResult(JSON.stringify({ foo: 1 }), 'x', 0.5)).toThrow(/structure may have changed/)
  })

  test('parseGamePage returns null when the id is absent', () => {
    expect(parseGamePage(gamePageFixture, 999999)).toBeNull()
  })

  test('parseGamePage throws when the payload is missing', () => {
    expect(() => parseGamePage('<html lang="en-US"></html>', 68151)).toThrow(ScraperError)
  })

  test('parseGamePage throws when the embedded payload is not valid JSON', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{ not json }</script>'
    expect(() => parseGamePage(html, 68151)).toThrow(ScraperError)
  })

  test('maps an entry with no platform or image to empty platforms and no imageUrl', () => {
    const payload = JSON.parse(searchFixture)
    payload.data = [{ ...payload.data[0], profile_platform: '', game_image: '' }]
    const [entry] = parseJsonResult(JSON.stringify(payload), 'Elden Ring', 0.5)
    expect(entry.platforms).toEqual([])
    expect(entry.imageUrl).toBeUndefined()
  })
})

describe('HttpClient', () => {
  test('retries on 429 and honours the response', async () => {
    let calls = 0
    const fetchFn: FetchLike = async () => {
      calls++
      return calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '0' } }) : new Response('ok')
    }
    const client = new HttpClient({ fetch: fetchFn, retries: 2, retryDelay: 1 })
    const response = await client.request('https://example.com')
    expect(calls).toBe(2)
    expect(await response.text()).toBe('ok')
  })

  test('retries on network error then throws after exhausting attempts', async () => {
    let calls = 0
    const fetchFn: FetchLike = async () => {
      calls++
      throw new Error('boom')
    }
    const client = new HttpClient({ fetch: fetchFn, retries: 1, retryDelay: 1 })
    await expect(client.request('https://example.com')).rejects.toThrow('boom')
    expect(calls).toBe(2)
  })

  test('does not retry when the caller aborts', async () => {
    let calls = 0
    const fetchFn: FetchLike = async (_input, init) => {
      calls++
      if (init?.signal?.aborted) throw new Error('aborted')
      return new Response('ok')
    }
    const client = new HttpClient({ fetch: fetchFn, retries: 3, retryDelay: 1 })
    const controller = new AbortController()
    controller.abort()
    await expect(client.request('https://example.com', {}, controller.signal)).rejects.toThrow()
    expect(calls).toBe(1)
  })

  test('injects a random User-Agent when none is supplied', async () => {
    let seen: Headers | undefined
    const fetchFn: FetchLike = async (_input, init) => {
      seen = new Headers(init?.headers)
      return new Response('ok')
    }
    await new HttpClient({ fetch: fetchFn, retries: 0 }).request('https://example.com')
    expect(seen?.get('User-Agent')).toBeTruthy()
  })
})

describe('utils', () => {
  test('getSimilarity matches the documented values', () => {
    expect(getSimilarity('test', 'test')).toBe(1)
    expect(getSimilarity('test', 'banana')).toBe(0)
    expect(getSimilarity('Elden Ring', 'Elden Rin')).toBe(0.9)
    expect(getSimilarity('Test', 'test')).toBe(1)
    expect(getSimilarity('test', '')).toBe(0)
  })

  test('getMatchScore keeps short queries against long titles', () => {
    const score = getMatchScore('The Legend of Zelda: Tears of the Kingdom', 'Zelda')
    expect(score).toBeGreaterThanOrEqual(0.5)
    expect(getMatchScore('Pokémon Red', 'pokemon red')).toBe(1)
  })

  test('toHours converts seconds and preserves undefined', () => {
    expect(toHours(208800)).toBe(58)
    expect(toHours(5400)).toBe(1.5)
    expect(toHours(undefined)).toBeUndefined()
  })

  test('clampSimilarity keeps values within [0, 1]', () => {
    expect(clampSimilarity(-1)).toBe(0)
    expect(clampSimilarity(5)).toBe(1)
    expect(clampSimilarity(Number.NaN)).toBe(0.5)
    expect(clampSimilarity(0.3)).toBe(0.3)
  })

  test('normalize strips diacritics, case and punctuation', () => {
    expect(normalize('Pokémon')).toBe('pokemon')
    expect(normalize("Marvel's Spider-Man")).toBe('marvel s spider man')
  })
})
