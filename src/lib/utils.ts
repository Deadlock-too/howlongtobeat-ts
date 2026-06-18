export { getSimilarity, getMatchScore, normalize } from '@deadlock-too/scrape-kit'

/**
 * Converts a HowLongToBeat duration (in seconds) to hours, rounded to
 * `decimals` places. Returns `undefined` for missing values so it composes
 * cleanly with the optional time fields on {@link HowLongToBeatEntry}.
 */
export function toHours(seconds: number | undefined, decimals = 1): number | undefined {
  if (seconds == null) return undefined
  const factor = 10 ** decimals
  return Math.round((seconds / 3600) * factor) / factor
}
