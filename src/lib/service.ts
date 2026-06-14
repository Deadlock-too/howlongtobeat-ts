import { parseGamePage, parseJsonResult } from './parser'
import { EntryResult, SearchResult, SearchModifier } from './types'
import { BaseScraperService, ScraperOptions } from '../core/options'
import { ScraperError } from '../core/errors'
import { fail, ok } from '../core/result'

export type InitResponse = {
  token: string
  hpKey: string
  hpVal: string
  userAgent: string
}

export interface HltbSearchOptions {
  /** Filter DLC entries in/out of the results. */
  modifier?: SearchModifier
  /** Caller-supplied signal to cancel the in-flight request. */
  signal?: AbortSignal
}

export class HowLongToBeatService extends BaseScraperService {
  static BASE_URL = 'https://howlongtobeat.com/'
  static get REFERER_HEADER() {
    return HowLongToBeatService.BASE_URL
  }
  static get SEARCH_URL() {
    return HowLongToBeatService.BASE_URL + 'api/bleed'
  }
  static get INIT_URL() {
    return HowLongToBeatService.BASE_URL + 'api/bleed/init'
  }

  constructor(options: number | ScraperOptions = {}) {
    super(options)
  }

  async search(searchKey: string, options: HltbSearchOptions = {}): Promise<SearchResult> {
    if (!searchKey) {
      return fail('Search key is empty')
    }

    try {
      const result = await this.sendSearchRequest(searchKey, options)
      if (result == null) {
        return fail('Failed to obtain search results')
      }
      return ok(parseJsonResult(result, searchKey, this.minSimilarity))
    } catch (error) {
      this.logger.error('Error parsing search results:', error)
      return fail(error instanceof ScraperError ? error.message : 'Failed to parse search results')
    }
  }

  /** Convenience wrapper returning only the single best match (or `null`). */
  async searchOne(searchKey: string, options: HltbSearchOptions = {}): Promise<EntryResult> {
    const result = await this.search(searchKey, options)
    if (!result.success) return result
    return ok(result.data.length > 0 ? result.data[0] : null)
  }

  /**
   * Fetches a single game directly by its HowLongToBeat id.
   *
   * @experimental Relies on the public game page payload, which is not part of
   * a documented API and may change without notice.
   */
  async getById(id: number, options: { signal?: AbortSignal } = {}): Promise<EntryResult> {
    if (!id || id <= 0) {
      return fail('A valid game id is required')
    }

    try {
      const html = await this.sendGamePageRequest(id, options.signal)
      if (html == null) {
        return fail('Failed to obtain the game page')
      }
      return ok(parseGamePage(html, id))
    } catch (error) {
      this.logger.error('Error fetching game by id:', error)
      return fail(error instanceof ScraperError ? error.message : 'Failed to fetch the game page')
    }
  }

  private async sendSearchRequest(searchKey: string, options: HltbSearchOptions): Promise<string | undefined> {
    const authInfo = await this.getAuthInfo(options.signal)
    if (!authInfo) {
      this.logger.error('Failed to obtain auth token')
      return undefined
    }

    const headers = HowLongToBeatService.getSearchRequestHeaders(authInfo)
    const payload = HowLongToBeatService.getSearchRequestData(
      searchKey,
      options.modifier ?? SearchModifier.NONE,
      1,
      authInfo,
    )

    const response = await this.http.request(
      HowLongToBeatService.SEARCH_URL,
      { method: 'POST', headers, body: payload },
      options.signal,
    )
    if (!response.ok) {
      throw new ScraperError(`Search request failed with status ${response.status}`)
    }
    return response.text()
  }

  private async sendGamePageRequest(id: number, signal?: AbortSignal): Promise<string | undefined> {
    const headers = {
      'User-Agent': this.http.randomUserAgent(),
      Referer: HowLongToBeatService.REFERER_HEADER,
    }
    const response = await this.http.request(`${HowLongToBeatService.BASE_URL}game/${id}`, { headers }, signal)
    if (!response.ok) {
      throw new ScraperError(`Game page request failed with status ${response.status}`)
    }
    return response.text()
  }

  private async getAuthInfo(signal?: AbortSignal): Promise<InitResponse | null> {
    const userAgent = this.http.randomUserAgent()
    const headers = { 'User-Agent': userAgent, Referer: HowLongToBeatService.REFERER_HEADER }

    try {
      const response = await this.http.request(`${HowLongToBeatService.INIT_URL}?t=${Date.now()}`, { headers }, signal)
      if (!response.ok) return null

      const json = await response.json()
      if (json && json.token) {
        return { ...json, userAgent } as InitResponse
      }
      this.logger.error('Auth token not found in JSON response')
      return null
    } catch (error) {
      this.logger.error('Error fetching auth info:', error)
      return null
    }
  }

  static getSearchRequestHeaders(authInfo: InitResponse): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': authInfo.userAgent,
      Accept: '*/*',
      Referer: HowLongToBeatService.REFERER_HEADER,
      'X-Auth-Token': authInfo.token,
      'X-Hp-Key': authInfo.hpKey,
      'X-Hp-Val': authInfo.hpVal,
    }
  }

  static getSearchRequestData(
    searchKey: string,
    searchModifier: SearchModifier,
    page: number,
    initResponse: InitResponse,
  ): string {
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
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
          rangeYear: { min: '', max: '' },
          modifier: searchModifier,
        },
        users: { sortCategory: 'postcount' },
        lists: { sortCategory: 'follows' },
        filter: '',
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    }

    return JSON.stringify(payload)
  }
}
