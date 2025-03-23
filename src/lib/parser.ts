import { HowLongToBeatEntry, HowLongToBeatJsonResult, HowLongToBeatResultEntry } from './types'
import { getSimilarity } from './utils'

const IMAGE_URL_PREFIX = 'https://howlongtobeat.com/games/'

export function parseJsonResult(jsonString: string, searchKey: string, minSimilarity: number): HowLongToBeatEntry[] {
  try {
    const parsedData = JSON.parse(jsonString) as HowLongToBeatJsonResult
    const entries: HowLongToBeatEntry[] = []

    for (const data of parsedData.data) {
      const entry = mapEntry(data, searchKey)

      if (entry.similarity < minSimilarity) {
        continue
      }
      entries.push(entry)
    }

    return entries.sort((a, b) => b.similarity - a.similarity)
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return []
  }
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
    json: JSON.stringify(data),
    imageUrl: data.game_image ? IMAGE_URL_PREFIX + data.game_image : undefined,
    similarity: Math.max(getSimilarity(data.game_name, searchKey), getSimilarity(data.game_alias, searchKey))
  }
}
