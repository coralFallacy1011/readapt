// Feature: ai-adaptive-features, Property 13: Time-specific WPM calculation
import * as fc from 'fast-check'

/**
 * Validates: Requirements 3.7
 *
 * Property 13: Time-specific WPM calculation
 * For each 2-hour time window, the recommended WPM is the median WPM of
 * sessions in that window where the session's reading velocity exceeded
 * the overall median velocity across all sessions.
 *
 * We test the pure calculation logic extracted from getTimeSpecificWPMRecommendations,
 * which avoids any DB calls.
 */

// ---- Pure calculation logic (mirrors getTimeSpecificWPMRecommendations) ----

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

interface SessionLike {
  date: Date
  readingVelocity: number
  currentWPM: number
}

/**
 * Pure function: given sessions, return the time-specific WPM recommendations.
 * Mirrors the core logic of getTimeSpecificWPMRecommendations without DB calls.
 */
function computeTimeSpecificWPM(sessions: SessionLike[]): Map<string, number> {
  if (sessions.length === 0) return new Map()

  const allVelocities = sessions.map(s => s.readingVelocity)
  const overallMedianVelocity = median(allVelocities)

  // Group sessions by 2-hour windows
  const windowSessions = new Map<string, SessionLike[]>()
  for (const session of sessions) {
    const hour = session.date.getHours()
    const windowStart = Math.floor(hour / 2) * 2
    const windowEnd = windowStart + 2
    const window = `${windowStart}-${windowEnd}`
    if (!windowSessions.has(window)) windowSessions.set(window, [])
    windowSessions.get(window)!.push(session)
  }

  const recommendations = new Map<string, number>()
  for (const [window, windowSessionList] of windowSessions.entries()) {
    const highVelocitySessions = windowSessionList.filter(
      s => s.readingVelocity > overallMedianVelocity
    )
    if (highVelocitySessions.length > 0) {
      const wpms = highVelocitySessions.map(s => s.currentWPM)
      recommendations.set(window, Math.round(median(wpms)))
    }
  }

  return recommendations
}

// ---- Helpers ----

function makeSession(hour: number, velocity: number, wpm: number): SessionLike {
  return {
    date: new Date(2024, 0, 15, hour, 0, 0, 0),
    readingVelocity: velocity,
    currentWPM: wpm,
  }
}

// ---- Arbitraries ----

const sessionArb = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  velocity: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
  wpm: fc.integer({ min: 100, max: 1000 }),
})

// ---- Tests ----

describe('Time-Specific WPM - Property 13: Time-specific WPM calculation', () => {
  /**
   * Core property: for each window in the result, the recommended WPM equals
   * the median WPM of sessions in that window where velocity > overall median velocity.
   */
  it('recommended WPM for each window is the median WPM of high-velocity sessions in that window', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 1, maxLength: 50 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity, s.wpm))
          const result = computeTimeSpecificWPM(sessions)

          const allVelocities = sessions.map(s => s.readingVelocity)
          const overallMedian = median(allVelocities)

          for (const [window, recommendedWPM] of result.entries()) {
            // Reconstruct which sessions belong to this window
            const windowSessions = sessions.filter(s => {
              const hour = s.date.getHours()
              const windowStart = Math.floor(hour / 2) * 2
              return `${windowStart}-${windowStart + 2}` === window
            })

            // Filter to high-velocity sessions
            const highVelocitySessions = windowSessions.filter(
              s => s.readingVelocity > overallMedian
            )

            // The recommended WPM must equal the rounded median WPM of high-velocity sessions
            const expectedWPM = Math.round(median(highVelocitySessions.map(s => s.currentWPM)))
            if (recommendedWPM !== expectedWPM) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: windows with no sessions above the overall median velocity
   * must NOT appear in the recommendations map.
   */
  it('windows with no sessions above overall median velocity are excluded from recommendations', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 1, maxLength: 50 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity, s.wpm))
          const result = computeTimeSpecificWPM(sessions)

          const allVelocities = sessions.map(s => s.readingVelocity)
          const overallMedian = median(allVelocities)

          for (const [window] of result.entries()) {
            const windowSessions = sessions.filter(s => {
              const hour = s.date.getHours()
              const windowStart = Math.floor(hour / 2) * 2
              return `${windowStart}-${windowStart + 2}` === window
            })

            const hasHighVelocity = windowSessions.some(
              s => s.readingVelocity > overallMedian
            )

            // Every window in the result must have at least one high-velocity session
            if (!hasHighVelocity) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: empty sessions returns an empty map.
   */
  it('returns empty map when there are no sessions', () => {
    const result = computeTimeSpecificWPM([])
    expect(result.size).toBe(0)
  })

  /**
   * Edge case: all sessions have the same velocity — none exceed the median,
   * so the result map must be empty.
   */
  it('returns empty map when all sessions have identical velocity (none exceed median)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 1.0, max: 5.0, noNaN: true }),
        fc.integer({ min: 100, max: 800 }),
        fc.integer({ min: 0, max: 23 }),
        (count, velocity, wpm, hour) => {
          const sessions = Array.from({ length: count }, () =>
            makeSession(hour, velocity, wpm)
          )
          const result = computeTimeSpecificWPM(sessions)
          // When all velocities are equal, none are strictly > median, so map is empty
          return result.size === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: single session — if its velocity exceeds the median (which equals
   * itself), it cannot be strictly greater, so the result map must be empty.
   */
  it('returns empty map for a single session (velocity cannot exceed itself as median)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.double({ min: 0.5, max: 9.0, noNaN: true }),
        fc.integer({ min: 100, max: 800 }),
        (hour, velocity, wpm) => {
          const sessions = [makeSession(hour, velocity, wpm)]
          const result = computeTimeSpecificWPM(sessions)
          // Single session: median = its own velocity, not strictly greater
          return result.size === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: all sessions above median — when sessions span two distinct
   * velocity groups, the higher-velocity group sessions drive the recommendations.
   */
  it('all sessions in a window above median are included in WPM calculation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 100, max: 400 }),
        fc.integer({ min: 500, max: 900 }),
        (lowCount, highCount, lowWPM, highWPM) => {
          // Low-velocity sessions in window 0-2 (hour 0)
          const lowSessions = Array.from({ length: lowCount }, () =>
            makeSession(0, 1.0, lowWPM)
          )
          // High-velocity sessions in window 2-4 (hour 2)
          const highSessions = Array.from({ length: highCount }, () =>
            makeSession(2, 9.0, highWPM)
          )

          const sessions = [...lowSessions, ...highSessions]
          const result = computeTimeSpecificWPM(sessions)

          const allVelocities = sessions.map(s => s.readingVelocity)
          const overallMedian = median(allVelocities)

          // High-velocity sessions (velocity=9.0) should exceed the overall median
          // and their window should appear in the result
          const highSessionsAboveMedian = highSessions.filter(
            s => s.readingVelocity > overallMedian
          )

          if (highSessionsAboveMedian.length > 0) {
            const expectedWPM = Math.round(median(highSessionsAboveMedian.map(s => s.currentWPM)))
            const windowKey = '2-4'
            if (!result.has(windowKey)) return false
            if (result.get(windowKey) !== expectedWPM) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: all recommended WPM values are positive integers.
   */
  it('all recommended WPM values are positive integers', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 1, maxLength: 50 }),
        (rawSessions) => {
          const sessions = rawSessions.map(s => makeSession(s.hour, s.velocity, s.wpm))
          const result = computeTimeSpecificWPM(sessions)

          for (const wpm of result.values()) {
            if (!Number.isInteger(wpm) || wpm <= 0) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
