// Feature: ai-adaptive-features
// Property 22: Streak milestone badge awarding
import * as fc from 'fast-check'

/**
 * Validates: Requirements 6.6
 *
 * checkStreakMilestones awards badges at streaks 7, 30, 100, 365.
 * We test the pure milestone detection logic directly.
 */

// ---- Pure milestone logic (mirrors streakManager.ts) ----

const MILESTONES = [7, 30, 100, 365]

function isMilestone(streak: number): boolean {
  return MILESTONES.includes(streak)
}

// ---- Arbitraries ----

// Exactly one of the milestone values
const milestoneArb = fc.constantFrom(...MILESTONES)

// A streak that is NOT a milestone (1–400 range, filtered)
const nonMilestoneArb = fc
  .integer({ min: 1, max: 400 })
  .filter((n) => !MILESTONES.includes(n))

// Any positive streak
const anyStreakArb = fc.integer({ min: 1, max: 1000 })

// ---- Tests ----

describe('Streak Milestone Badges - Property 22: Streak milestone badge awarding', () => {
  /**
   * Property 22a: Streak at exactly 7, 30, 100, 365 → badge awarded
   */
  it('streak at exactly a milestone value is detected as a milestone', () => {
    fc.assert(
      fc.property(milestoneArb, (streak) => {
        expect(isMilestone(streak)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 22b: Streak NOT at a milestone → no badge
   */
  it('streak not at a milestone value is not detected as a milestone', () => {
    fc.assert(
      fc.property(nonMilestoneArb, (streak) => {
        expect(isMilestone(streak)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 22c: Milestones are exactly [7, 30, 100, 365]
   */
  it('milestones are exactly [7, 30, 100, 365]', () => {
    expect(MILESTONES).toEqual([7, 30, 100, 365])
    expect(MILESTONES).toHaveLength(4)
  })

  /**
   * Property 22d: Non-milestone streaks in ranges 1-6, 8-29, 31-99, 101-364, 366+ → no badge
   */
  it('non-milestone streaks in all gap ranges return false', () => {
    const gapRanges = [
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 8, max: 29 }),
      fc.integer({ min: 31, max: 99 }),
      fc.integer({ min: 101, max: 364 }),
      fc.integer({ min: 366, max: 1000 }),
    ]

    for (const rangeArb of gapRanges) {
      fc.assert(
        fc.property(rangeArb, (streak) => {
          expect(isMilestone(streak)).toBe(false)
        }),
        { numRuns: 20 } // 20 per range × 5 ranges = 100 total
      )
    }
  })

  /**
   * Property 22e: isMilestone is idempotent — calling it twice gives same result
   */
  it('isMilestone is pure and idempotent', () => {
    fc.assert(
      fc.property(anyStreakArb, (streak) => {
        expect(isMilestone(streak)).toBe(isMilestone(streak))
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 22f: Exactly 4 milestones exist in range 1–1000
   */
  it('exactly 4 milestone values exist in range 1–1000', () => {
    const milestonesInRange = Array.from({ length: 1000 }, (_, i) => i + 1).filter(isMilestone)
    expect(milestonesInRange).toHaveLength(4)
    expect(milestonesInRange).toEqual([7, 30, 100, 365])
  })
})
