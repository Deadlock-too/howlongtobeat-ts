import { parseGamePage, parseJsonResult } from './parser'
import { EntryResult, SearchResult, SearchModifier } from './types'
import {
  BaseScraperService,
  HttpError,
  ScraperError,
  ScraperOptions,
  fail,
  failFrom,
  ok,
} from '@deadlock-too/scrape-kit'

/** Names the remote source in generated failure messages. */
const SUBJECT = 'HowLongToBeat'

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
      return fail('Search key is empty', { kind: 'input' })
    }

    // Fetching and parsing are caught separately: collapsing them into one
    // `try` is what made a dead socket report itself as a parse failure.
    let body: string
    try {
      body = await this.sendSearchRequest(searchKey, options)
    } catch (error) {
      this.logger.error('HowLongToBeat search request failed:', error)
      return failFrom(error, SUBJECT)
    }

    try {
      return ok(parseJsonResult(body, searchKey, this.minSimilarity))
    } catch (error) {
      this.logger.error('Failed to parse the HowLongToBeat search response:', error)
      return failFrom(error, SUBJECT, 'parse')
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
      return fail('A valid game id is required', { kind: 'input' })
    }

    let html: string
    try {
      html = await this.sendGamePageRequest(id, options.signal)
    } catch (error) {
      this.logger.error('HowLongToBeat game page request failed:', error)
      return failFrom(error, SUBJECT)
    }

    try {
      return ok(parseGamePage(html, id))
    } catch (error) {
      this.logger.error('Failed to parse the HowLongToBeat game page:', error)
      return failFrom(error, SUBJECT, 'parse')
    }
  }

  private async sendSearchRequest(searchKey: string, options: HltbSearchOptions): Promise<string> {
    const authInfo = await this.getAuthInfo(options.signal)
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
      throw new HttpError(`Search request failed with status ${response.status}`, response.status)
    }
    return response.text()
  }

  private async sendGamePageRequest(id: number, signal?: AbortSignal): Promise<string> {
    const headers = {
      'User-Agent': this.http.randomUserAgent(),
      Referer: HowLongToBeatService.REFERER_HEADER,
    }
    const response = await this.http.request(`${HowLongToBeatService.BASE_URL}game/${id}`, { headers }, signal)
    if (!response.ok) {
      throw new HttpError(`Game page request failed with status ${response.status}`, response.status)
    }
    return response.text()
  }

  /**
   * Fetches the short-lived credentials the search endpoint requires.
   *
   * This throws rather than returning `null`: it is the request most likely to
   * be the one a caller actually hits (HowLongToBeat blocks datacentre IP
   * ranges here), and swallowing the reason left a 403, a DNS failure and a
   * restructured init payload indistinguishable from one another.
   */
  private async getAuthInfo(signal?: AbortSignal): Promise<InitResponse> {
    const userAgent = this.http.randomUserAgent()
    const headers = { 'User-Agent': userAgent, Referer: HowLongToBeatService.REFERER_HEADER }

    const response = await this.http.request(`${HowLongToBeatService.INIT_URL}?t=${Date.now()}`, { headers }, signal)
    if (!response.ok) {
      throw new HttpError(`Init request failed with status ${response.status}`, response.status)
    }

    let json: { token?: unknown }
    try {
      json = (await response.json()) as { token?: unknown }
    } catch (error) {
      throw new ScraperError('Failed to parse the HowLongToBeat init response as JSON', error)
    }

    if (!json || !json.token) {
      throw new ScraperError(
        'Unexpected HowLongToBeat init response: no auth token (the site structure may have changed)',
      )
    }
    return { ...json, userAgent } as InitResponse
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
