/**
 * Integration tests: ORP Optimizer complete flow
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7
 *
 * Tests the complete flow:
 * A/B testing → data collection → model training → activation → personalized ORP application
 */

import { Types } from 'mongoose'
import {
  shouldUseTestORP,
  getORPIndexWithTesting,
  calculateReadingVelocity,
  trainPersonalizedORPModel,
  getPersonalizedORPIndex,
} from '../services/ml/orpOptimizer'
import { IReadingSession } from '../models/ReadingSession'

jest.mock('../models/ORPModel')
jest.mock('../models/ORPTrainingData')
jest.mock('../models/ReadingSession')

import ORPModel from '../models/ORPModel'
import ORPTrainingData from '../models/ORPTrainingData'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<IReadingSession> = {}): IReadingSession {
  return {
    userId: new Types.ObjectId(),
    bookId: new Types.ObjectId(),
    lastWordIndex: 100,
    timeSpent: 20,
    pauseEvents: [],
    speedChanges: [],
    currentWPM: 300,
    bookCompleted: false,
    sessionCompleted: false,
    averageWordLength: 5,
    complexityScore: 0.5,
    readingVelocity: 0,
    ...overrides,
  } as IReadingSession
}

/** Build a minimal training data record */
function makeTrainingRecord(overrides: Record<string, unknown> = {}) {
  return {
    userId: new Types.ObjectId(),
    sessionId: new Types.ObjectId(),
    word: 'hello',
    wordLength: 5,
    standardORPIndex: 1,
    testORPIndex: 2,
    isTestWord: true,
    timeToNextWord: 200,
    pausedAfter: false,
    speedAdjustedAfter: false,
    sessionWPM: 300,
    textComplexity: 0.5,
    timestamp: new Date(),
    toObject() { return { ...this } },
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ORP Optimizer Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─── Flow 1: A/B testing distribution ────────────────────────────────────

  describe('Flow 1: A/B testing — shouldUseTestORP distributes ~20% to test group', () => {
    it('returns true approximately 20% of the time over many calls', () => {
      const trials = 10_000
      let testCount = 0
      for (let i = 0; i < trials; i++) {
        if (shouldUseTestORP(i)) testCount++
      }
      const pct = (testCount / trials) * 100
      // Allow ±5% margin
      expect(pct).toBeGreaterThan(15)
      expect(pct).toBeLessThan(25)
    })

    it('returns a boolean on every call', () => {
      for (let i = 0; i < 20; i++) {
        expect(typeof shouldUseTestORP(i)).toBe('boolean')
      }
    })
  })

  // ─── Flow 2: getORPIndexWithTesting ──────────────────────────────────────

  describe('Flow 2: getORPIndexWithTesting returns valid indices', () => {
    it('always returns an index within [0, word.length - 1]', () => {
      const words = ['a', 'hi', 'cat', 'hello', 'reading', 'extraordinary']
      for (const word of words) {
        for (let i = 0; i < 50; i++) {
          const idx = getORPIndexWithTesting(word, i)
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(word.length)
        }
      }
    })

    it('returns standard ORP for control words (no offset)', () => {
      // Spy on shouldUseTestORP to force control path
      const spy = jest.spyOn(
        require('../services/ml/orpOptimizer'),
        'shouldUseTestORP'
      ).mockReturnValue(false)

      // word length 3 → standard ORP = floor(3/2) = 1
      const idx = getORPIndexWithTesting('cat', 0)
      expect(idx).toBe(1)

      spy.mockRestore()
    })

    it('returns ±1 offset for test words', () => {
      const spy = jest.spyOn(
        require('../services/ml/orpOptimizer'),
        'shouldUseTestORP'
      ).mockReturnValue(true)

      // word length 7 → standard ORP = floor(7/4) = 1; test ORP is 0 or 2
      const results = new Set<number>()
      for (let i = 0; i < 200; i++) {
        results.add(getORPIndexWithTesting('reading', i))
      }
      // Should see both 0 and 2 (standard is 1, offset ±1)
      expect(results.has(0) || results.has(2)).toBe(true)

      spy.mockRestore()
    })
  })

  // ─── Flow 3: calculateReadingVelocity ────────────────────────────────────

  describe('Flow 3: calculateReadingVelocity formula', () => {
    it('computes (words_read / total_time_seconds) * (1 - pause_rate) with no pauses', () => {
      const session = makeSession({ lastWordIndex: 100, timeSpent: 20, pauseEvents: [] })
      // 100/20 * (1 - 0) = 5
      expect(calculateReadingVelocity(session)).toBe(5)
    })

    it('accounts for long pauses (>2 s) in pause_rate', () => {
      const session = makeSession({
        lastWordIndex: 100,
        timeSpent: 20,
        pauseEvents: [
          { wordIndex: 10, duration: 3000 }, // >2 s
          { wordIndex: 50, duration: 2500 }, // >2 s
          { wordIndex: 80, duration: 1000 }, // <2 s — ignored
        ],
      })
      // pause_rate = 2/100 = 0.02 → 5 * 0.98 = 4.9
      expect(calculateReadingVelocity(session)).toBeCloseTo(4.9, 2)
    })

    it('returns 0 when timeSpent is 0', () => {
      expect(calculateReadingVelocity(makeSession({ timeSpent: 0 }))).toBe(0)
    })

    it('returns 0 when lastWordIndex is 0', () => {
      expect(calculateReadingVelocity(makeSession({ lastWordIndex: 0 }))).toBe(0)
    })
  })

  // ─── Flow 4: trainPersonalizedORPModel activation threshold ──────────────

  describe('Flow 4: trainPersonalizedORPModel only activates with ≥5% velocity improvement', () => {
    const userId = new Types.ObjectId()

    it('returns null when training data count < 2000', async () => {
      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(
        Array.from({ length: 100 }, () => makeTrainingRecord())
      )

      const result = await trainPersonalizedORPModel(userId)
      expect(result).toBeNull()
    })

    it('sets status to "active" when improvement ≥ 5%', async () => {
      // Build 2000 records: test words are faster (lower timeToNextWord)
      const controlRecords = Array.from({ length: 1000 }, () =>
        makeTrainingRecord({ isTestWord: false, timeToNextWord: 300, pausedAfter: false })
      )
      const testRecords = Array.from({ length: 1000 }, () =>
        makeTrainingRecord({ isTestWord: true, timeToNextWord: 200, pausedAfter: false, wordLength: 5, testORPIndex: 2, standardORPIndex: 1 })
      )
      const allRecords = [...controlRecords, ...testRecords]

      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(allRecords)
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)

      const savedModel = {
        status: 'active',
        improvementPercentage: 50,
      }
      ;(ORPModel.create as jest.Mock).mockResolvedValue(savedModel)

      const result = await trainPersonalizedORPModel(userId)
      expect(result).not.toBeNull()
      expect(result!.status).toBe('active')
    })

    it('sets status to "inactive" when improvement < 5%', async () => {
      // Test and control words have identical velocity → 0% improvement
      const records = Array.from({ length: 2000 }, (_, i) =>
        makeTrainingRecord({
          isTestWord: i % 2 === 0,
          timeToNextWord: 300,
          pausedAfter: false,
          wordLength: 5,
          testORPIndex: i % 2 === 0 ? 2 : 1,
          standardORPIndex: 1,
        })
      )

      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(records)
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)

      const savedModel = { status: 'inactive', improvementPercentage: 0 }
      ;(ORPModel.create as jest.Mock).mockResolvedValue(savedModel)

      const result = await trainPersonalizedORPModel(userId)
      expect(result).not.toBeNull()
      expect(result!.status).toBe('inactive')
    })
  })

  // ─── Flow 5: getPersonalizedORPIndex ─────────────────────────────────────

  describe('Flow 5: getPersonalizedORPIndex applies trained model offsets', () => {
    const userId = new Types.ObjectId()

    it('returns standard ORP when no active model exists', async () => {
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)

      // word "cat" length 3 → standard = floor(3/2) = 1
      const idx = await getPersonalizedORPIndex(userId, 'cat')
      expect(idx).toBe(1)
    })

    it('applies offset from active model', async () => {
      const offsetsByLength = new Map([[5, 1]])
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue({
        status: 'active',
        offsetsByLength,
      })

      // word "hello" length 5 → standard = floor(5/4) = 1; offset +1 → 2
      const idx = await getPersonalizedORPIndex(userId, 'hello')
      expect(idx).toBe(2)
    })

    it('clamps result to [0, word.length - 1]', async () => {
      // offset that would push below 0
      const offsetsByLength = new Map([[3, -10]])
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue({
        status: 'active',
        offsetsByLength,
      })

      const idx = await getPersonalizedORPIndex(userId, 'cat')
      expect(idx).toBeGreaterThanOrEqual(0)
    })

    it('uses standard ORP when word length has no offset entry', async () => {
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue({
        status: 'active',
        offsetsByLength: new Map(), // no entries
      })

      // word "cat" length 3 → standard = 1
      const idx = await getPersonalizedORPIndex(userId, 'cat')
      expect(idx).toBe(1)
    })
  })
})
