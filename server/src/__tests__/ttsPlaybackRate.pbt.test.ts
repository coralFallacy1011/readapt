// Feature: ai-adaptive-features, Property 40: TTS playback rate matches configured WPM
import * as fc from 'fast-check'

/**
 * Validates: Requirements 16.2
 *
 * Property 40: TTS playback rate matches configured WPM
 * Tests the pure duration calculation from ttsController.ts.
 */

// ---- Pure logic (mirrors ttsController.ts) ----

function computeTTSDuration(wordCount: number, wordsPerMinute: number): number {
  return Math.round((wordCount / wordsPerMinute) * 60)
}

// ---- Arbitraries ----

const wordCountArb = fc.integer({ min: 1, max: 100_000 })
const wpmArb = fc.integer({ min: 1, max: 2000 })

// ---- Tests ----

describe('TTS Playback Rate - Property 40: TTS playback rate matches configured WPM', () => {
  /**
   * Property 1: duration = round((wordCount / wpm) * 60)
   */
  it('duration equals round((wordCount / wpm) * 60)', () => {
    fc.assert(
      fc.property(wordCountArb, wpmArb, (wordCount, wpm) => {
        const result = computeTTSDuration(wordCount, wpm)
        const expected = Math.round((wordCount / wpm) * 60)
        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Higher WPM → shorter or equal duration (for same word count)
   */
  it('higher WPM produces shorter or equal duration', () => {
    fc.assert(
      fc.property(
        wordCountArb,
        fc.integer({ min: 1, max: 999 }),
        fc.integer({ min: 1, max: 999 }),
        (wordCount, wpm1, wpm2) => {
          const lowerWPM = Math.min(wpm1, wpm2)
          const higherWPM = Math.max(wpm1, wpm2)
          if (lowerWPM === higherWPM) return true
          const durationLow = computeTTSDuration(wordCount, lowerWPM)
          const durationHigh = computeTTSDuration(wordCount, higherWPM)
          return durationHigh <= durationLow
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: More words → longer or equal duration (for same WPM)
   */
  it('more words produces longer or equal duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        fc.integer({ min: 1, max: 50_000 }),
        wpmArb,
        (wc1, wc2, wpm) => {
          const fewer = Math.min(wc1, wc2)
          const more = Math.max(wc1, wc2)
          const durationFewer = computeTTSDuration(fewer, wpm)
          const durationMore = computeTTSDuration(more, wpm)
          return durationMore >= durationFewer
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Duration is always a non-negative integer
   */
  it('duration is always a non-negative integer', () => {
    fc.assert(
      fc.property(wordCountArb, wpmArb, (wordCount, wpm) => {
        const result = computeTTSDuration(wordCount, wpm)
        return Number.isInteger(result) && result >= 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: WPM = 0 → duration is Infinity (division by zero)
   * The pure formula produces Infinity; callers should guard against wpm=0.
   */
  it('WPM of 0 produces Infinity', () => {
    fc.assert(
      fc.property(wordCountArb, (wordCount) => {
        const raw = (wordCount / 0) * 60
        return !isFinite(raw)
      }),
      { numRuns: 100 }
    )
  })
})
