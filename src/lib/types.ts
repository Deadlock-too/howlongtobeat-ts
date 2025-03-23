export type HowLongToBeatJsonResult = {
  color: string
  title: string
  category: string
  count: number
  pageCurrent: number
  pageTotal: number
  pageSize: number
  data: HowLongToBeatResultEntry[]
  userData: any[]
  displayModifier: string
}

export enum SearchModifier {
  NONE = '',
  ONLY_DLC = 'only_dlc',
  HIDE_DLC = 'hide_dlc',
}

export type HowLongToBeatEntry = {
  id: number
  name: string
  alias: string
  type: string
  mainTime?: number
  mainExtraTime?: number
  completionistTime?: number
  allStylesTime?: number
  coopTime?: number
  multiplayerTime?: number
  mainCount?: number
  mainExtraCount?: number
  completionistCount?: number
  allStylesCount?: number
  coopCount?: number
  multiplayerCount?: number
  imageUrl?: string
  reviewScore: number
  platforms: string[]
  similarity: number
  json: string
  releaseYear: number
}

export type HowLongToBeatResultEntry = {
  game_id: number
  game_name: string
  game_name_date: number
  game_alias: string
  game_type: string
  game_image: string
  comp_lvl_combine: number
  comp_lvl_sp: number
  comp_lvl_co: number
  comp_lvl_mp: number
  comp_main: number
  comp_plus: number
  comp_100: number
  comp_all: number
  comp_main_count: number
  comp_plus_count: number
  comp_100_count: number
  comp_all_count: number
  invested_co: number
  invested_mp: number
  invested_co_count: number
  invested_mp_count: number
  count_comp: number
  count_speedrun: number
  count_backlog: number
  count_review: number
  review_score: number
  count_playing: number
  count_retired: number
  profile_platform: string
  profile_popular: number
  release_world: number
}
