// Feature: readapt-rsvp-platform, Property 6: Book ownership isolation
import * as fc from 'fast-check'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { getAll } from '../controllers/bookController'
import Book from '../models/Book'

jest.mock('../models/Book')

/**
 * Validates: Requirements 4.1, 9.3
 *
 * Property 6: Book ownership isolation
 * For any two distinct users A and B, user A's book list must contain no
 * books belonging to user B.
 */

function makeReq(userId: string): AuthRequest {
  return {
    user: { id: userId, email: `${userId}@example.com` },
    params: {},
    body: {},
  } as unknown as AuthRequest
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response & { json: jest.Mock; status: jest.Mock }
}

// Arbitrary: a non-empty alphanumeric user ID string
const userIdArb = fc
  .stringMatching(/^[a-z][a-z0-9]{3,11}$/)
  .filter(s => s.length >= 4)

// Arbitrary: a book record belonging to a given userId
function bookArb(userId: string) {
  return fc.record({
    _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
    userId: fc.constant(userId),
    title: fc.string({ minLength: 1, maxLength: 40 }),
    totalWords: fc.integer({ min: 1, max: 10000 }),
  })
}

describe('bookController - Property 6: Book ownership isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getAll for user A never returns books belonging to user B', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Two distinct user IDs
        fc
          .tuple(userIdArb, userIdArb)
          .filter(([a, b]) => a !== b),
        // Books for user A (0–5 books)
        fc.integer({ min: 0, max: 5 }).chain(n =>
          fc.tuple(...Array.from({ length: n }, () => bookArb('userA')))
            .map(arr => Array.from(arr))
        ),
        // Books for user B (1–5 books, at least one so there's something to leak)
        fc.integer({ min: 1, max: 5 }).chain(n =>
          fc.tuple(...Array.from({ length: n }, () => bookArb('userB')))
            .map(arr => Array.from(arr))
        ),
        async ([userA, userB], booksA, booksB) => {
          // Replace placeholder IDs with the generated distinct user IDs
          const userABooks = booksA.map(b => ({ ...b, userId: userA }))
          const userBBooks = booksB.map(b => ({ ...b, userId: userB }))

          // Mock Book.find to simulate DB isolation: only return books for the queried userId
          const selectMock = jest.fn().mockImplementation(() => {
            // This mock is set per-call below
          })

          ;(Book.find as jest.Mock).mockImplementation(({ userId }: { userId: string }) => {
            const result = userId === userA ? userABooks : userBBooks
            return { select: jest.fn().mockResolvedValue(result) }
          })

          // Call getAll as user A
          const reqA = makeReq(userA)
          const resA = makeRes()
          await getAll(reqA, resA)

          const bodyA = (resA.json as jest.Mock).mock.calls[0][0]
          const returnedBooks: Array<{ userId: string }> = bodyA.books

          // Property: none of user A's returned books should have userId === userB
          const leaked = returnedBooks.filter(b => b.userId === userB)
          expect(leaked).toHaveLength(0)

          // Property: every returned book must belong to user A
          returnedBooks.forEach(b => {
            expect(b.userId).toBe(userA)
          })

          // Verify the DB was queried with user A's ID (not user B's)
          expect(Book.find).toHaveBeenCalledWith({ userId: userA })
        }
      ),
      { numRuns: 100 }
    )
  })
})
