// Feature: readapt-rsvp-platform, Property 7: Analytics totals are consistent with session data
import * as fc from 'fast-check'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { getAnalytics } from '../controllers/analyticsController'
import ReadingSession from '../models/ReadingSession'
import Book from '../models/Book'

jest.mock('../models/ReadingSession')
jest.mock('../models/Book')

/**
 * Validates: Requirements 8.1, 8.4
 *
 * Property 7: Analytics totals are consistent with session data
 * For any user, the totalWordsRead value returned by the analytics endpoint
 * must equal the sum of lastWordIndex values across all of that user's
 * ReadingSession documents.
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

// Arbitrary: a valid MongoDB ObjectId hex string (24 hex chars)
const userIdArb = fc
  .hexaString({ minLength: 24, maxLength: 24 })
  .filter(s => s.length === 24)

// Arbitrary: a reading session with a non-negative lastWordIndex
const sessionArb = fc.record({
  lastWordIndex: fc.integer({ min: 0, max: 100000 }),
  currentWPM: fc.integer({ min: 100, max: 1000 }),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
})

describe('analyticsController - Property 7: Analytics totals are consistent with session data', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('totalWordsRead equals the sum of lastWordIndex across all user sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        // Generate 0–10 sessions for the user
        fc.array(sessionArb, { minLength: 0, maxLength: 10 }),
        async (userId, sessions) => {
          const expectedTotal = sessions.reduce((sum, s) => sum + s.lastWordIndex, 0)

          // Mock Book.countDocuments
          ;(Book.countDocuments as jest.Mock).mockResolvedValue(0)

          // Mock ReadingSession.findOne for lastSession (chained .sort().lean())
          const leanMock = jest.fn().mockResolvedValue(null)
          const sortMock = jest.fn().mockReturnValue({ lean: leanMock })
          ;(ReadingSession.findOne as jest.Mock).mockReturnValue({ sort: sortMock })

          // Capture the aggregate pipeline to verify user scoping (Req 8.4)
          let capturedPipeline: any[] | null = null
          ;(ReadingSession.aggregate as jest.Mock).mockImplementation((pipeline: any[]) => {
            capturedPipeline = pipeline
            return Promise.resolve(expectedTotal > 0 ? [{ _id: null, total: expectedTotal }] : [])
          })

          const req = makeReq(userId)
          const res = makeRes()
          await getAnalytics(req, res)

          const body = (res.json as jest.Mock).mock.calls[0][0]

          // Property: totalWordsRead must equal the sum of lastWordIndex values (Req 8.1)
          expect(body.totalWordsRead).toBe(expectedTotal)

          // Property: analytics must be scoped to the authenticated user (Req 8.4)
          expect(capturedPipeline).not.toBeNull()
          const matchStage = capturedPipeline!.find((stage: any) => stage.$match)
          expect(matchStage).toBeDefined()
          // The $match stage must filter by the authenticated user's ObjectId
          expect(matchStage.$match.userId.toString()).toBe(userId)
        }
      ),
      { numRuns: 100 }
    )
  })
})
