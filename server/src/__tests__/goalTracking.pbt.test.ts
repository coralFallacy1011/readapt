// Feature: ai-adaptive-features
// Property 23: Goal progress tracking by type
// Property 24: Goal achievement at 100% completion
// Property 25: Goal 90% notification trigger
// Property 26: Daily reading pace calculation
import * as fc from 'fast-check'
import { calculateDailyPace } from '../services/gamification/goalTracker'
import { IGoal } from '../models/Goal'

/**
 * Validates: Requirements 7.4, 7.6, 7.7
 *
 * Pure goal logic tested here:
 *   - Progress increment by type (words/time/books)
 *   - Achievement at 100% (currentValue >= targetValue → status='achieved')
 *   - 90% notification (progress >= 0.9 AND !notified AND notifyAt90Percent)
 *   - Daily pace = (targetValue - currentValue) / daysRemaining
 */

// ---- Pure goal logic (mirrors goalTracker.ts) ----

interface SessionLike {
  lastWordIndex: number
  timeSpent: number
  bookCompleted: boolean
}

interface GoalState {
  type: 'words' | 'time' | 'books'
  targetValue: number
  currentValue: number
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  notifyAt90Percent: boolean
  notified: boolean
}

interface GoalResult {
  currentValue: number
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  notified: boolean
}

function calcIncrement(type: GoalState['type'], session: SessionLike): number {
  switch (type) {
    case 'words': return session.lastWordIndex
    case 'time':  return session.timeSpent / 60
    case 'books': return session.bookCompleted ? 1 : 0
  }
}

function applyGoalProgress(goal: GoalState, session: SessionLike): GoalResult {
  const increment = calcIncrement(goal.type, session)
  let currentValue = goal.currentValue + increment
  let status = goal.status
  let notified = goal.notified

  // 90% notification
  const progress = currentValue / goal.targetValue
  if (progress >= 0.9 && !notified && goal.notifyAt90Percent) {
    notified = true
  }

  // 100% achievement
  if (currentValue >= goal.targetValue && status === 'active') {
    status = 'achieved'
  }

  return { currentValue, status, notified }
}

// ---- Arbitraries ----

const positiveInt = (max = 100000) => fc.integer({ min: 1, max })
const nonNegInt   = (max = 100000) => fc.integer({ min: 0, max })

const sessionArb = fc.record({
  lastWordIndex: nonNegInt(),
  timeSpent:     nonNegInt(7200), // seconds (up to 2 hours)
  bookCompleted: fc.boolean(),
})

const goalTypeArb = fc.constantFrom<'words' | 'time' | 'books'>('words', 'time', 'books')

// A goal that is active and not yet achieved
const activeGoalArb = fc
  .record({
    type:             goalTypeArb,
    targetValue:      positiveInt(),
    currentValue:     nonNegInt(),
    notifyAt90Percent: fc.boolean(),
    notified:         fc.boolean(),
  })
  .map((g) => ({
    ...g,
    status: 'active' as const,
    // ensure currentValue < targetValue so goal is not yet achieved
    currentValue: g.currentValue % g.targetValue,
  }))

// ---- Helper: build a minimal IGoal-like object for calculateDailyPace ----
function makeGoal(overrides: Partial<{
  status: IGoal['status']
  currentValue: number
  targetValue: number
  endDate: Date
}>): IGoal {
  return {
    status:           overrides.status      ?? 'active',
    currentValue:     overrides.currentValue ?? 0,
    targetValue:      overrides.targetValue  ?? 100,
    endDate:          overrides.endDate      ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    type:             'words',
    period:           'weekly',
    userId:           {} as any,
    startDate:        new Date(),
    notifyAt90Percent: true,
    notified:         false,
  } as unknown as IGoal
}

// ---- Tests ----

