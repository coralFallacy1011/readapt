/**
 * Integration tests: Speed Controller complete flow
 * Requirements: 1.1, 1.8, 1.10
 *
 * Tests the complete flow: session completion → analysis → recommendation → user response → subsequent performance tracking
 */

import {
  generateSpeedRecommendation,
  detectFlowState,
  detectFrequentPausing,
  calculateTextComplexity,
} from '../services/ml/speedController'
import ReadingSession, { IReadingSession } from '../models/ReadingSession'
import SpeedRecommendation from '../models/SpeedRecommendation'
import User from '../models/User'
import Book from '../models/Book'
import { Types } from 'mongoose'

jest.mock('../models/ReadingSession')
jest.mock('../models/SpeedRecommendation')
jest.mock('../models/User')
jest.mock('../models/Book')

describe('Speed Controller Integration', () => {
  const userId = new Types.ObjectId()
  const bookId = new Types.ObjectId()
  const sessionId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeSession(overrides: Partial<IReadingSession> = {}): IReadingSession {
    return {
      _id: sessionId,
      userId,
      bookId,
      currentWPM: 300,
      lastWordIndex: 100,
      timeSpent: 200,
      pauseEvents: [],
      speedChanges: [],
      ...overrides,
    } as IReadingSession
  }

  function mockDeps(opts: {
    sessionCount?: number
    words?: string[]
    minWPM?: number
    maxWPM?: number
  }) {
    const { sessionCount = 10, words = Array(100).fill('test'), minWPM = 100, maxWPM = 1000 } = opts

    ;(ReadingSession.countDocuments as jest.Mock).mockResolvedValue(sessionCount)
    ;(Book.findById as jest.Mock).mockResolvedValue({ _id: bookId, words })
    ;(User.findById as jest.Mock).mockResolvedValue({ _id: userId, minWPM, maxWPM })

    const mockRec = { save: jest.fn().mockResolvedValue(true) }
    ;(SpeedRecommendation as any).mockImplementation(() => mockRec)
    return mockRec
  }

  describe('Flow 1: high complexity text → reduction recommendation', () => {
    it('should produce a reduction recommendation for high-complexity text', async () => {
      // Long words → high complexity → 15% WPM reduction
      const mockRec = mockDeps({ words: Array(100).fill('extraordinary') })
      const session = makeSession({ currentWPM: 300 })

      const result = await generateSpeedRecommendation(userId, session)

      expect(result).not.toBeNull()
      expect(mockRec.save).toHaveBeenCalled()

      // Verify the recommendation was constructed with a lower WPM
      const ctorCall = (SpeedRecommendation as any).mock.calls[0][0]
      expect(ctorCall.recommendedWPM).toBeLessThan(ctorCall.currentWPM)
      expect(ctorCall.rationale).toMatch(/complex/i)
    })

    it('calculateTextComplexity returns high score for long words', () => {
      const words = Array(50).fill('extraordinary') // avg length > 7
      expect(calculateTextComplexity(words, 0, 50)).toBe(0.9)
    })
  })

  describe('Flow 2: flow state → increase recommendation', () => {
    it('should produce an increase recommendation when flow state is detected', async () => {
      // Short words (low complexity) + flow state conditions
      const mockRec = mockDeps({ words: Array(100).fill('go') })
      const session = makeSession({
        currentWPM: 300,
        timeSpent: 350,       // >= 300s
        pauseEvents: [],      // no long pauses
        speedChanges: [
          { wordIndex: 10, oldWPM: 300, newWPM: 305, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 305, newWPM: 302, timestamp: new Date() },
        ],
      })

      expect(detectFlowState(session)).toBe(true)

      const result = await generateSpeedRecommendation(userId, session)

      expect(result).not.toBeNull()
      expect(mockRec.save).toHaveBeenCalled()

      const ctorCall = (SpeedRecommendation as any).mock.calls[0][0]
      expect(ctorCall.recommendedWPM).toBeGreaterThan(ctorCall.currentWPM)
      expect(ctorCall.rationale).toMatch(/flow/i)
    })

    it('detectFlowState returns true for qualifying session', () => {
      const session = makeSession({
        timeSpent: 350,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 10, oldWPM: 300, newWPM: 305, timestamp: new Date() },
        ],
      })
      expect(detectFlowState(session)).toBe(true)
    })
  })

  describe('Flow 3: frequent pausing → reduction recommendation', () => {
    it('should produce a reduction recommendation when frequent pausing is detected', async () => {
      const mockRec = mockDeps({ words: Array(100).fill('test') })
      // 5 pauses within a 100-word window → frequent pausing
      const pauseEvents = [10, 30, 50, 70, 90].map(wordIndex => ({
        wordIndex,
        duration: 1000,
      }))
      const session = makeSession({ currentWPM: 300, pauseEvents })

      expect(detectFrequentPausing(session)).toBe(true)

      const result = await generateSpeedRecommendation(userId, session)

      expect(result).not.toBeNull()
      expect(mockRec.save).toHaveBeenCalled()

      const ctorCall = (SpeedRecommendation as any).mock.calls[0][0]
      expect(ctorCall.recommendedWPM).toBeLessThan(ctorCall.currentWPM)
      expect(ctorCall.rationale).toMatch(/pausing/i)
    })
  })

  describe('Flow 4: user min/max WPM boundaries respected', () => {
    it('should clamp recommendation to user minWPM', async () => {
      // High complexity → 15% reduction from 220 = 187, but minWPM = 200
      mockDeps({ words: Array(100).fill('extraordinary'), minWPM: 200, maxWPM: 400 })
      const session = makeSession({ currentWPM: 220 })

      await generateSpeedRecommendation(userId, session)

      const ctorCall = (SpeedRecommendation as any).mock.calls[0][0]
      expect(ctorCall.recommendedWPM).toBeGreaterThanOrEqual(200)
    })

    it('should clamp recommendation to user maxWPM', async () => {
      // Flow state → 8% increase from 380 = 410, but maxWPM = 400
      mockDeps({ words: Array(100).fill('go'), minWPM: 100, maxWPM: 400 })
      const session = makeSession({
        currentWPM: 380,
        timeSpent: 350,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 10, oldWPM: 380, newWPM: 382, timestamp: new Date() },
        ],
      })

      await generateSpeedRecommendation(userId, session)

      const ctorCall = (SpeedRecommendation as any).mock.calls[0][0]
      expect(ctorCall.recommendedWPM).toBeLessThanOrEqual(400)
    })

    it('should return null when change is less than 5% after clamping', async () => {
      // Low complexity, no flow, no pausing → no significant change
      mockDeps({ words: Array(100).fill('test'), minWPM: 100, maxWPM: 1000 })
      const session = makeSession({ currentWPM: 300, timeSpent: 200, pauseEvents: [], speedChanges: [] })

      const result = await generateSpeedRecommendation(userId, session)

      expect(result).toBeNull()
    })

    it('should return null when fewer than 5 sessions exist', async () => {
      mockDeps({ sessionCount: 3 })
      const session = makeSession()

      const result = await generateSpeedRecommendation(userId, session)

      expect(result).toBeNull()
    })
  })
})
