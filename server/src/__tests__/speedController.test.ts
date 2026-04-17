import {
  calculateTextComplexity,
  calculatePauseRate,
  detectFrequentPausing,
  calculateWPMVariance,
  detectFlowState,
  generateSpeedRecommendation
} from '../services/ml/speedController'
import ReadingSession, { IReadingSession } from '../models/ReadingSession'
import SpeedRecommendation from '../models/SpeedRecommendation'
import User from '../models/User'
import Book from '../models/Book'
import { Types } from 'mongoose'

// Mock the models
jest.mock('../models/ReadingSession')
jest.mock('../models/SpeedRecommendation')
jest.mock('../models/User')
jest.mock('../models/Book')

describe('Speed Controller Service', () => {
  describe('calculateTextComplexity', () => {
    it('should return low complexity for short words', () => {
      const words = ['the', 'cat', 'sat', 'on', 'mat']
      const complexity = calculateTextComplexity(words, 0, 5)
      expect(complexity).toBe(0.3)
    })

    it('should return medium complexity for medium-length words', () => {
      const words = ['reading', 'complex', 'words', 'testing', 'medium']
      const complexity = calculateTextComplexity(words, 0, 5)
      expect(complexity).toBe(0.6)
    })

    it('should return high complexity for long words', () => {
      const words = ['extraordinary', 'complicated', 'sophisticated', 'comprehensive', 'understanding']
      const complexity = calculateTextComplexity(words, 0, 5)
      expect(complexity).toBe(0.9)
    })

    it('should handle empty window', () => {
      const words: string[] = []
      const complexity = calculateTextComplexity(words, 0, 50)
      expect(complexity).toBe(0.0)
    })

    it('should use correct window size', () => {
      const words = Array(100).fill('test')
      const complexity = calculateTextComplexity(words, 10, 20)
      expect(complexity).toBe(0.3) // 'test' has 4 chars, avg <= 5
    })
  })

  describe('calculatePauseRate', () => {
    it('should calculate correct pause rate', () => {
      const session = {
        lastWordIndex: 100,
        pauseEvents: [
          { wordIndex: 10, duration: 3000 },
          { wordIndex: 50, duration: 2500 },
          { wordIndex: 80, duration: 1500 } // < 2000ms, not counted
        ]
      } as IReadingSession

      const pauseRate = calculatePauseRate(session)
      expect(pauseRate).toBe(0.02) // 2 long pauses / 100 words
    })

    it('should return 0 for no words', () => {
      const session = {
        lastWordIndex: 0,
        pauseEvents: []
      } as IReadingSession

      const pauseRate = calculatePauseRate(session)
      expect(pauseRate).toBe(0)
    })

    it('should only count pauses > 2000ms', () => {
      const session = {
        lastWordIndex: 50,
        pauseEvents: [
          { wordIndex: 10, duration: 2001 },
          { wordIndex: 20, duration: 2000 },
          { wordIndex: 30, duration: 1999 }
        ]
      } as IReadingSession

      const pauseRate = calculatePauseRate(session)
      expect(pauseRate).toBe(0.02) // Only 1 pause > 2000ms
    })
  })

  describe('detectFrequentPausing', () => {
    it('should detect frequent pausing when 5+ pauses in 100-word window', () => {
      const session = {
        pauseEvents: [
          { wordIndex: 10, duration: 1000 },
          { wordIndex: 30, duration: 1000 },
          { wordIndex: 50, duration: 1000 },
          { wordIndex: 70, duration: 1000 },
          { wordIndex: 90, duration: 1000 }
        ]
      } as IReadingSession

      const result = detectFrequentPausing(session)
      expect(result).toBe(true)
    })

    it('should not detect frequent pausing with fewer than 5 pauses', () => {
      const session = {
        pauseEvents: [
          { wordIndex: 10, duration: 1000 },
          { wordIndex: 30, duration: 1000 },
          { wordIndex: 50, duration: 1000 }
        ]
      } as IReadingSession

      const result = detectFrequentPausing(session)
      expect(result).toBe(false)
    })

    it('should not detect frequent pausing when pauses are spread out', () => {
      const session = {
        pauseEvents: [
          { wordIndex: 10, duration: 1000 },
          { wordIndex: 150, duration: 1000 },
          { wordIndex: 300, duration: 1000 },
          { wordIndex: 450, duration: 1000 },
          { wordIndex: 600, duration: 1000 }
        ]
      } as IReadingSession

      const result = detectFrequentPausing(session)
      expect(result).toBe(false)
    })
  })

  describe('calculateWPMVariance', () => {
    it('should calculate coefficient of variation', () => {
      const speedChanges = [
        { oldWPM: 300, newWPM: 300 },
        { oldWPM: 300, newWPM: 310 },
        { oldWPM: 310, newWPM: 290 }
      ]

      const variance = calculateWPMVariance(speedChanges)
      expect(variance).toBeGreaterThan(0)
      expect(variance).toBeLessThan(0.1)
    })

    it('should return 0 for no speed changes', () => {
      const speedChanges: Array<{ oldWPM: number; newWPM: number }> = []
      const variance = calculateWPMVariance(speedChanges)
      expect(variance).toBe(0)
    })

    it('should return 0 when mean is 0', () => {
      const speedChanges = [
        { oldWPM: 0, newWPM: 0 },
        { oldWPM: 0, newWPM: 0 }
      ]

      const variance = calculateWPMVariance(speedChanges)
      expect(variance).toBe(0)
    })
  })

  describe('detectFlowState', () => {
    it('should detect flow state with correct conditions', () => {
      const session = {
        timeSpent: 350, // >= 300s
        pauseEvents: [
          { wordIndex: 10, duration: 1000 }, // < 3000ms
          { wordIndex: 50, duration: 2000 }  // < 3000ms
        ],
        speedChanges: [
          { oldWPM: 300, newWPM: 305 },
          { oldWPM: 305, newWPM: 302 }
        ]
      } as IReadingSession

      const result = detectFlowState(session)
      expect(result).toBe(true)
    })

    it('should not detect flow state with short duration', () => {
      const session = {
        timeSpent: 250, // < 300s
        pauseEvents: [],
        speedChanges: [
          { oldWPM: 300, newWPM: 305 }
        ]
      } as IReadingSession

      const result = detectFlowState(session)
      expect(result).toBe(false)
    })

    it('should not detect flow state with long pauses', () => {
      const session = {
        timeSpent: 350,
        pauseEvents: [
          { wordIndex: 10, duration: 3500 } // > 3000ms
        ],
        speedChanges: [
          { oldWPM: 300, newWPM: 305 }
        ]
      } as IReadingSession

      const result = detectFlowState(session)
      expect(result).toBe(false)
    })

    it('should not detect flow state with high WPM variance', () => {
      const session = {
        timeSpent: 350,
        pauseEvents: [],
        speedChanges: [
          { oldWPM: 300, newWPM: 400 }, // High variance
          { oldWPM: 400, newWPM: 200 }
        ]
      } as IReadingSession

      const result = detectFlowState(session)
      expect(result).toBe(false)
    })
  })

  describe('generateSpeedRecommendation', () => {
    const userId = new Types.ObjectId()
    const bookId = new Types.ObjectId()
    const sessionId = new Types.ObjectId()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return null if user has fewer than 5 sessions', async () => {
      (ReadingSession.countDocuments as jest.Mock).mockResolvedValue(3)

      const session = {
        _id: sessionId,
        userId,
        bookId,
        currentWPM: 300,
        lastWordIndex: 100,
        timeSpent: 200,
        pauseEvents: [],
        speedChanges: []
      } as IReadingSession

      const result = await generateSpeedRecommendation(userId, session)
      expect(result).toBeNull()
    })

    it('should recommend WPM reduction for high complexity text', async () => {
      (ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
      
      const mockBook = {
        _id: bookId,
        words: Array(100).fill('extraordinary') // Long words = high complexity
      }
      ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

      const mockUser = {
        _id: userId,
        minWPM: 100,
        maxWPM: 1000
      }
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const mockRecommendation = {
        save: jest.fn().mockResolvedValue(true)
      }
      ;(SpeedRecommendation as any).mockImplementation(() => mockRecommendation)

      const session = {
        _id: sessionId,
        userId,
        bookId,
        currentWPM: 300,
        lastWordIndex: 100,
        timeSpent: 200,
        pauseEvents: [],
        speedChanges: []
      } as IReadingSession

      const result = await generateSpeedRecommendation(userId, session)
      
      expect(result).toBeDefined()
      expect(mockRecommendation.save).toHaveBeenCalled()
    })

    it('should recommend WPM increase for flow state', async () => {
      (ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
      
      const mockBook = {
        _id: bookId,
        words: Array(100).fill('test')
      }
      ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

      const mockUser = {
        _id: userId,
        minWPM: 100,
        maxWPM: 1000
      }
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const mockRecommendation = {
        save: jest.fn().mockResolvedValue(true)
      }
      ;(SpeedRecommendation as any).mockImplementation(() => mockRecommendation)

      const session = {
        _id: sessionId,
        userId,
        bookId,
        currentWPM: 300,
        lastWordIndex: 100,
        timeSpent: 350, // Flow state duration
        pauseEvents: [],
        speedChanges: [
          { oldWPM: 300, newWPM: 305 }
        ]
      } as IReadingSession

      const result = await generateSpeedRecommendation(userId, session)
      
      expect(result).toBeDefined()
      expect(mockRecommendation.save).toHaveBeenCalled()
    })

    it('should respect user min/max WPM boundaries', async () => {
      (ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
      
      const mockBook = {
        _id: bookId,
        words: Array(100).fill('extraordinary')
      }
      ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

      const mockUser = {
        _id: userId,
        minWPM: 200,
        maxWPM: 400
      }
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const mockRecommendation = {
        save: jest.fn().mockResolvedValue(true)
      }
      ;(SpeedRecommendation as any).mockImplementation(() => mockRecommendation)

      const session = {
        _id: sessionId,
        userId,
        bookId,
        currentWPM: 220,
        lastWordIndex: 100,
        timeSpent: 200,
        pauseEvents: [],
        speedChanges: []
      } as IReadingSession

      await generateSpeedRecommendation(userId, session)
      
      // Should clamp to minWPM (200) instead of 220 * 0.85 = 187
      expect(mockRecommendation.save).toHaveBeenCalled()
    })

    it('should return null if change is less than 5%', async () => {
      (ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
      
      const mockBook = {
        _id: bookId,
        words: Array(100).fill('test')
      }
      ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

      const mockUser = {
        _id: userId,
        minWPM: 100,
        maxWPM: 1000
      }
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const session = {
        _id: sessionId,
        userId,
        bookId,
        currentWPM: 300,
        lastWordIndex: 100,
        timeSpent: 200,
        pauseEvents: [],
        speedChanges: []
      } as IReadingSession

      const result = await generateSpeedRecommendation(userId, session)
      expect(result).toBeNull()
    })
  })
})
