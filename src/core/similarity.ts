/**
 * Lowercases and strips accents/punctuation so that titles that differ only in
 * formatting (e.g. "Pokémon", "Marvel's Spider-Man") compare equal.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Normalised Levenshtein similarity in the range [0, 1]. Kept as a stable,
 * predictable primitive — `getMatchScore` builds on top of it for search.
 */
export function getSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0

  const str1 = a.toLowerCase()
  const str2 = b.toLowerCase()
  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)
  return (maxLength - distance) / maxLength
}

/**
 * Search-oriented similarity. Combines edit distance with token containment so
 * that a short query still scores well against a longer title — e.g. searching
 * "Zelda" against "The Legend of Zelda: Tears of the Kingdom" is no longer
 * filtered out by a low raw edit-distance score.
 */
export function getMatchScore(candidate: string, query: string): number {
  if (!candidate || !query) return 0

  const normalizedCandidate = normalize(candidate)
  const normalizedQuery = normalize(query)
  if (normalizedCandidate === normalizedQuery) return 1

  const editScore = getSimilarity(normalizedCandidate, normalizedQuery)

  const candidateTokens = new Set(normalizedCandidate.split(' ').filter(Boolean))
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  if (queryTokens.length === 0) return editScore

  const queryTokenSet = new Set(queryTokens)
  let intersection = 0
  for (const token of queryTokenSet) {
    if (candidateTokens.has(token)) intersection++
  }

  const contained = queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length
  const dice = (2 * intersection) / (queryTokenSet.size + candidateTokens.size)
  // A full containment match is worth at least 0.5, scaled up by how much of the
  // candidate the query covers (so tighter titles rank above looser ones).
  const tokenScore = contained * (0.5 + 0.5 * dice)

  return Math.max(editScore, tokenScore)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Two-row buffer instead of a full n×m matrix.
  let previous = new Array<number>(a.length + 1)
  let current = new Array<number>(a.length + 1)
  for (let j = 0; j <= a.length; j++) previous[j] = j

  for (let i = 1; i <= b.length; i++) {
    current[0] = i
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    ;[previous, current] = [current, previous]
  }

  return previous[a.length]
}
