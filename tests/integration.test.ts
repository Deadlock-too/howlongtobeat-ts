import { describe } from '@jest/globals'
import { HowLongToBeatService } from '../src'

describe('Integration-Testing HowLongToBeatService', () => {
  test('should fetch game data from HowLongToBeat', async () => {
    const service = new HowLongToBeatService()
    const gameName = 'Elden Ring'
    const hltbEntries = await service.search(gameName)

    expect(hltbEntries).toBeDefined()
    expect(hltbEntries.success).toBe(true)
    expect(hltbEntries.data.length).toBeGreaterThan(0)
    expect(hltbEntries.data[0].name).toBe(gameName)
    expect(hltbEntries.data[0].id).toBe(68151)
    expect(hltbEntries.data[0].type).toBe('game')
    expect(hltbEntries.data[0].reviewScore).toBeGreaterThan(90)
    expect(hltbEntries.data[0].imageUrl).toBe('https://howlongtobeat.com/games/68151_Elden_Ring.jpg')
    expect(hltbEntries.data[0].releaseYear).toBe(2022)
    expect(hltbEntries.data[0].platforms.length).toBeGreaterThan(5)
    expect(hltbEntries.data[0].platforms).toContain('PC')
    expect(hltbEntries.data[0].mainTime).toBeGreaterThan(200000)
    expect(hltbEntries.data[0].mainExtraTime).toBeGreaterThan(350000)
    expect(hltbEntries.data[0].completionistTime).toBeGreaterThan(475000)
    expect(hltbEntries.data[0].allStylesTime).toBeGreaterThan(350000)
    expect(hltbEntries.data[0].coopTime).toBeDefined()
    expect(hltbEntries.data[0].multiplayerTime).toBeDefined()
    expect(hltbEntries.data[0].mainCount).toBeDefined()
    expect(hltbEntries.data[0].mainExtraCount).toBeDefined()
    expect(hltbEntries.data[0].completionistCount).toBeDefined()
    expect(hltbEntries.data[0].allStylesCount).toBeDefined()
    expect(hltbEntries.data[0].coopCount).toBeDefined()
    expect(hltbEntries.data[0].multiplayerCount).toBeDefined()
    expect(hltbEntries.data[0].similarity).toBe(1)
    expect(hltbEntries.data[0].json).toBeDefined()
  })

  test('should not find any game on HowLongToBeat', async () => {
    const service = new HowLongToBeatService()
    const gameName = 'ThisGameDoesNotExist'
    const hltbEntries = await service.search(gameName)

    expect(hltbEntries).toBeDefined()
    expect(hltbEntries.success).toBe(true)
    expect(hltbEntries.data).toHaveLength(0)
  })
})
