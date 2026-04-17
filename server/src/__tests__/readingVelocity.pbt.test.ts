import * as fc from 'fast-check'
import { Types } from 'mongoose'
import { calculateReadingVelocity } from '../services/ml/orpOptimizer'
import { IReadingSession } from '../models/ReadingSession'

/**
 * Property 7: Reading velocity calculation formula
 * 
 * **Validates: Requirements 2.4**
 * 
 * For any reading session, the reading velocity must equal:
 * (words_read / total_time_seconds) * (1 - pause_rate)
 * 
 * where pause_rate is the fraction of words followed by a pause longer than 2 seconds.
 */
describe('Property 7: Reading velocity calculation formula', () => {
  const mockUserId = new Types.ObjectId()
  const mockBookId = new Types.ObjectId()
  const mockSessionId = new Types.ObjectId()

  it('should calculate velocity using the correct formula for any valid session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // words_read (lastWordIndex)
        fc.integer({ min: 1, max: 7200 }), // total_time_seconds (up to 2 hours)
        fc.array(
          fc.record({
            wordIndex: fc.integer({ min: 0, max: 9999 }),
            duration: fc.integer({ min: 0, max: 10000 }) // pause duration in ms
          }),
          { maxLength: 100 }
        ), // pause events
        async (wordsRead, totalTimeSeconds, pauseEvents) => {
          // Ensure pause events are within bounds
          const validPauseEvents = pauseEvents
            .filter(p => p.wordIndex < wordsRead)
            .map(p => ({
              wordIndex: p.wordIndex,
              duration: p.duration
            }))

          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents: validPauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          // Calculate expected values manually
          const longPauses = validPauseEvents.filter(p => p.duration > 2000).length
          const pauseRate = wordsRead > 0 ? longPauses / wordsRead : 0
          const expectedVelocity = (wordsRead / totalTimeSeconds) * (1 - pauseRate)

          // Calculate actual velocity using the function
          const actualVelocity = calculateReadingVelocity(mockSession as IReadingSession)

          // Verify the formula is applied correctly
          expect(actualVelocity).toBeCloseTo(expectedVelocity, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should only count pauses longer than 2 seconds in pause_rate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // words_read
        fc.integer({ min: 1, max: 600 }), // total_time_seconds
        fc.integer({ min: 0, max: 50 }), // number of short pauses (<= 2000ms)
        fc.integer({ min: 0, max: 50 }), // number of long pauses (> 2000ms)
        async (wordsRead, totalTimeSeconds, shortPauseCount, longPauseCount) => {
          // Create pause events
          const pauseEvents = []
          
          // Add short pauses (should NOT be counted)
          for (let i = 0; i < shortPauseCount && i < wordsRead; i++) {
            pauseEvents.push({
              wordIndex: i,
              duration: Math.floor(Math.random() * 2000) // 0-2000ms
            })
          }
          
          // Add long pauses (should be counted)
          for (let i = 0; i < longPauseCount && (shortPauseCount + i) < wordsRead; i++) {
            pauseEvents.push({
              wordIndex: shortPauseCount + i,
              duration: 2001 + Math.floor(Math.random() * 3000) // 2001-5000ms
            })
          }

          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          // Only long pauses should affect pause_rate
          const actualLongPauses = pauseEvents.filter(p => p.duration > 2000).length
          const pauseRate = wordsRead > 0 ? actualLongPauses / wordsRead : 0
          const expectedVelocity = (wordsRead / totalTimeSeconds) * (1 - pauseRate)

          const actualVelocity = calculateReadingVelocity(mockSession as IReadingSession)

          expect(actualVelocity).toBeCloseTo(expectedVelocity, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return 0 velocity when time spent is 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // words_read
        fc.array(
          fc.record({
            wordIndex: fc.integer({ min: 0, max: 9999 }),
            duration: fc.integer({ min: 0, max: 10000 })
          }),
          { maxLength: 100 }
        ),
        async (wordsRead, pauseEvents) => {
          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: 0, // Zero time
            pauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          const velocity = calculateReadingVelocity(mockSession as IReadingSession)

          // Division by zero should be handled, returning 0
          expect(velocity).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return 0 velocity when words read is 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 7200 }), // total_time_seconds
        async (totalTimeSeconds) => {
          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: 0, // Zero words
            timeSpent: totalTimeSeconds,
            pauseEvents: [],
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          const velocity = calculateReadingVelocity(mockSession as IReadingSession)

          // Zero words should result in 0 velocity
          expect(velocity).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle sessions with 100% pause rate (all words paused)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // words_read
        fc.integer({ min: 1, max: 600 }), // total_time_seconds
        async (wordsRead, totalTimeSeconds) => {
          // Create a pause event for every word (all > 2 seconds)
          const pauseEvents = Array.from({ length: wordsRead }, (_, i) => ({
            wordIndex: i,
            duration: 2500 // All pauses > 2 seconds
          }))

          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          // pause_rate = wordsRead / wordsRead = 1.0
          // velocity = (wordsRead / totalTimeSeconds) * (1 - 1.0) = 0
          const velocity = calculateReadingVelocity(mockSession as IReadingSession)

          expect(velocity).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle sessions with no pauses (0% pause rate)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // words_read
        fc.integer({ min: 1, max: 7200 }), // total_time_seconds
        async (wordsRead, totalTimeSeconds) => {
          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents: [], // No pauses
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          // pause_rate = 0
          // velocity = (wordsRead / totalTimeSeconds) * (1 - 0) = wordsRead / totalTimeSeconds
          const expectedVelocity = wordsRead / totalTimeSeconds
          const actualVelocity = calculateReadingVelocity(mockSession as IReadingSession)

          expect(actualVelocity).toBeCloseTo(expectedVelocity, 10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce velocity between 0 and words_per_second for valid sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // words_read
        fc.integer({ min: 1, max: 7200 }), // total_time_seconds
        fc.array(
          fc.record({
            wordIndex: fc.integer({ min: 0, max: 9999 }),
            duration: fc.integer({ min: 0, max: 10000 })
          }),
          { maxLength: 100 }
        ),
        async (wordsRead, totalTimeSeconds, pauseEvents) => {
          const validPauseEvents = pauseEvents.filter(p => p.wordIndex < wordsRead)

          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents: validPauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          const velocity = calculateReadingVelocity(mockSession as IReadingSession)
          const maxVelocity = wordsRead / totalTimeSeconds

          // Velocity should be non-negative and not exceed raw words per second
          expect(velocity).toBeGreaterThanOrEqual(0)
          expect(velocity).toBeLessThanOrEqual(maxVelocity)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge case: exactly 2000ms pauses (should NOT be counted)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }), // words_read
        fc.integer({ min: 1, max: 600 }), // total_time_seconds
        async (wordsRead, totalTimeSeconds) => {
          // Create pauses exactly at 2000ms threshold
          const pauseEvents = Array.from({ length: 5 }, (_, i) => ({
            wordIndex: i,
            duration: 2000 // Exactly 2000ms - should NOT be counted as long pause
          }))

          const mockSession: Partial<IReadingSession> = {
            _id: mockSessionId,
            userId: mockUserId,
            bookId: mockBookId,
            lastWordIndex: wordsRead,
            timeSpent: totalTimeSeconds,
            pauseEvents,
            currentWPM: 300,
            date: new Date(),
            speedChanges: []
          }

          // Pauses at exactly 2000ms should NOT be counted (only > 2000ms)
          const longPauses = pauseEvents.filter(p => p.duration > 2000).length
          expect(longPauses).toBe(0)

          const pauseRate = 0 // No long pauses
          const expectedVelocity = (wordsRead / totalTimeSeconds) * (1 - pauseRate)
          const actualVelocity = calculateReadingVelocity(mockSession as IReadingSession)

          expect(actualVelocity).toBeCloseTo(expectedVelocity, 10)
        }
      ),
      { numRuns: 100 }
    )
  })
})
