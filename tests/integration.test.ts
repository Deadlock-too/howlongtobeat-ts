import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import { createServer } from 'node:net'
import { HowLongToBeatService } from '../src'
import { classifyError } from '@deadlock-too/scrape-kit'

/** Reserves an ephemeral loopback port and immediately gives it back up. */
function closedLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        return reject(new Error('expected a TCP address'))
      }
      server.close(() => resolve(address.port))
    })
  })
}

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

// The unit suite classifies hand-built doubles of the errors `fetch` throws.
// These check the doubles are faithful, by classifying the errors the runtime
// actually produces.
describe('Integration – failure classification', () => {
  test('a real refused connection classifies as transport', async () => {
    // Bind a port, then release it, so the connect is refused for certain.
    // Hard-coding a "probably closed" port risks either a live listener or one
    // of the ports undici blocks outright, which is a different failure.
    const port = await closedLoopbackPort()

    let thrown: unknown
    try {
      await fetch(`http://127.0.0.1:${port}/`)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeDefined()
    expect(classifyError(thrown)).toEqual({ kind: 'transport' })
  })

  test('a real elapsed deadline classifies as timeout, not as a parse failure', async () => {
    const impatient = new HowLongToBeatService({ timeout: 1, retries: 0 })
    const result = await impatient.search('Elden Ring')

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.kind).toBe('timeout')
    expect(result.error).toBe('The HowLongToBeat request timed out')
  })

  test('a real caller abort classifies as aborted', async () => {
    const controller = new AbortController()
    const promise = service.search('Elden Ring', { signal: controller.signal })
    controller.abort()

    const result = await promise
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.kind).toBe('aborted')
  })
})
