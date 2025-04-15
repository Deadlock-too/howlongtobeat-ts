import { describe } from '@jest/globals'
import { HowLongToBeatService } from '../src'

describe('Integration-Testing HowLongToBeatService', () => {
  test('should fetch game data from HowLongToBeat', async () => {
    const service = new HowLongToBeatService()
    const gameName = 'Elden Ring'
    const hltbEntries = await service.search(gameName)

    expect(hltbEntries).toBeDefined()
    expect(hltbEntries.length).toBeGreaterThan(0)
    expect(hltbEntries[0].name).toBe(gameName)
    expect(hltbEntries[0].id).toBe(68151)
    expect(hltbEntries[0].type).toBe('game')
    expect(hltbEntries[0].reviewScore).toBeGreaterThan(90)
    expect(hltbEntries[0].imageUrl).toBe('https://howlongtobeat.com/games/68151_Elden_Ring.jpg')
    expect(hltbEntries[0].releaseYear).toBe(2022)
    expect(hltbEntries[0].platforms.length).toBeGreaterThan(5)
    expect(hltbEntries[0].platforms).toContain('PC')
    expect(hltbEntries[0].mainTime).toBeGreaterThan(200000)
    expect(hltbEntries[0].mainExtraTime).toBeGreaterThan(350000)
    expect(hltbEntries[0].completionistTime).toBeGreaterThan(475000)
    expect(hltbEntries[0].allStylesTime).toBeGreaterThan(350000)
    expect(hltbEntries[0].coopTime).toBeDefined()
    expect(hltbEntries[0].multiplayerTime).toBeDefined()
    expect(hltbEntries[0].mainCount).toBeDefined()
    expect(hltbEntries[0].mainExtraCount).toBeDefined()
    expect(hltbEntries[0].completionistCount).toBeDefined()
    expect(hltbEntries[0].allStylesCount).toBeDefined()
    expect(hltbEntries[0].coopCount).toBeDefined()
    expect(hltbEntries[0].multiplayerCount).toBeDefined()
    expect(hltbEntries[0].similarity).toBe(1)
    expect(hltbEntries[0].json).toBeDefined()
  })

  test('should not find any game on HowLongToBeat', async () => {
    const service = new HowLongToBeatService()
    const gameName = 'ThisGameDoesNotExist'
    const hltbEntries = await service.search(gameName)

    expect(hltbEntries).toBeDefined()
    expect(hltbEntries).toHaveLength(0)
  })
})
