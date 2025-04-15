import { beforeEach, describe, expect, test } from '@jest/globals'
import { type HowLongToBeatEntry, HowLongToBeatService, SearchModifier, HowLongToBeatJsonResult } from '../src'
import { getSimilarity } from '../src/lib/utils'
import { parseJsonResult } from '../src/lib/parser'

describe('HowLongToBeatService', () => {
  let howLongToBeatService: HowLongToBeatService;

  beforeEach(() => {
    // Reset static props
    HowLongToBeatService.BASE_URL = 'https://howlongtobeat.com'
    HowLongToBeatService.SEARCH_URL = HowLongToBeatService.BASE_URL + 'api/s/'
    HowLongToBeatService.REFERER_HEADER = HowLongToBeatService.BASE_URL

    jest.resetAllMocks()

    howLongToBeatService = new HowLongToBeatService()
  })

  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks()
  })

  test('getSearchRequestHeaders should return correct headers', () => {
    const headers = HowLongToBeatService.getSearchRequestHeaders()
    expect(headers).toHaveProperty('User-Agent')
    expect(headers).toHaveProperty('Content-Type', 'application/json')
    expect(headers).toHaveProperty('Accept', '*/*')
    expect(headers).toHaveProperty('Referer', HowLongToBeatService.REFERER_HEADER)
    expect(Object.keys(headers).length).toBe(4)
  })

  test('getSearchRequestData should return valid payload', () => {
    const searchKey = 'Test Game'
    const payload = HowLongToBeatService.getSearchRequestData(searchKey, SearchModifier.NONE, 1, null)
    const parsedPayload = JSON.parse(payload)
    expect(parsedPayload).toHaveProperty('searchTerms', searchKey.split(' '))
    expect(parsedPayload).toHaveProperty('searchType', 'games')
    expect(parsedPayload).toHaveProperty('searchPage', 1)
  })

  test('search should return null for empty game name', async () => {
    const result = await howLongToBeatService.search('')
    expect(result).toHaveLength(0)
  })

  test('search should return game results', async () => {
    const mockValue = {
      data: [
        {
          game_id: 1,
          game_name: 'Test Game',
          game_alias: 'Alias',
          game_type: 'game',
          game_image: 'test.jpg',
          review_score: 80,
          profile_dev: 'Test Dev',
          profile_platform: 'PC, PS4',
          release_world: '2023',
        }
      ]
    }

    HowLongToBeatService.sendWebRequest = jest.fn().mockResolvedValue(JSON.stringify(mockValue))

    const result = await howLongToBeatService.search('Test Game');
    expect(result).toHaveLength(1);
    expect(result).toBeInstanceOf(Array<HowLongToBeatEntry>)
    expect(result![0].name).toBe(mockValue.data[0].game_name)
  })

  test('search should handle invalid response format', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const hltbsSpy = jest.spyOn(HowLongToBeatService, 'sendWebRequest').mockImplementation(() => {
      return Promise.resolve('Invalid JSON')
    })

    const result = await howLongToBeatService.search('Test Game');
    expect(result).toHaveLength(0);

    consoleSpy.mockRestore()
    hltbsSpy.mockRestore()
  })

  test('search should handle empty response', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const hltbsSpy = jest.spyOn(HowLongToBeatService, 'sendWebRequest').mockImplementation(() => {
      return Promise.resolve(undefined)
    })

    const result = await howLongToBeatService.search('Test Game');
    expect(result).toHaveLength(0);

    consoleSpy.mockRestore()
    hltbsSpy.mockRestore()
  })

  test('search should use different modifiers correctly', async () => {
    const payload = HowLongToBeatService.getSearchRequestData('Test Game', SearchModifier.ONLY_DLC, 1, null);
    const parsedPayload = JSON.parse(payload);
    expect(parsedPayload.searchOptions.games).toHaveProperty('modifier', SearchModifier.ONLY_DLC);
  })

  test('search should handle pagination correctly', async () => {
    const payload = HowLongToBeatService.getSearchRequestData('Test Game', SearchModifier.NONE, 2, null);
    const parsedPayload = JSON.parse(payload);
    expect(parsedPayload).toHaveProperty('searchPage', 2);
  })

  test('sendWebRequest should handle network errors gracefully', async () => {
    const consoleSpy = jest.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('Network error')))
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const result = await HowLongToBeatService.sendWebRequest('Test Game')
    expect(result).toBeUndefined()

    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('sendWebRequest should handle non-200 status codes gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not Found'),
    }
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const result = await HowLongToBeatService.sendWebRequest('Test Game')
    expect(result).toBeUndefined()

    fetchSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})

