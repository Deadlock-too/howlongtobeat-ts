/**
 * Error thrown when an upstream response cannot be understood — typically
 * because the remote website changed its structure. The message is meant to be
 * surfaced to the consumer (via a `Failure` result) so that breakages are
 * actionable rather than cryptic.
 */
export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ScraperError'
  }
}
