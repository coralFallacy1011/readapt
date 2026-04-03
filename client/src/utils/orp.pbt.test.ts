import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { getORPIndex } from './orp'

// Feature: readapt-rsvp-platform, Property 1: ORP index is always within word bounds

describe('ORP property-based tests', () => {
  /**
   * Property 1: ORP index is always within word bounds
   * Validates: Requirements 6.1, 6.2, 6.3
   *
   * For any word of length >= 1, getORPIndex(word.length) must return
   * a value in the range [0, word.length - 1].
   */
  it('Property 1: ORP index is always within word bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        (wordLength) => {
          const idx = getORPIndex(wordLength)
          return idx >= 0 && idx <= wordLength - 1
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: readapt-rsvp-platform, Property 2: ORP index satisfies length-bracket rules

  /**
   * Property 2: ORP index satisfies length-bracket rules
   * Validates: Requirements 6.1, 6.2, 6.3
   *
   * For any word length, getORPIndex must return the exact value defined
   * by the bracket rule for that length:
   * - length 1–3  → floor(length / 2)
   * - length 4–7  → floor(length / 4)
   * - length 8+   → floor(length / 3) - 1
   */
  it('Property 2 (Req 6.1): length 1–3 → index equals floor(length / 2)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (wordLength) => {
          return getORPIndex(wordLength) === Math.floor(wordLength / 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2 (Req 6.2): length 4–7 → index equals floor(length / 4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 7 }),
        (wordLength) => {
          return getORPIndex(wordLength) === Math.floor(wordLength / 4)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2 (Req 6.3): length 8+ → index equals floor(length / 3) - 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 10_000 }),
        (wordLength) => {
          return getORPIndex(wordLength) === Math.floor(wordLength / 3) - 1
        }
      ),
      { numRuns: 100 }
    )
  })
})
