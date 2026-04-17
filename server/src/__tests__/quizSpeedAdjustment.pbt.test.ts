// Feature: ai-adaptive-features
// Property 35: Low comprehension triggers speed reduction
// Property 36: High comprehension triggers speed increase
// Validates: Requirements 12.9, 12.10

import * as fc from 'fast-check'
import {
  getSpeedAdjustmentFactor,
  hasThreeConsecutiveHighScores,
} from '../services/ml/quizSpeedAdjuster'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Any integer score in [0, 59] — triggers the low-comprehension path */
const lowScoreArb = fc.integer({ min: 0, max: 59 })

/** Any integer score in [60, 79] — neutral zone */
const neutralScoreArb = fc.integer({ min: 60, max: 79 })

/** Any integer score in [80, 100] — high-comprehension zone */
const highScoreArb = fc.integer({ min: 80, max: 100 })

/** At least 2 prior scores, all >= 80 */
const twoOrMoreHighPriorScoresArb = fc.array(
  fc.integer({ min: 80, max: 100 }),
  { minLength: 2 }
)

/** Exactly 1 prior score >= 80 */
const oneHighPriorScoreArb = fc.tuple(
  fc.integer({ min: 80, max: 100 })
).map(([s]) => [s])

/** Empty prior scores array */
const noPriorScoresArb = fc.constant([] as number[])

/** Any WPM value in a realistic range */
const wpmArb = fc.integer({ min: 100, max: 1000 })

// ---------------------------------------------------------------------------
// Property 35 — Low comprehension triggers speed reduction (Req 12.9)
// ---------------------------------------------------------------------------

describe('Property 35: Low comprehension triggers speed reduction', () => {
  /**
   * Validates: Requirements 12.9
   *
   * 35a: Any score < 60 always returns factor 0.8
   */
  it('any score < 60 returns factor 0.8', () => {
    fc.assert(
      fc.property(lowScoreArb, fc.array(fc.integer({ min: 0, max: 100 })), (score, recent) => {
        expect(getSpeedAdjustmentFactor(score, recent)).toBe(0.8)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.9
   *
   * 35b: Score exactly 59 returns 0.8
   */
  it('score exactly 59 returns factor 0.8', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 })), (recent) => {
        expect(getSpeedAdjustmentFactor(59, recent)).toBe(0.8)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.9
   *
   * 35c: Score exactly 60 does NOT return 0.8 (boundary — returns 1.0 or 1.1)
   */
  it('score exactly 60 does not return factor 0.8', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 })), (recent) => {
        const factor = getSpeedAdjustmentFactor(60, recent)
        expect(factor).not.toBe(0.8)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.9
   *
   * 35d: Factor 0.8 means 20% WPM reduction — newWPM = round(currentWPM * 0.8)
   */
  it('factor 0.8 produces a 20% WPM reduction', () => {
    fc.assert(
      fc.property(wpmArb, (currentWPM) => {
        const factor = 0.8
        const newWPM = Math.round(currentWPM * factor)
        expect(newWPM).toBe(Math.round(currentWPM * 0.8))
        // Verify it is strictly less than the original WPM
        expect(newWPM).toBeLessThan(currentWPM)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 36 — High comprehension triggers speed increase (Req 12.10)
// ---------------------------------------------------------------------------

describe('Property 36: High comprehension triggers speed increase', () => {
  /**
   * Validates: Requirements 12.10
   *
   * 36a: Score >= 80 with 2+ prior scores >= 80 returns factor 1.1
   */
  it('score >= 80 with 2+ prior high scores returns factor 1.1', () => {
    fc.assert(
      fc.property(highScoreArb, twoOrMoreHighPriorScoresArb, (score, recent) => {
        expect(getSpeedAdjustmentFactor(score, recent)).toBe(1.1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.10
   *
   * 36b: Score >= 80 with no prior scores returns 1.0 (not enough history)
   */
  it('score >= 80 with no prior scores returns factor 1.0', () => {
    fc.assert(
      fc.property(highScoreArb, (score) => {
        expect(getSpeedAdjustmentFactor(score, [])).toBe(1.0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.10
   *
   * 36c: Score >= 80 with only 1 prior score returns 1.0 (not enough history)
   */
  it('score >= 80 with only 1 prior score returns factor 1.0', () => {
    fc.assert(
      fc.property(highScoreArb, oneHighPriorScoreArb, (score, recent) => {
        expect(getSpeedAdjustmentFactor(score, recent)).toBe(1.0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.10
   *
   * 36d: Score exactly 80 with 2 prior scores of exactly 80 returns factor 1.1
   */
  it('score exactly 80 with 2 prior scores of 80 returns factor 1.1', () => {
    expect(getSpeedAdjustmentFactor(80, [80, 80])).toBe(1.1)
  })

  /**
   * Validates: Requirements 12.10
   *
   * 36e: Factor 1.1 means 10% WPM increase — newWPM = round(currentWPM * 1.1)
   */
  it('factor 1.1 produces a 10% WPM increase', () => {
    fc.assert(
      fc.property(wpmArb, (currentWPM) => {
        const factor = 1.1
        const newWPM = Math.round(currentWPM * factor)
        expect(newWPM).toBe(Math.round(currentWPM * 1.1))
        // Verify it is strictly greater than the original WPM
        expect(newWPM).toBeGreaterThan(currentWPM)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 12.10
   *
   * 36f: Score in [60, 79] always returns 1.0 (neutral zone — no adjustment)
   */
  it('score in [60, 79] always returns factor 1.0', () => {
    fc.assert(
      fc.property(neutralScoreArb, fc.array(fc.integer({ min: 0, max: 100 })), (score, recent) => {
        expect(getSpeedAdjustmentFactor(score, recent)).toBe(1.0)
      }),
      { numRuns: 100 }
    )
  })
})