describe('parser', () => {
  const data: HowLongToBeatJsonResult = {
    color: 'blue',
    title: 'Test Game',
    category: 'game',
    count: 1,
    pageCurrent: 1,
    pageTotal: 1,
    pageSize: 1,
    userData: [],
    displayModifier: '',
    data: [
      {
        game_id: 1,
        game_name: 'Test Game',
        game_name_date: 0,
        game_alias: 'Alias',
        game_type: 'game',
        game_image: 'test.jpg',
        comp_lvl_combine: 1,
        comp_lvl_sp: 1,
        comp_lvl_co: 1,
        comp_lvl_mp: 1,
        comp_main: 600,
        comp_plus: 3543,
        comp_100: 4543,
        comp_all: 6454,
        comp_main_count: 4355,
        comp_plus_count: 735,
        comp_100_count: 2573,
        comp_all_count: 757,
        invested_co: 435,
        invested_mp: 357,
        invested_co_count: 2574,
        invested_mp_count: 246,
        count_comp: 1125,
        count_speedrun: 124,
        count_backlog: 1512,
        count_review: 15,
        review_score: 80,
        count_playing: 5,
        count_retired: 10,
        profile_platform: 'PC, PS4',
        profile_popular: 100,
        release_world: 2023,
      }
    ]
  }

  test('should parse JSON result correctly for all props', () => {
    const jsonResult = JSON.stringify(data)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult).toBeInstanceOf(Array<HowLongToBeatEntry>)
    expect(parsingResult[0].id).toBe(data.data[0].game_id)
    expect(parsingResult[0].name).toBe(data.data[0].game_name)
    expect(parsingResult[0].alias).toBe(data.data[0].game_alias)
    expect(parsingResult[0].type).toBe(data.data[0].game_type)
    expect(parsingResult[0].reviewScore).toBe(data.data[0].review_score)
    expect(parsingResult[0].mainTime).toBe(data.data[0].comp_main)
    expect(parsingResult[0].mainExtraTime).toBe(data.data[0].comp_plus)
    expect(parsingResult[0].completionistTime).toBe(data.data[0].comp_100)
    expect(parsingResult[0].allStylesTime).toBe(data.data[0].comp_all)
    expect(parsingResult[0].coopTime).toBe(data.data[0].invested_co)
    expect(parsingResult[0].multiplayerTime).toBe(data.data[0].invested_mp)
    expect(parsingResult[0].mainCount).toBe(data.data[0].comp_main_count)
    expect(parsingResult[0].mainExtraCount).toBe(data.data[0].comp_plus_count)
    expect(parsingResult[0].completionistCount).toBe(data.data[0].comp_100_count)
    expect(parsingResult[0].allStylesCount).toBe(data.data[0].comp_all_count)
    expect(parsingResult[0].coopCount).toBe(data.data[0].invested_co_count)
    expect(parsingResult[0].multiplayerCount).toBe(data.data[0].invested_mp_count)
    expect(parsingResult[0].platforms).toEqual(data.data[0].profile_platform.split(', '))
    expect(parsingResult[0].releaseYear).toBe(data.data[0].release_world)
    expect(parsingResult[0].json).toBe(JSON.stringify(data.data[0]))
    expect(parsingResult[0].imageUrl).toBe('https://howlongtobeat.com/games/test.jpg')
    expect(parsingResult[0].similarity).toBeGreaterThan(0)
  })

  test('should skip entries with low similarity', () => {
    const jsonResult = JSON.stringify(data)

    const parsingResult = parseJsonResult(jsonResult, 'Nonexistent', 0.5)
    expect(parsingResult).toHaveLength(0)
  })

  test('should handle invalid JSON gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    const invalidJson = '{ invalid json }'
    const parsingResult = parseJsonResult(invalidJson, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(0)

    consoleSpy.mockRestore()
  })

  test('should handle comp_lvl_sp being null', () => {
    const dataWithNullCompLvlSp = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_sp: null,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithNullCompLvlSp)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].mainTime).toBeUndefined()
    expect(parsingResult[0].mainExtraTime).toBeUndefined()
    expect(parsingResult[0].completionistTime).toBeUndefined()
    expect(parsingResult[0].allStylesTime).toBeUndefined()
    expect(parsingResult[0].mainCount).toBeUndefined()
    expect(parsingResult[0].mainExtraCount).toBeUndefined()
    expect(parsingResult[0].completionistCount).toBeUndefined()
    expect(parsingResult[0].allStylesCount).toBeUndefined()
  })

  test('should handle comp_lvl_sp being 0', () => {
    const dataWithZeroCompLvlSp = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_sp: 0,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithZeroCompLvlSp)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].mainTime).toBeUndefined()
    expect(parsingResult[0].mainExtraTime).toBeUndefined()
    expect(parsingResult[0].completionistTime).toBeUndefined()
    expect(parsingResult[0].allStylesTime).toBeUndefined()
    expect(parsingResult[0].mainCount).toBeUndefined()
    expect(parsingResult[0].mainExtraCount).toBeUndefined()
    expect(parsingResult[0].completionistCount).toBeUndefined()
    expect(parsingResult[0].allStylesCount).toBeUndefined()
  })

  test('should handle comp_lvl_co being null', () => {
    const dataWithNullCompLvlCo = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_co: null,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithNullCompLvlCo)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].coopTime).toBeUndefined()
    expect(parsingResult[0].coopCount).toBeUndefined()
  })

  test('should handle comp_lvl_co being 0', () => {
    const dataWithZeroCompLvlCo = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_co: 0,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithZeroCompLvlCo)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].coopTime).toBeUndefined()
    expect(parsingResult[0].coopCount).toBeUndefined()
  })

  test('should handle comp_lvl_mp being null', () => {
    const dataWithNullCompLvlMp = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_mp: null,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithNullCompLvlMp)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].multiplayerTime).toBeUndefined()
    expect(parsingResult[0].multiplayerCount).toBeUndefined()
  })

  test('should handle comp_lvl_mp being 0', () => {
    const dataWithZeroCompLvlMp = {
      ...data,
      data: [
        {
          ...data.data[0],
          comp_lvl_mp: 0,
        }
      ]
    }

    const jsonResult = JSON.stringify(dataWithZeroCompLvlMp)

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult).toHaveLength(1)
    expect(parsingResult[0].multiplayerTime).toBeUndefined()
    expect(parsingResult[0].multiplayerCount).toBeUndefined()
  })

  test('should handle empty data array', () => {
    const emptyData = { ...data, data: [] };
    const jsonResult = JSON.stringify(emptyData);
    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5);
    expect(parsingResult).toHaveLength(0);
  })

  test('should handle missing required fields', () => {
    const incompleteData = {
      ...data,
      data: [{ game_id: 1, game_name: 'Test Game' }]
    };
    const jsonResult = JSON.stringify(incompleteData);
    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5);
    expect(parsingResult).toHaveLength(1);
    expect(parsingResult[0].id).toBe(1);
    expect(parsingResult[0].name).toBe('Test Game');
  })

  test('should order results by similarity', () => {
    const jsonResult = JSON.stringify({
      ...data,
      data: [
        { game_id: 1, game_name: 'Test Game', game_alias: 'Alias', game_type: 'game', review_score: 80, profile_platform: 'PC, PS4', release_world: 2023 },
        { game_id: 2, game_name: 'Another Game', game_alias: 'Another Alias', game_type: 'game', review_score: 70, profile_platform: 'PC', release_world: 2022 },
        { game_id: 3, game_name: 'Test Game 2', game_alias: 'Alias 2', game_type: 'game', review_score: 90, profile_platform: 'PS4', release_world: 2021 }
      ]
    })

    const parsingResult = parseJsonResult(jsonResult, 'Test Game', 0.5)
    expect(parsingResult[0].id).toBe(1)
    expect(parsingResult[1].id).toBe(3)
    expect(parsingResult[2].id).toBe(2)
  })
})

describe('utils', () => {
  test('getSimilarity should return 1 for identical strings', () => {
    const result = getSimilarity('test', 'test')
    expect(result).toBe(1)
  })

  test('getSimilarity should return 0 for completely different strings', () => {
    const result = getSimilarity('test', 'banana')
    expect(result).toBe(0)
  })

  test('getSimilarity should return correct similarity for similar strings', () => {
    const result = getSimilarity('test', 'test123')
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })

  test('getSimilarity should handle empty strings', () => {
    const result1 = getSimilarity('', '');
    const result2 = getSimilarity('test', '');
    expect(result1).toBe(1); // Two empty strings are identical
    expect(result2).toBe(0); // No similarity between text and empty string
  })

  test('getSimilarity should be case insensitive', () => {
    const result = getSimilarity('Test', 'test');
    expect(result).toBe(1); // Or whatever behavior is expected for case sensitivity
  })

  test('getSimilarity should compute Elden Ring and Elden Rin correctly', () => {
    const result = getSimilarity('Elden Ring', 'Elden Rin')
    expect(result).toBe(0.9)
  })
})
