// Feature: ai-adaptive-features, Property 17: Reading endurance score calculation
import * as fc from 'fast-check'
import { calculateEnduranceScore } from '../services/ml/readingDNA'

/**
 * Validates: Requirements 4.5
 *
 * Property 17: Reading endurance score calculation
 * calculateEnduranceScore(avgSessionDurationMinutes, currentStreak):
 *   streakBonus = min(currentStreak / 30, 1.0)
 *   return (avgSessionDurationMinutes / 30) * (1 + streakBonus)
 */

// ---- Arbitraries ----

// Non-negative duration in minutes (0 to 120)
const durationArb = fc.double({ min: 0, max: 120, noNaN: true })

// Non-negative streak in days (0 to 365)
const streakArb = fc.integer({ min: 0, max: 365 })

// Streak >= 30 (at cap)
const cappedStreakArb = fc.integer({ min: 30, max: 365 })

// ---- Tests ----

describe('Endurance Score - Property 17: Reading endurance score calculation', () => {
  /**
   * Property 1: Core formula matches expected calculation
   */
  it('result equals (avgDuration / 30) * (1 + min(streak/30, 1.0))', () => {
    fc.assert(
      fc.property(durationArb, streakArb, (duration, streak) => {
        const expected = (duration / 30) * (1 + Math.min(streak / 30, 1.0))
        const result = calculateEnduranceScore(duration, streak)
        return Math.abs(result - expected) < 1e-10
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Streak bonus is capped at 1.0 (streak >= 30 gives same bonus as streak = 30)
   */
  it('streak >= 30 gives same score as streak = 30', () => {
    fc.assert(
      fc.property(durationArb, cappedStreakArb, (duration, streak) => {
        const atCap = calculateEnduranceScore(duration, 30)
        const aboveCap = calculateEnduranceScore(duration, streak)
        return Math.abs(atCap - aboveCap) < 1e-10
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Zero duration → score = 0
   */
  it('zero duration always produces score of 0', () => {
    fc.assert(
      fc.property(streakArb, (streak) => {
        const result = calculateEnduranceScore(0, streak)
        return result === 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Score is always non-negative
   */
  it('score is always non-negative', () => {
    fc.assert(
      fc.property(durationArb, streakArb, (duration, streak) => {
        return calculateEnduranceScore(duration, streak) >= 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Longer sessions → higher score (monotonic in duration)
   */
  it('longer sessions produce higher scores (monotonic in duration)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 119, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        streakArb,
        (baseDuration, delta, streak) => {
          const longerDuration = baseDuration + delta
          const scoreBase = calculateEnduranceScore(baseDuration, streak)
          const scoreLonger = calculateEnduranceScore(longerDuration, streak)
          return scoreLonger >= scoreBase
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Higher streak → higher score (monotonic in streak, up to cap)
   */
  it('higher streak produces higher or equal score (monotonic up to cap)', () => {
    fc.assert(
      fc.property(
        durationArb,
        fc.integer({ min: 0, max: 29 }),
        fc.integer({ min: 0, max: 29 }),
        (duration, streakA, streakB) => {
          const lower = Math.min(streakA, streakB)
          const higher = Math.max(streakA, streakB)
          const scoreLower = calculateEnduranceScore(duration, lower)
          const scoreHigher = calculateEnduranceScore(duration, higher)
          return scoreHigher >= scoreLower
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Boundary: streak = 0 gives no bonus (factor = 1.0)
   */
  it('streak = 0 gives no bonus (score = duration / 30)', () => {
    fc.assert(
      fc.property(durationArb, (duration) => {
        const result = calculateEnduranceScore(duration, 0)
        const expected = duration / 30
        return Math.abs(result - expected) < 1e-10
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Boundary: streak = 30 gives maximum bonus (factor = 2.0)
   */
  it('streak = 30 gives maximum bonus (score = duration / 30 * 2)', () => {
    fc.assert(
      fc.property(durationArb, (duration) => {
        const result = calculateEnduranceScore(duration, 30)
        const expected = (duration / 30) * 2
        return Math.abs(result - expected) < 1e-10
      }),
      { numRuns: 100 }
    )
  })
})
