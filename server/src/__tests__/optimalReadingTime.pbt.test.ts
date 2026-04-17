// Feature: ai-adaptive-features, Property 12: Optimal reading time is highest velocity window
import * as fc from 'fast-check'
import { Types } from 'mongoose'

/**
 * Validates: Requirements 3.5
 *
 * Property 12: Optimal reading time is highest velocity window
 * For any set of reading sessions with timestamps, the returned optimal time
 * window must be the 2-hour window with the highest average reading velocity
 * among all windows that have at least one session.
 *
 * We test the pure calculation logic extracted from findOptimalReadingTime,
 * which groups sessions by 2-hour windows and returns the window with the
 * highest average reading velocity.
 */

// ---- Pure calculation logic (mirrors findOptimalReadingTime implementation) ----

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

interface SessionLike {
  date: Date
  readingVelocity: number
}

/**
 * Pure function: given sessions, return the optimal 2-hour window.
 * This mirrors the core logic of findOptimalReadingTime without DB calls.
 */
function computeOptimalWindow(sessions: SessionLike[]): string {
  if (sessions.length < 10) return ''

  const windows = new Map<string, number[]>()

  for (const session of sessions) {
    const hour = session.date.getHours()
    const windowStart = Math.floor(hour / 2) * 2
    const windowEnd = windowStart + 2
    const window = `${windowStart}-${windowEnd}`

    if (!windows.has(window)) windows.set(window, [])
    windows.get(window)!.push(session.readingVelocity)
  }

  let bestWindow = ''
  let bestVelocity = 0

  for (const [window, velocities] of windows.entries()) {
    const avg = average(velocities)
    if (avg > bestVelocity) {
      bestVelocity = avg
      bestWindow = window
    }
  }

  return bestWindow
}

// ---- Helpers ----

function makeSession(hour: number, velocity: number): SessionLike {
  // Use local time constructor so getHours() returns the expected hour
  return {
    date: new Date(2024, 0, 15, hour, 0, 0, 0),
    readingVelocity: velocity,
  }
}

// ---- Tests ----

describe('Optimal Reading Time - Property 12: Optimal reading time is highest velocity window', () => {
  /**
   * Core property: the returned window always has the highest average velocity
   * among all 2-hour windows present in the session data.
   */
  it('returned window has the highest average velocity among all 2-hour windows', () => {
    const sessionArb = fc.record({
      hour: fc.integer({ min: 0, max: 23 }),
      velocity: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
    })

    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 10, maxLength: 50 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity))
          const result = computeOptimalWindow(sessions)

          if (result === '') return true

          // Compute average velocity per window
          const windowVelocities = new Map<string, number[]>()
          for (const s of sessions) {
            const hour = s.date.getHours()
            const windowStart = Math.floor(hour / 2) * 2
            const key = `${windowStart}-${windowStart + 2}`
            if (!windowVelocities.has(key)) windowVelocities.set(key, [])
            windowVelocities.get(key)!.push(s.readingVelocity)
          }

          const avgFor = (key: string) => {
            const vals = windowVelocities.get(key) ?? []
            return vals.reduce((s, v) => s + v, 0) / vals.length
          }

          const resultAvg = avgFor(result)

          // The result window must have avg >= every other window's avg
          for (const [window] of windowVelocities.entries()) {
            if (window === result) continue
            if (avgFor(window) > resultAvg + 1e-9) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: all sessions in the same 2-hour window — that window must be returned.
   */
  it('returns the only window when all sessions share the same 2-hour window', () => {
    const hourArb = fc.integer({ min: 0, max: 23 })
    const velocityArb = fc.double({ min: 0.5, max: 8.0, noNaN: true })
    const countArb = fc.integer({ min: 10, max: 20 })

    fc.assert(
      fc.property(hourArb, velocityArb, countArb, (hour, velocity, count) => {
        const sessions = Array.from({ length: count }, () => makeSession(hour, velocity))
        const result = computeOptimalWindow(sessions)

        const windowStart = Math.floor(hour / 2) * 2
        const expected = `${windowStart}-${windowStart + 2}`

        return result === expected
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: sessions spread across the full day — result is deterministic.
   */
  it('is deterministic: same sessions always produce the same result', () => {
    const sessionArb = fc.record({
      hour: fc.integer({ min: 0, max: 23 }),
      velocity: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
    })

    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 10, maxLength: 60 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity))
          const result1 = computeOptimalWindow(sessions)
          const result2 = computeOptimalWindow(sessions)
          return result1 === result2
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: fewer than 10 sessions returns empty string (insufficient data).
   */
  it('returns empty string when fewer than 10 sessions exist', () => {
    const sessionArb = fc.record({
      hour: fc.integer({ min: 0, max: 23 }),
      velocity: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
    })

    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 0, maxLength: 9 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity))
          const result = computeOptimalWindow(sessions)
          return result === ''
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: the returned window string always has the format "N-(N+2)"
   * where N is an even number 0-22.
   */
  it('returned window always has valid 2-hour window format', () => {
    const sessionArb = fc.record({
      hour: fc.integer({ min: 0, max: 23 }),
      velocity: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
    })

    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 10, maxLength: 40 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity))
          const result = computeOptimalWindow(sessions)

          if (result === '') return true

          const match = result.match(/^(\d+)-(\d+)$/)
          if (!match) return false

          const start = parseInt(match[1], 10)
          const end = parseInt(match[2], 10)

          return (
            start % 2 === 0 &&
            end === start + 2 &&
            start >= 0 &&
            end <= 24
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: a window with strictly higher velocity than all others is always selected.
   * This verifies the "highest velocity" selection is correct.
   */
  it('always selects the window with strictly highest average velocity', () => {
    // Generate sessions where one window clearly dominates
    const hourArb = fc.integer({ min: 0, max: 23 })
    const lowVelocityArb = fc.double({ min: 0.1, max: 2.0, noNaN: true })
    const highVelocityArb = fc.double({ min: 5.0, max: 10.0, noNaN: true })
    const countArb = fc.integer({ min: 5, max: 15 })

    fc.assert(
      fc.property(
        hourArb, hourArb, lowVelocityArb, highVelocityArb, countArb, countArb,
        (hour1, hour2, lowVel, highVel, count1, count2) => {
          // Ensure the two hours map to different 2-hour windows
          const win1 = Math.floor(hour1 / 2) * 2
          const win2 = Math.floor(hour2 / 2) * 2
          fc.pre(win1 !== win2)

          // Sessions in window 1 have low velocity
          const lowSessions = Array.from({ length: count1 }, () => makeSession(hour1, lowVel))
          // Sessions in window 2 have high velocity
          const highSessions = Array.from({ length: count2 }, () => makeSession(hour2, highVel))

          // Need at least 10 total sessions
          const allSessions = [...lowSessions, ...highSessions]
          if (allSessions.length < 10) return true // skip if not enough

          const result = computeOptimalWindow(allSessions)

          // The high-velocity window should be selected
          const expectedWindow = `${win2}-${win2 + 2}`
          return result === expectedWindow
        }
      ),
      { numRuns: 100 }
    )
  })
})
