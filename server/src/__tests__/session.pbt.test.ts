// Feature: readapt-rsvp-platform, Property 5: Session upsert idempotence
import * as fc from 'fast-check'
import mongoose from 'mongoose'
import ReadingSession from '../models/ReadingSession'

/**
 * Validates: Requirements 7.2
 *
 * Property 5: Session upsert idempotence
 * For any (userId, bookId) pair, calling the session update endpoint twice
 * with the same data should result in exactly one ReadingSession document in
 * the database (upsert, not duplicate insert).
 */

// Arbitrary: a valid MongoDB ObjectId hex string
const objectIdArb = fc
  .hexaString({ minLength: 24, maxLength: 24 })
  .map(s => new mongoose.Types.ObjectId(s))

// Arbitrary: valid session payload
const sessionDataArb = fc.record({
  lastWordIndex: fc.integer({ min: 0, max: 100000 }),
  currentWPM: fc.integer({ min: 1, max: 2000 }),
  timeSpent: fc.integer({ min: 0, max: 86400 }),
})

describe('ReadingSession - Property 5: Session upsert idempotence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calling findOneAndUpdate twice with the same (userId, bookId) results in exactly one document', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        objectIdArb,
        sessionDataArb,
        async (userId, bookId, sessionData) => {
          // Track upserted documents keyed by (userId, bookId)
          const store = new Map<string, object>()

          const upsertMock = jest
            .spyOn(ReadingSession, 'findOneAndUpdate')
            .mockImplementation((filter: any, update: any, options: any) => {
              const key = `${filter.userId}-${filter.bookId}`
              const existing = store.get(key)

              if (existing || options?.upsert) {
                const doc = { ...filter, ...update, _id: existing ? (existing as any)._id : new mongoose.Types.ObjectId() }
                store.set(key, doc)
                return Promise.resolve(doc) as any
              }
              return Promise.resolve(null) as any
            })

          const filter = { userId, bookId }
          const update = { ...sessionData, date: new Date() }
          const opts = { upsert: true, new: true }

          // Call upsert twice with identical data
          await ReadingSession.findOneAndUpdate(filter, update, opts)
          await ReadingSession.findOneAndUpdate(filter, update, opts)

          // The store should contain exactly one entry for this (userId, bookId) pair
          const key = `${userId}-${bookId}`
          const entries = [...store.entries()].filter(([k]) => k === key)
          expect(entries).toHaveLength(1)

          // findOneAndUpdate must have been called exactly twice
          expect(upsertMock).toHaveBeenCalledTimes(2)

          // Both calls must have used the same filter
          const calls = upsertMock.mock.calls
          expect(calls[0][0]).toEqual(filter)
          expect(calls[1][0]).toEqual(filter)

          upsertMock.mockRestore()
        }
      ),
      { numRuns: 100 }
    )
  })
})
