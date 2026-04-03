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
