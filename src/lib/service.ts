import { parseJsonResult } from './parser'
import { SearchModifier } from './types'
import UserAgent from 'user-agents'

class SearchInformations {
  apiKey: string
  searchUrl: string

  constructor(scriptContent: string) {
    this.apiKey = this.extractApiFromScript(scriptContent)
    this.searchUrl = this.extractSearchUrlScript(scriptContent)
    if (HowLongToBeatService.BASE_URL.endsWith('/') && this.searchUrl) {
      this.searchUrl = this.searchUrl.replace(/^\//, '')
    }
  }

  extractApiFromScript(scriptContent: any) {
    const userIdApiKeyPattern = /users\s*:\s*{\s*id\s*:\s*"([^"]+)"/
    let matches = scriptContent.match(userIdApiKeyPattern)
    if (matches) {
      return matches[1]
    }
    const apiRegex = /"\/api\/\w+\/"(?:\.concat\("([^"]+)"\))+/g
    const apiMatch = scriptContent.match(apiRegex)

    if (apiMatch) {
      const concatRegex = /\.concat\("([^"]+)"\)/g
      const values = [ ...scriptContent.matchAll(concatRegex) ].map(
        (match) => match[1]
      )
      return values.join('')
    }
  }

  extractSearchUrlScript(scriptContent: any) {
    const pattern =
      /fetch\(\s*["'](\/api\/[^"']*)["']((?:\s*\.concat\(\s*["']([^"']*)["']\s*\))*)\s*,/g
    let matches = [ ...scriptContent.matchAll(pattern) ]

    for (let match of matches) {
      const endpoint = match[1]
      const concatCalls = match[2]
      const concatStrings = [
        ...concatCalls.matchAll(/\.concat\(\s*["']([^"']*)["']\s*\)/g),
      ].map((m) => m[1])
      const concatenatedStr = concatStrings.join('')

      if (concatenatedStr === this.apiKey) {
        return endpoint
      }
    }
  }
}

export class HowLongToBeatService {
  minSimilarity: number

  static BASE_URL = 'https://howlongtobeat.com/'
  static REFERER_HEADER = HowLongToBeatService.BASE_URL
  static SEARCH_URL = HowLongToBeatService.BASE_URL + 'api/s/'

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
    const headers = this.getSearchRequestHeaders()
    let searchInfoData = await this.sendWebsiteRequestGetCode(false)
    if (!searchInfoData?.apiKey) {
      searchInfoData = await this.sendWebsiteRequestGetCode(true)
    }

    if (searchInfoData?.searchUrl) {
      HowLongToBeatService.SEARCH_URL = HowLongToBeatService.BASE_URL + searchInfoData.searchUrl
    }

    const searchUrlWithKey = HowLongToBeatService.SEARCH_URL + searchInfoData?.apiKey
    const payload = HowLongToBeatService.getSearchRequestData(searchKey, searchModifier, page, null)

    try {
      const response = await fetch(searchUrlWithKey, {
        headers: headers,
        method: 'POST',
        body: payload,
        signal: AbortSignal.timeout(60000)
      })
      if (response.ok) {
        return await response.text()
      }
    } catch (error) {
      try {
        const payloadWithUser = HowLongToBeatService.getSearchRequestData(searchKey, searchModifier, page, searchInfoData)
        const response = await fetch(HowLongToBeatService.SEARCH_URL, {
          headers: headers,
          method: 'POST',
          body: payloadWithUser,
          signal: AbortSignal.timeout(60000)
        })
        if (response.ok) {
          return await response.text()
        }
      } catch (error) {
        console.error('Error fetching search results:', error)
      }
    }
  }

  static getSearchRequestHeaders() {
    const userAgent = new UserAgent()
    return {
      'Content-Type': 'application/json',
      'User-Agent': userAgent.toString(),
      'Accept': '*/*',
      'Referer': HowLongToBeatService.REFERER_HEADER,
    }
  }

  static getTitleRequestHeaders() {
    const userAgent = new UserAgent()
    return {
      'User-Agent': userAgent.toString(),
      'Referer': HowLongToBeatService.REFERER_HEADER,
    }
  }

  static async sendWebsiteRequestGetCode(parseAllScripts: boolean): Promise<SearchInformations | null> {
    const headers = this.getTitleRequestHeaders()
    try {
      const response = await fetch(HowLongToBeatService.BASE_URL, {
        headers: headers,
        signal: AbortSignal.timeout(60000)
      })

      if (response.ok) {
        const html = await response.text()

        const scriptPattern = /<script[^>]+src="([^"]+)"[^>]*>/g
        const scripts: string[] = []

        let match

        while ((match = scriptPattern.exec(html)) !== null) {
          const scriptSrc = match[1]
          if (parseAllScripts || scriptSrc.includes('_app-')) {
            scripts.push(scriptSrc)
          }
        }

        for (const scriptUrl of scripts) {
          const fullScriptUrl = new URL(scriptUrl, HowLongToBeatService.BASE_URL).href
          const scriptResponse = await fetch(fullScriptUrl, {
            headers: headers,
            signal: AbortSignal.timeout(60000)
          })

          if (scriptResponse.ok) {
            const scriptContent = await scriptResponse.text()
            const searchInfo = new SearchInformations(scriptContent)
            if (searchInfo.apiKey) {
              return searchInfo
            }

          } else {
            console.error('Error fetching script:', scriptUrl)
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching website:', error)
      return null
    }
  }

  static getSearchRequestData(searchKey: string, searchModifier: SearchModifier, page: number, searchInfo: {
    apiKey: string
  } | null): string {
    const payload = {
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
          id: searchInfo?.apiKey ?? undefined,
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
