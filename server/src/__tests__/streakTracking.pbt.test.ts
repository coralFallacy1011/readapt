// Feature: ai-adaptive-features
// Property 20: Streak increment on consecutive days
// Property 21: Streak reset on missed day
import * as fc from 'fast-check'
import { daysDifference, formatDateInTimezone } from '../services/gamification/streakManager'

/**
 * Validates: Requirements 6.2, 6.3
 *
 * Pure streak update logic:
 *   if (daysSinceLastRead === 1) → increment streak
 *   if (daysSinceLastRead === 0) → no change (same day)
 *   if (daysSinceLastRead > 1)  → reset to 1
 */

// ---- Pure streak logic (mirrors streakManager.ts) ----

function applyStreakLogic(currentStreak: number, daysSinceLastRead: number): number {
  if (daysSinceLastRead === 1) return currentStreak + 1
  if (daysSinceLastRead === 0) return currentStreak
  return 1 // missed day(s)
}

// ---- Arbitraries ----

// YYYY-MM-DD date string for a date in a reasonable range
const dateStringArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString().slice(0, 10))

// Positive streak value
const streakArb = fc.integer({ min: 1, max: 365 })

// Number of days to add (1 = consecutive, 0 = same day, >1 = missed)
const consecutiveDaysArb = fc.integer({ min: 1, max: 3650 })

// ---- Helper: add N days to a YYYY-MM-DD string ----
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ---- Tests ----

describe('Streak Tracking - Property 20: Streak increment on consecutive days', () => {
  /**
   * Property 20a: daysDifference of 1 → streak increments by 1
   */
  it('consecutive day (diff=1) increments streak by 1', () => {
    fc.assert(
      fc.property(dateStringArb, streakArb, (lastRead, streak) => {
        const today = addDays(lastRead, 1)
        const diff = daysDifference(lastRead, today)
        expect(diff).toBe(1)
        const newStreak = applyStreakLogic(streak, diff)
        expect(newStreak).toBe(streak + 1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 20b: Same day (diff=0) → streak unchanged
   */
  it('same day (diff=0) leaves streak unchanged', () => {
    fc.assert(
      fc.property(dateStringArb, streakArb, (date, streak) => {
        const diff = daysDifference(date, date)
        expect(diff).toBe(0)
        const newStreak = applyStreakLogic(streak, diff)
        expect(newStreak).toBe(streak)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Streak Tracking - Property 21: Streak reset on missed day', () => {
  /**
   * Property 21a: Missed days (diff > 1) → streak resets to 1
   */
  it('missed days (diff>1) resets streak to 1', () => {
    fc.assert(
      fc.property(
        dateStringArb,
        streakArb,
        fc.integer({ min: 2, max: 3650 }),
        (lastRead, streak, gap) => {
          const today = addDays(lastRead, gap)
          const diff = daysDifference(lastRead, today)
          expect(diff).toBeGreaterThan(1)
          const newStreak = applyStreakLogic(streak, diff)
          expect(newStreak).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 21b: Streak after reset is always exactly 1
   */
  it('streak after any missed-day reset is always 1 regardless of prior streak', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 2, max: 3650 }),
        (streak, gap) => {
          const newStreak = applyStreakLogic(streak, gap)
          expect(newStreak).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('daysDifference - pure function properties', () => {
  /**
   * daysDifference always returns an integer
   */
  it('daysDifference always returns an integer', () => {
    fc.assert(
      fc.property(dateStringArb, dateStringArb, (d1, d2) => {
        const diff = daysDifference(d1, d2)
        expect(Number.isInteger(diff)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * daysDifference is antisymmetric: diff(d1, d2) === -diff(d2, d1)
   * Note: use numeric equality (==) to treat -0 and 0 as equal
   */
  it('daysDifference is antisymmetric (d1→d2 = -d2→d1)', () => {
    fc.assert(
      fc.property(dateStringArb, dateStringArb, (d1, d2) => {
        const forward = daysDifference(d1, d2)
        const backward = daysDifference(d2, d1)
        // Use + 0 to normalise -0 to 0 before comparison
        expect(forward + 0).toBe(-backward + 0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * daysDifference of consecutive days is exactly 1
   */
  it('daysDifference between a date and the next day is exactly 1', () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        const nextDay = addDays(date, 1)
        expect(daysDifference(date, nextDay)).toBe(1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * daysDifference of same date is 0
   */
  it('daysDifference of same date is 0', () => {
    fc.assert(
      fc.property(dateStringArb, (date) => {
        expect(daysDifference(date, date)).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})

describe('formatDateInTimezone - pure function properties', () => {
  const validTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

  /**
   * formatDateInTimezone always returns a YYYY-MM-DD string
   */
  it('always returns a YYYY-MM-DD formatted string', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.constantFrom(...validTimezones),
        (date, tz) => {
          const result = formatDateInTimezone(date, tz)
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
      ),
      { numRuns: 100 }
    )
  })
})