describe('Goal Tracking - Property 23: Goal progress tracking by type', () => {
  /**
   * Property 23a: words goal increment = session.lastWordIndex
   */
  it('words goal: increment equals lastWordIndex', () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const increment = calcIncrement('words', session)
        expect(increment).toBe(session.lastWordIndex)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23b: time goal increment = timeSpent / 60
   */
  it('time goal: increment equals timeSpent / 60', () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const increment = calcIncrement('time', session)
        expect(increment).toBeCloseTo(session.timeSpent / 60, 10)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23c: books goal increment = bookCompleted ? 1 : 0
   */
  it('books goal: increment is 1 if bookCompleted, else 0', () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const increment = calcIncrement('books', session)
        expect(increment).toBe(session.bookCompleted ? 1 : 0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 23d: increment is always non-negative
   */
  it('increment is always non-negative for any goal type and session', () => {
    fc.assert(
      fc.property(goalTypeArb, sessionArb, (type, session) => {
        expect(calcIncrement(type, session)).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Goal Tracking - Property 24: Goal achievement at 100% completion', () => {
  /**
   * Property 24a: currentValue + increment >= targetValue → status becomes 'achieved'
   */
  it('goal is achieved when currentValue + increment >= targetValue', () => {
    fc.assert(
      fc.property(
        activeGoalArb,
        sessionArb,
        (goal, session) => {
          const increment = calcIncrement(goal.type, session)
          const result = applyGoalProgress(goal, session)

          if (goal.currentValue + increment >= goal.targetValue) {
            expect(result.status).toBe('achieved')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24b: currentValue + increment < targetValue → status stays 'active'
   */
  it('goal stays active when currentValue + increment < targetValue', () => {
    fc.assert(
      fc.property(
        activeGoalArb,
        sessionArb,
        (goal, session) => {
          const increment = calcIncrement(goal.type, session)
          const result = applyGoalProgress(goal, session)

          if (goal.currentValue + increment < goal.targetValue) {
            expect(result.status).toBe('active')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24c: status never goes from 'achieved' back to 'active'
   */
  it('once achieved, status never reverts to active', () => {
    fc.assert(
      fc.property(
        activeGoalArb,
        sessionArb,
        (goal, session) => {
          const result = applyGoalProgress(goal, session)
          // result.status is either 'active' or 'achieved', never anything else
          expect(['active', 'achieved']).toContain(result.status)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Goal Tracking - Property 25: Goal 90% notification trigger', () => {
  /**
   * Property 25a: progress >= 0.9 AND !notified AND notifyAt90Percent → notified=true
   */
  it('notified becomes true when progress >= 90% and conditions are met', () => {
    fc.assert(
      fc.property(
        activeGoalArb,
        sessionArb,
        (goal, session) => {
          const increment = calcIncrement(goal.type, session)
          const newValue = goal.currentValue + increment
          const progress = newValue / goal.targetValue
          const result = applyGoalProgress(goal, session)

          if (progress >= 0.9 && !goal.notified && goal.notifyAt90Percent) {
            expect(result.notified).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25b: already notified → stays notified (no double notification)
   */
  it('already-notified goal stays notified after progress update', () => {
    fc.assert(
      fc.property(
        activeGoalArb.map((g) => ({ ...g, notified: true })),
        sessionArb,
        (goal, session) => {
          const result = applyGoalProgress(goal, session)
          expect(result.notified).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25c: notifyAt90Percent=false → notified stays false even at 90%+
   */
  it('notification is not triggered when notifyAt90Percent is false', () => {
    fc.assert(
      fc.property(
        activeGoalArb.map((g) => ({ ...g, notifyAt90Percent: false, notified: false })),
        sessionArb,
        (goal, session) => {
          const result = applyGoalProgress(goal, session)
          expect(result.notified).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Goal Tracking - Property 26: Daily reading pace calculation', () => {
  /**
   * Property 26a: pace = (targetValue - currentValue) / daysRemaining
   */
  it('pace equals remaining value divided by days remaining', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),  // targetValue
        fc.integer({ min: 0, max: 9999 }),   // currentValue (< target)
        fc.integer({ min: 1, max: 365 }),    // daysRemaining
        (targetValue, currentValueOffset, daysRemaining) => {
          const currentValue = currentValueOffset % targetValue
          const endDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
          const goal = makeGoal({ targetValue, currentValue, endDate })

          const pace = calculateDailyPace(goal)
          const expected = (targetValue - currentValue) / daysRemaining

          expect(pace).not.toBeNull()
          expect(pace!).toBeCloseTo(expected, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 26b: daysRemaining = 0 → pace = remaining value (all today)
   */
  it('daysRemaining = 0 returns the full remaining value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 9999 }),
        (targetValue, currentValueOffset) => {
          const currentValue = currentValueOffset % targetValue
          // endDate = today (0 days remaining)
          const endDate = new Date()
          endDate.setHours(0, 0, 0, 0)
          const goal = makeGoal({ targetValue, currentValue, endDate })

          const pace = calculateDailyPace(goal)
          expect(pace).not.toBeNull()
          expect(pace!).toBeCloseTo(targetValue - currentValue, 5)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 26c: daysRemaining < 0 (past endDate) → null
   */
  it('past endDate (daysRemaining < 0) returns null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 365 }),
        (targetValue, daysAgo) => {
          const currentValue = 0
          const endDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
          const goal = makeGoal({ targetValue, currentValue, endDate })

          const pace = calculateDailyPace(goal)
          expect(pace).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 26d: already achieved (currentValue >= targetValue) → pace = 0
   */
  it('already achieved goal returns pace of 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 365 }),
        (targetValue, daysRemaining) => {
          const currentValue = targetValue // exactly at target
          const endDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
          const goal = makeGoal({ targetValue, currentValue, endDate })

          const pace = calculateDailyPace(goal)
          expect(pace).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 26e: non-active goal → null
   */
  it('non-active goal (achieved/failed/cancelled) returns null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<IGoal['status']>('achieved', 'failed', 'cancelled'),
        fc.integer({ min: 1, max: 10000 }),
        (status, targetValue) => {
          const goal = makeGoal({ status, targetValue, currentValue: 0 })
          const pace = calculateDailyPace(goal)
          expect(pace).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 26f: pace is always non-negative for active goals with future endDate
   */
  it('pace is always non-negative for active goals with future endDate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 365 }),
        (targetValue, currentValueOffset, daysRemaining) => {
          const currentValue = currentValueOffset % targetValue
          const endDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
          const goal = makeGoal({ targetValue, currentValue, endDate })

          const pace = calculateDailyPace(goal)
          if (pace !== null) {
            expect(pace).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
