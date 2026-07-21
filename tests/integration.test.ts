import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import { HowLongToBeatService } from '../src'

// These hit the live backend, so they need more headroom than Jest's 5s
// default: the HTTP client alone allows 60s per attempt plus two retries with
// backoff, so one slow response would fail the test long before the client
// would have recovered from it.
//
// This has to live here rather than as `testTimeout` in jest.config.ts: in a
// multi-project config Jest resolves a project-level `testTimeout` (it shows up
// in `--showConfig`) but does not apply it at runtime, so the 5s default wins
// silently. Setting it at the top level of the config would work, but would
// also relax the unit suite.
jest.setTimeout(30_000)

let service: HowLongToBeatService

beforeAll(() => {
  service = new HowLongToBeatService()
})

// These tests hit the live HowLongToBeat API. They run only via the scheduled
// CI workflow (`npm run test:integration`), not as part of `npm test`.
describe('Integration – HowLongToBeatService', () => {
  test('fetches game data from HowLongToBeat', async () => {
    const result = await service.search('Elden Ring')

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)

    const entry = result.data[0]
    expect(entry.name).toBe('Elden Ring')
    expect(entry.id).toBe(68151)
    expect(entry.type).toBe('game')
    expect(entry.reviewScore).toBeGreaterThan(90)
    expect(entry.imageUrl).toBe('https://howlongtobeat.com/games/68151_Elden_Ring.jpg')
    expect(entry.releaseYear).toBe(2022)
    expect(entry.platforms.length).toBeGreaterThan(5)
    expect(entry.platforms).toContain('PC')
    expect(entry.mainTime).toBeGreaterThan(200000)
    expect(entry.similarity).toBe(1)
    expect(entry.raw.game_id).toBe(68151)
  })

  test('returns an empty result set for an unknown game', async () => {
    const result = await service.search('ThisGameDoesNotExist')

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)
    expect(result.data).toHaveLength(0)
  })

  test('fetches a game directly by id', async () => {
    const result = await service.getById(68151)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)
    expect(result.data?.name).toBe('Elden Ring')
  })
})
