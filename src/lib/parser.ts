import { HowLongToBeatEntry, HowLongToBeatJsonResult, HowLongToBeatResultEntry } from './types'
import { getMatchScore, ScraperError } from '@deadlock-too/scrape-kit'

const IMAGE_URL_PREFIX = 'https://howlongtobeat.com/games/'

export function parseJsonResult(jsonString: string, searchKey: string, minSimilarity: number): HowLongToBeatEntry[] {
  let parsedData: HowLongToBeatJsonResult
  try {
    parsedData = JSON.parse(jsonString) as HowLongToBeatJsonResult
  } catch (error) {
    throw new ScraperError('Failed to parse the HowLongToBeat response as JSON', error)
  }

  if (!parsedData || !Array.isArray(parsedData.data)) {
    throw new ScraperError(
      'Unexpected HowLongToBeat response: missing "data" array (the site structure may have changed)',
    )
  }

  const entries: HowLongToBeatEntry[] = []
  for (const data of parsedData.data) {
    const entry = mapEntry(data, searchKey)
    if (entry.similarity < minSimilarity) {
      continue
    }
    entries.push(entry)
  }

  return entries.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Parses a HowLongToBeat game page (the Next.js `__NEXT_DATA__` payload) and
 * extracts the entry whose `game_id` matches `id`.
 *
 * The lookup walks the embedded JSON tolerantly rather than assuming a fixed
 * path, which keeps it resilient to minor page restructures.
 */
export function parseGamePage(html: string, id: number): HowLongToBeatEntry | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) {
    throw new ScraperError('Could not locate game data in the HowLongToBeat page (the site structure may have changed)')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch (error) {
    throw new ScraperError('Failed to parse the HowLongToBeat game page payload as JSON', error)
  }

  const gameData = findGameObject(parsed, id)
  if (!gameData) return null

  // findGameObject only matches nodes whose game_name is a string.
  return mapEntry(gameData, gameData.game_name)
}

function findGameObject(node: unknown, id: number): HowLongToBeatResultEntry | undefined {
  if (!node || typeof node !== 'object') return undefined

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findGameObject(item, id)
      if (found) return found
    }
    return undefined
  }

  const obj = node as Record<string, unknown>
  if (obj.game_id === id && typeof obj.game_name === 'string') {
    return obj as unknown as HowLongToBeatResultEntry
  }

  for (const key of Object.keys(obj)) {
    const found = findGameObject(obj[key], id)
    if (found) return found
  }
  return undefined
}

function mapEntry(data: HowLongToBeatResultEntry, searchKey: string): HowLongToBeatEntry {
  return {
    id: data.game_id,
    name: data.game_name,
    alias: data.game_alias,
    type: data.game_type,
    reviewScore: data.review_score,
    mainTime: data.comp_lvl_sp ? data.comp_main : undefined,
    mainExtraTime: data.comp_lvl_sp ? data.comp_plus : undefined,
    completionistTime: data.comp_lvl_sp ? data.comp_100 : undefined,
    allStylesTime: data.comp_lvl_sp ? data.comp_all : undefined,
    coopTime: data.comp_lvl_co ? data.invested_co : undefined,
    multiplayerTime: data.comp_lvl_mp ? data.invested_mp : undefined,
    mainCount: data.comp_lvl_sp ? data.comp_main_count : undefined,
    mainExtraCount: data.comp_lvl_sp ? data.comp_plus_count : undefined,
    completionistCount: data.comp_lvl_sp ? data.comp_100_count : undefined,
    allStylesCount: data.comp_lvl_sp ? data.comp_all_count : undefined,
    coopCount: data.comp_lvl_co ? data.invested_co_count : undefined,
    multiplayerCount: data.comp_lvl_mp ? data.invested_mp_count : undefined,
    platforms: data.profile_platform ? data.profile_platform.split(', ') : [],
    releaseYear: data.release_world,
    raw: data,
    imageUrl: data.game_image ? IMAGE_URL_PREFIX + data.game_image : undefined,
    similarity: Math.max(getMatchScore(data.game_name, searchKey), getMatchScore(data.game_alias, searchKey)),
  }
}
