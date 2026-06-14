import { HttpClient, HttpClientOptions } from './http'
import { Logger, silentLogger } from './logger'

export interface ScraperOptions extends HttpClientOptions {
  /**
   * Minimum similarity (0–1) a result must reach to be kept. Values outside the
   * range are clamped. Default: 0.5.
   */
  minSimilarity?: number
}

/**
 * Shared base for the scraper services. Owns the HTTP client, the logger and
 * the (validated) similarity threshold so the concrete services only deal with
 * site-specific request/parse logic.
 */
export abstract class BaseScraperService {
  protected readonly http: HttpClient
  protected readonly logger: Logger
  protected readonly minSimilarity: number

  protected constructor(options: number | ScraperOptions = {}) {
    // `number` is accepted for backwards compatibility with the old
    // `new Service(minSimilarity)` constructor.
    const opts: ScraperOptions = typeof options === 'number' ? { minSimilarity: options } : options
    this.minSimilarity = clampSimilarity(opts.minSimilarity ?? 0.5)
    this.logger = opts.logger ?? silentLogger
    this.http = new HttpClient({ ...opts, logger: this.logger })
  }
}

export function clampSimilarity(value: number): number {
  if (Number.isNaN(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}
