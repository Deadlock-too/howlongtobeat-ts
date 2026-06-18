import { describe, expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { HowLongToBeatService, SearchModifier, ScraperError, toHours } from '../src'
import { type InitResponse, getMatchScore, getSimilarity } from '../src'
import { parseGamePage, parseJsonResult } from '../src/lib/parser'
import { HttpClient, type FetchLike, clampSimilarity } from '@deadlock-too/scrape-kit'

const searchFixture = readFileSync('tests/fixtures/search-response.json', 'utf8')
const gamePageFixture = readFileSync('tests/fixtures/game-page.html', 'utf8')

const AUTH_BODY = JSON.stringify({ token: 'tok', hpKey: 'hp', hpVal: 'val' })

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

const initRoute = (): Route => ({ match: (u) => u.includes('/init'), respond: () => new Response(AUTH_BODY) })

function makeService(routes: Route[]): HowLongToBeatService {
  return new HowLongToBeatService({ fetch: fetchStub(routes), retries: 0 })
}

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
})

describe('HowLongToBeatService – search', () => {
  test('rejects an empty search key', async () => {
    const result = await new HowLongToBeatService().search('')
    expect(result).toEqual({ success: false, error: 'Search key is empty' })
  })

  test('returns parsed, similarity-sorted results', async () => {
    const service = makeService([
      initRoute(),
      { match: (u) => u.endsWith('/bleed'), respond: () => new Response(searchFixture) },
    ])
    const result = await service.search('Elden Ring')

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    // "Far Cry 3" is filtered out by the default similarity threshold.
    expect(result.data.map((e) => e.id)).toEqual([68151, 112501])
    expect(result.data[0].similarity).toBe(1)
    expect(result.data[0].mainTime).toBe(208800)
    expect(result.data[0].raw.game_id).toBe(68151)
  })

  test('reports a failure when auth cannot be obtained', async () => {
    const service = makeService([
      { match: (u) => u.includes('/init'), respond: () => new Response('', { status: 403 }) },
    ])
    const result = await service.search('Elden Ring')
    expect(result).toEqual({ success: false, error: 'Failed to obtain search results' })
  })

  test('surfaces a clear error when the search request fails', async () => {
    const service = makeService([
      initRoute(),
      { match: (u) => u.endsWith('/bleed'), respond: () => new Response('', { status: 404 }) },
    ])
    const result = await service.search('Elden Ring')
    expect(result).toEqual({ success: false, error: 'Search request failed with status 404' })
  })

  test('surfaces a clear error when the response shape changed', async () => {
    const service = makeService([
      initRoute(),
      { match: (u) => u.endsWith('/bleed'), respond: () => new Response(JSON.stringify({ nope: true })) },
    ])
    const result = await service.search('Elden Ring')
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/structure may have changed/)
  })
})

describe('HowLongToBeatService – searchOne & getById', () => {
  test('searchOne returns the single best match', async () => {
    const service = makeService([
      initRoute(),
      { match: (u) => u.endsWith('/bleed'), respond: () => new Response(searchFixture) },
    ])
    const result = await service.searchOne('Elden Ring')
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data?.id).toBe(68151)
  })

  test('searchOne returns null when nothing matches', async () => {
    const service = makeService([
      initRoute(),
      { match: (u) => u.endsWith('/bleed'), respond: () => new Response(JSON.stringify({ data: [] })) },
    ])
    const result = await service.searchOne('Elden Ring')
    expect(result).toEqual({ success: true, data: null })
  })

  test('getById validates the id', async () => {
    const result = await new HowLongToBeatService().getById(0)
    expect(result).toEqual({ success: false, error: 'A valid game id is required' })
  })

  test('getById parses the embedded game payload', async () => {
    const service = makeService([{ match: (u) => u.includes('/game/'), respond: () => new Response(gamePageFixture) }])
    const result = await service.getById(68151)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data?.name).toBe('Elden Ring')
    expect(result.data?.mainTime).toBe(208800)
  })
})

describe('HowLongToBeatService – options', () => {
  test('a low similarity threshold widens the result set', async () => {
    const service = new HowLongToBeatService({
      minSimilarity: 0.1,
      fetch: fetchStub([
        initRoute(),
        { match: (u) => u.endsWith('/bleed'), respond: () => new Response(searchFixture) },
      ]),
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
})
