/**
 * Returns the index of the Optimal Recognition Point (ORP) letter for a given word length.
 * - length 1–3: middle letter (floor(length / 2))
 * - length 4–7: slightly left of center (floor(length / 4))
 * - length 8+: center-left (floor(length / 3) - 1)
 */
export function getORPIndex(wordLength: number): number {
  if (wordLength <= 3) return Math.floor(wordLength / 2)
  if (wordLength <= 7) return Math.floor(wordLength / 4)
  return Math.floor(wordLength / 3) - 1
}

/**
 * Returns the ORP index for a word based on language-specific rules.
 *
 * Language rules (focus point as a fraction of word length):
 * - 'en' (English):  standard ORP calculation (getORPIndex)
 * - 'es' (Spanish):  40% of word length
 * - 'fr' (French):   40% of word length
 * - 'de' (German):   35% of word length (longer compound words)
 * - 'it' (Italian):  40% of word length
 * - default:         standard ORP calculation
 */
export function getLanguageSpecificORPIndex(word: string, language: string): number {
  const len = word.length
  if (len === 0) return 0

  switch (language) {
    case 'es':
    case 'fr':
    case 'it':
      return Math.min(Math.floor(len * 0.4), len - 1)
    case 'de':
      return Math.min(Math.floor(len * 0.35), len - 1)
    case 'en':
    default:
      return getORPIndex(len)
  }
}
