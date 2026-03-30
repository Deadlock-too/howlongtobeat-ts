import { parseJsonResult } from './parser'
import { SearchModifier } from './types'
import UserAgent from 'user-agents'

export type InitResponse = {
  token: string,
  hpKey: string,
  hpVal: string,
  userAgent: string,
}

export class HowLongToBeatService {
  minSimilarity: number

  static BASE_URL = 'https://howlongtobeat.com/'
  static REFERER_HEADER = HowLongToBeatService.BASE_URL
  static SEARCH_URL = HowLongToBeatService.BASE_URL + 'api/find'

  constructor(minSimilarity: number = 0.5) {
    this.minSimilarity = minSimilarity
  }

  async search(searchKey: string, searchModifier: SearchModifier = SearchModifier.NONE) {
    if (!searchKey || searchKey.length === 0) {
      return []
    }

    const htmlResult = await HowLongToBeatService.sendWebRequest(searchKey, searchModifier)
    if (htmlResult) {
      return parseJsonResult(htmlResult!, searchKey, this.minSimilarity)
    }

    return []
  }

  static async sendWebRequest(searchKey: string, searchModifier: SearchModifier = SearchModifier.NONE, page = 1): Promise<string | undefined> {
    const authInfo = await this.sendWebsiteRequestGetAuthInfo()
    if (!authInfo) {
      console.error('Failed to obtain auth token')
      return undefined
    }
    const headers = this.getSearchRequestHeaders(authInfo)

    const payload = HowLongToBeatService.getSearchRequestData(searchKey, searchModifier, page, authInfo)

    try {
      const response = await fetch(HowLongToBeatService.SEARCH_URL, {
        headers: headers,
        method: 'POST',
        body: payload,
        signal: AbortSignal.timeout(60000)
      })
      if (response.ok) {
        return await response.text()
      }
      console.error('Search request failed with status:', response.status)
      console.error('Response body:', await response.text())
    } catch (error) {
      console.error('Error fetching search results with auth token:', error)
    }
  }

  static getSearchRequestHeaders(authInfo: InitResponse) {
    return {
      'Content-Type': 'application/json',
      'User-Agent': authInfo.userAgent,
      'Accept': '*/*',
      'Referer': HowLongToBeatService.REFERER_HEADER,
      'X-Auth-Token': authInfo.token,
      'X-Hp-Key': authInfo.hpKey,
      'X-Hp-Val': authInfo.hpVal,
    }
  }

  static getTitleRequestHeaders() {
    const userAgent = new UserAgent()
    return {
      'User-Agent': userAgent.toString(),
      'Referer': HowLongToBeatService.REFERER_HEADER,
    }
  }

  static async sendWebsiteRequestGetAuthInfo(): Promise<InitResponse | null> {
    const headers = this.getTitleRequestHeaders()
    try {
      const response = await fetch(HowLongToBeatService.BASE_URL + `api/find/init?t=${new Date().getTime()}`, {
        headers: headers,
        signal: AbortSignal.timeout(60000)
      })

      if (response.ok) {
        const json = await response.json()
        if (json && json.token) {
          return { ...json, userAgent: headers['User-Agent'] } as InitResponse
        } else {
          console.error('Auth token not found in JSON response')
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching website:', error)
      return null
    }
  }

  static getSearchRequestData(searchKey: string, searchModifier: SearchModifier, page: number, initResponse: InitResponse): string {
    const payload = {
      [initResponse.hpKey]: initResponse.hpVal,
      searchType: 'games',
      searchTerms: searchKey.split(' '),
      searchPage: page,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: {
            min: 0,
            max: 0,
          },
          gameplay: {
            perspective: '',
            flow: '',
            genre: '',
            difficulty: '',
          },
          rangeYear: {
            min: '',
            max: '',
          },
          modifier: searchModifier,
        },
        users: {
          sortCategory: 'postcount',
        },
        lists: {
          sortCategory: 'follows',
        },
        filter: '',
        sort: 0,
        randomizer: 0
      },
      useCache: true,
    }

    return JSON.stringify(payload)
  }
}
