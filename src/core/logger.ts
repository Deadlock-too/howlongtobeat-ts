/**
 * Minimal logging surface. A library should never write to the consumer's
 * console unless they opt in, so the default logger is silent. Pass
 * `consoleLogger` (or your own implementation) through the service options to
 * observe retries and parsing failures.
 */
export interface Logger {
  error(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
}

export const silentLogger: Logger = {
  error() {},
  warn() {},
}

export const consoleLogger: Logger = {
  error: (message, ...args) => console.error(message, ...args),
  warn: (message, ...args) => console.warn(message, ...args),
}
