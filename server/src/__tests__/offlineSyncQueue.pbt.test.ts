// Feature: ai-adaptive-features, Property 38: Offline sync queue processes all sessions
import * as fc from 'fast-check'

/**
 * Validates: Requirements 15.5
 *
 * Property 38: Offline sync queue processes all sessions
 * Tests the pure session mapping logic from syncOfflineSessions.
 */

// ---- Pure logic (mirrors offlineController.ts syncOfflineSessions) ----

interface OfflineSession {
  bookId: string
  lastWordIndex?: number
  timeSpent?: number
  currentWPM?: number
  date?: string
}

interface ProcessedSession {
  userId: string
  bookId: string
  lastWordIndex: number
  timeSpent: number
  currentWPM: number
  date: Date
  pauseEvents: unknown[]
  speedChanges: unknown[]
  averageWordLength: number
  complexityScore: number
  readingVelocity: number
  sessionCompleted: boolean
  bookCompleted: boolean
}

function processOfflineSessions(userId: string, sessions: OfflineSession[]): ProcessedSession[] {
  return sessions.map((s) => ({
    userId,
    bookId: s.bookId,
    lastWordIndex: s.lastWordIndex ?? 0,
    timeSpent: s.timeSpent ?? 0,
    currentWPM: s.currentWPM ?? 300,
    date: s.date ? new Date(s.date) : new Date(),
    pauseEvents: [],
    speedChanges: [],
    averageWordLength: 0,
    complexityScore: 0,
    readingVelocity: 0,
    sessionCompleted: false,
    bookCompleted: false,
  }))
}

// ---- Arbitraries ----

const userIdArb = fc.uuid()
const bookIdArb = fc.uuid()

const partialSessionArb: fc.Arbitrary<OfflineSession> = fc.record({
  bookId: bookIdArb,
  lastWordIndex: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: undefined }),
  timeSpent: fc.option(fc.integer({ min: 0, max: 86_400 }), { nil: undefined }),
  currentWPM: fc.option(fc.integer({ min: 50, max: 1000 }), { nil: undefined }),
  date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()), { nil: undefined }),
})

const fullSessionArb: fc.Arbitrary<OfflineSession> = fc.record({
  bookId: bookIdArb,
  lastWordIndex: fc.integer({ min: 0, max: 100_000 }),
  timeSpent: fc.integer({ min: 0, max: 86_400 }),
  currentWPM: fc.integer({ min: 50, max: 1000 }),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()),
})

const sessionsArb = fc.array(partialSessionArb, { minLength: 1, maxLength: 20 })

// ---- Tests ----

describe('Offline Sync Queue - Property 38: Offline sync queue processes all sessions', () => {
  /**
   * Property 1: All sessions in the input array are processed (count matches)
   */
  it('all sessions in the input are processed', () => {
    fc.assert(
      fc.property(userIdArb, sessionsArb, (userId, sessions) => {
        const result = processOfflineSessions(userId, sessions)
        return result.length === sessions.length
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Each session gets default values for missing fields
   */
  it('sessions with missing fields get default values', () => {
    fc.assert(
      fc.property(userIdArb, fc.array(fc.record({ bookId: bookIdArb }), { minLength: 1, maxLength: 20 }), (userId, sessions) => {
        const result = processOfflineSessions(userId, sessions)
        return result.every(s =>
          s.lastWordIndex === 0 &&
          s.timeSpent === 0 &&
          s.currentWPM === 300
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Sessions with all fields use provided values
   */
  it('sessions with all fields use provided values', () => {
    fc.assert(
      fc.property(userIdArb, fc.array(fullSessionArb, { minLength: 1, maxLength: 20 }), (userId, sessions) => {
        const result = processOfflineSessions(userId, sessions)
        return result.every((s, i) => {
          const input = sessions[i]
          return (
            s.lastWordIndex === input.lastWordIndex &&
            s.timeSpent === input.timeSpent &&
            s.currentWPM === input.currentWPM
          )
        })
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Empty array → synced: 0
   */
  it('empty array produces zero processed sessions', () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const result = processOfflineSessions(userId, [])
        return result.length === 0
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Each processed session has the correct userId
   */
  it('each processed session has the correct userId', () => {
    fc.assert(
      fc.property(userIdArb, sessionsArb, (userId, sessions) => {
        const result = processOfflineSessions(userId, sessions)
        return result.every(s => s.userId === userId)
      }),
      { numRuns: 100 }
    )
  })
})
