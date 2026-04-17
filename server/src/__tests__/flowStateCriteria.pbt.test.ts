// Feature: ai-adaptive-features, Property 16: Flow state classification criteria
import * as fc from 'fast-check'
import { classifyFlowState } from '../services/ml/readingDNA'

/**
 * Validates: Requirements 4.3
 *
 * Property 16: Flow state classification criteria
 * classifyFlowState(session) returns true iff ALL of:
 * 1. session.timeSpent >= 600 (10 minutes)
 * 2. No pauseEvents with duration > 3000ms
 * 3. WPM variance (coefficient of variation) < 0.1
 *    where variance = stddev(newWPMs) / mean(newWPMs)
 *    and if speedChanges is empty, variance = 0
 */

// ---- Helpers ----

function makeSession(overrides: {
  timeSpent?: number
  pauseEvents?: Array<{ wordIndex: number; duration: number }>
  speedChanges?: Array<{ wordIndex: number; oldWPM: number; newWPM: number; timestamp: Date }>
}) {
  return {
    timeSpent: overrides.timeSpent ?? 600,
    pauseEvents: overrides.pauseEvents ?? [],
    speedChanges: overrides.speedChanges ?? [],
    // Required IReadingSession fields (not used by classifyFlowState)
    userId: 'user1',
    bookId: 'book1',
    date: new Date(),
    currentWPM: 300,
    lastWordIndex: 0,
    sessionCompleted: false,
    bookCompleted: false,
    averageWordLength: 5,
    complexityScore: 0.5,
    readingVelocity: 300,
  } as any
}

// Arbitrary for a single pause event with duration <= 3000ms (safe pause)
const safePauseArb = fc.record({
  wordIndex: fc.integer({ min: 0, max: 1000 }),
  duration: fc.integer({ min: 0, max: 3000 }),
})

// Arbitrary for a single pause event with duration > 3000ms (long pause)
const longPauseArb = fc.record({
  wordIndex: fc.integer({ min: 0, max: 1000 }),
  duration: fc.integer({ min: 3001, max: 60000 }),
})

// Arbitrary for speed changes with low WPM variance (CV < 0.1)
// Use a fixed mean and small perturbations so CV stays well below 0.1
const lowVarianceSpeedChangesArb = fc.integer({ min: 200, max: 500 }).chain(mean =>
  fc.array(
    fc.integer({ min: Math.max(1, Math.round(mean * 0.95)), max: Math.round(mean * 1.04) }).map(wpm => ({
      wordIndex: 0,
      oldWPM: mean,
      newWPM: wpm,
      timestamp: new Date(),
    })),
    { minLength: 1, maxLength: 10 }
  )
)

// Arbitrary for speed changes with high WPM variance (CV >= 0.1)
// Use two very different WPM values to guarantee high variance
const highVarianceSpeedChangesArb = fc.integer({ min: 100, max: 300 }).chain(low =>
  fc.integer({ min: low + 100, max: low + 500 }).map(high => [
    { wordIndex: 0, oldWPM: low, newWPM: low, timestamp: new Date() },
    { wordIndex: 10, oldWPM: low, newWPM: high, timestamp: new Date() },
    { wordIndex: 20, oldWPM: high, newWPM: low, timestamp: new Date() },
    { wordIndex: 30, oldWPM: low, newWPM: high, timestamp: new Date() },
  ])
)

// ---- Tests ----

describe('Flow State - Property 16: Flow state classification criteria', () => {
  /**
   * Property 1: Core - session meeting all 3 criteria is classified as flow state
   */
  it('session meeting all criteria is classified as flow state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 7200 }),
        fc.array(safePauseArb, { minLength: 0, maxLength: 5 }),
        lowVarianceSpeedChangesArb,
        (timeSpent, pauseEvents, speedChanges) => {
          const session = makeSession({ timeSpent, pauseEvents, speedChanges })
          return classifyFlowState(session) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Duration < 600 → never flow state
   */
  it('duration < 600 seconds is never flow state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 599 }),
        fc.array(safePauseArb, { minLength: 0, maxLength: 5 }),
        (timeSpent, pauseEvents) => {
          const session = makeSession({ timeSpent, pauseEvents })
          return classifyFlowState(session) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Any pause > 3000ms → never flow state
   */
  it('any pause > 3000ms is never flow state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 7200 }),
        longPauseArb,
        fc.array(safePauseArb, { minLength: 0, maxLength: 4 }),
        (timeSpent, longPause, otherPauses) => {
          const pauseEvents = [...otherPauses, longPause]
          const session = makeSession({ timeSpent, pauseEvents })
          return classifyFlowState(session) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: WPM variance >= 0.1 → never flow state
   */
  it('WPM variance >= 0.1 is never flow state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 7200 }),
        highVarianceSpeedChangesArb,
        (timeSpent, speedChanges) => {
          const session = makeSession({ timeSpent, speedChanges })
          return classifyFlowState(session) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: All criteria met → always flow state
   * (empty speedChanges = variance 0, no pauses, duration >= 600)
   */
  it('all criteria met with empty speedChanges always returns flow state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 7200 }),
        (timeSpent) => {
          const session = makeSession({ timeSpent, pauseEvents: [], speedChanges: [] })
          return classifyFlowState(session) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Boundary - exactly 600s duration IS flow state (if other criteria met)
   */
  it('exactly 600s duration with no pauses and empty speedChanges is flow state', () => {
    const session = makeSession({ timeSpent: 600, pauseEvents: [], speedChanges: [] })
    expect(classifyFlowState(session)).toBe(true)
  })

  /**
   * Property 6b: Exactly 599s duration is NOT flow state
   */
  it('exactly 599s duration is not flow state', () => {
    const session = makeSession({ timeSpent: 599, pauseEvents: [], speedChanges: [] })
    expect(classifyFlowState(session)).toBe(false)
  })

  /**
   * Property 6c: Pause with duration exactly 3000ms is NOT a long pause (boundary)
   */
  it('pause with duration exactly 3000ms does not disqualify flow state', () => {
    const session = makeSession({
      timeSpent: 600,
      pauseEvents: [{ wordIndex: 5, duration: 3000 }],
      speedChanges: [],
    })
    expect(classifyFlowState(session)).toBe(true)
  })

  /**
   * Property 6d: Pause with duration exactly 3001ms disqualifies flow state
   */
  it('pause with duration exactly 3001ms disqualifies flow state', () => {
    const session = makeSession({
      timeSpent: 600,
      pauseEvents: [{ wordIndex: 5, duration: 3001 }],
      speedChanges: [],
    })
    expect(classifyFlowState(session)).toBe(false)
  })
})
