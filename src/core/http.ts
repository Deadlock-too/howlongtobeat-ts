import { Logger, silentLogger } from './logger'

/** A `fetch`-compatible function. Defaults to the global `fetch`. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export interface HttpClientOptions {
  /** Custom fetch implementation (proxy, undici agent, test double, …). */
  fetch?: FetchLike
  /** Per-request timeout in milliseconds (default: 60000). */
  timeout?: number
  /** Number of additional attempts on transient failures (default: 2). */
  retries?: number
  /** Base backoff delay in milliseconds, grows exponentially (default: 500). */
  retryDelay?: number
  /** Upper bound for any single backoff delay (default: 10000). */
  maxRetryDelay?: number
  /** Pool of User-Agent strings; one is picked at random per request. */
  userAgents?: string[]
  /** Logger for retry/diagnostic messages (default: silent). */
  logger?: Logger
}

export const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
]

/**
 * Thin wrapper around `fetch` that centralises timeouts, retries with
 * exponential backoff, `429 Retry-After` handling, User-Agent rotation and
 * caller-supplied `AbortSignal` propagation.
 */
export class HttpClient {
  private readonly fetchFn: FetchLike
  private readonly timeout: number
  private readonly retries: number
  private readonly retryDelay: number
  private readonly maxRetryDelay: number
  private readonly userAgents: string[]
  private readonly logger: Logger

  constructor(options: HttpClientOptions = {}) {
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init))
    this.timeout = options.timeout ?? 60000
    this.retries = options.retries ?? 2
    this.retryDelay = options.retryDelay ?? 500
    this.maxRetryDelay = options.maxRetryDelay ?? 10000
    this.userAgents = options.userAgents?.length ? options.userAgents : DEFAULT_USER_AGENTS
    this.logger = options.logger ?? silentLogger
  }

  randomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)]
  }

  async request(input: string | URL, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    const headers = new Headers(init.headers)
    if (!headers.has('User-Agent')) headers.set('User-Agent', this.randomUserAgent())

    let attempt = 0
    while (true) {
      const { composedSignal, cleanup } = this.composeSignal(signal)
      try {
        const response = await this.fetchFn(input, { ...init, headers, signal: composedSignal })
        cleanup()

        if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
          const delay = this.retryAfter(response) ?? this.backoff(attempt)
          this.logger.warn(`Request to ${String(input)} returned ${response.status}; retrying in ${delay}ms`)
          await sleep(delay)
          attempt++
          continue
        }

        return response
      } catch (error) {
        cleanup()
        // The caller cancelled — surface it immediately without retrying.
        if (signal?.aborted) throw error

        if (attempt < this.retries) {
          const delay = this.backoff(attempt)
          this.logger.warn(`Request to ${String(input)} failed (${describe(error)}); retrying in ${delay}ms`)
          await sleep(delay)
          attempt++
          continue
        }
        throw error
      }
    }
  }

  private backoff(attempt: number): number {
    const base = this.retryDelay * 2 ** attempt
    const jitter = Math.random() * this.retryDelay
    return Math.min(base + jitter, this.maxRetryDelay)
  }

  private retryAfter(response: Response): number | undefined {
    const header = response.headers.get('retry-after')
    if (!header) return undefined

    const seconds = Number(header)
    if (!Number.isNaN(seconds)) return Math.min(seconds * 1000, this.maxRetryDelay)

    const date = Date.parse(header)
    if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), this.maxRetryDelay))

    return undefined
  }

  /** Combines an external signal with an internal timeout into one signal. */
  private composeSignal(external?: AbortSignal): { composedSignal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new DOMException('The request timed out', 'TimeoutError')),
      this.timeout,
    )

    const forwardAbort = () => controller.abort((external as AbortSignal).reason)
    if (external) {
      if (external.aborted) controller.abort(external.reason)
      else external.addEventListener('abort', forwardAbort, { once: true })
    }

    const cleanup = () => {
      clearTimeout(timer)
      external?.removeEventListener('abort', forwardAbort)
    }
    return { composedSignal: controller.signal, cleanup }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
