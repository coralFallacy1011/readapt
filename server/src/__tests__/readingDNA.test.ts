import { classifyFlowState, calculateEnduranceScore, generateReadingDNA } from '../services/ml/readingDNA'
import { IReadingSession } from '../models/ReadingSession'
import ReadingSession from '../models/ReadingSession'
import Book from '../models/Book'
import User from '../models/User'
import ReadingDNA from '../models/ReadingDNA'
import Quiz from '../models/Quiz'
import mongoose from 'mongoose'

// Mock the models
jest.mock('../models/ReadingSession')
jest.mock('../models/Book')
jest.mock('../models/User')
jest.mock('../models/ReadingDNA')
jest.mock('../models/Quiz')

describe('Reading DNA Service', () => {
  describe('classifyFlowState', () => {
    it('should classify as flow state when all conditions are met', () => {
      const session = {
        timeSpent: 600, // exactly 10 minutes
        pauseEvents: [
          { wordIndex: 10, duration: 1000 },
          { wordIndex: 50, duration: 2000 },
          { wordIndex: 100, duration: 3000 } // exactly 3 seconds
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() },
          { wordIndex: 100, oldWPM: 305, newWPM: 302, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should classify as flow state with duration > 10 minutes', () => {
      const session = {
        timeSpent: 900, // 15 minutes
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should not classify as flow state with duration < 10 minutes', () => {
      const session = {
        timeSpent: 599, // just under 10 minutes
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })

    it('should not classify as flow state with pauses > 3 seconds', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [
          { wordIndex: 10, duration: 3001 } // just over 3 seconds
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })

    it('should classify as flow state with pauses exactly at 3 seconds', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [
          { wordIndex: 10, duration: 3000 }, // exactly 3 seconds
          { wordIndex: 50, duration: 2500 },
          { wordIndex: 100, duration: 1000 }
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should not classify as flow state with WPM variance >= 10%', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 350, timestamp: new Date() }, // High variance
          { wordIndex: 100, oldWPM: 350, newWPM: 250, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })

    it('should classify as flow state with WPM variance < 10%', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() },
          { wordIndex: 100, oldWPM: 305, newWPM: 310, timestamp: new Date() },
          { wordIndex: 150, oldWPM: 310, newWPM: 295, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should handle session with no speed changes', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [],
        speedChanges: []
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true) // 0 variance when no changes
    })

    it('should handle session with no pauses', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should not classify as flow state with multiple long pauses', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [
          { wordIndex: 10, duration: 4000 },
          { wordIndex: 50, duration: 5000 },
          { wordIndex: 100, duration: 3500 }
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })

    it('should handle edge case: exactly 10 minutes, exactly 3 second pauses, exactly 10% variance', () => {
      const session = {
        timeSpent: 600, // exactly 10 minutes
        pauseEvents: [
          { wordIndex: 10, duration: 3000 } // exactly 3 seconds
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 330, timestamp: new Date() } // exactly 10% variance
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      // Should be true: duration >= 600, pauses <= 3000, variance should be < 0.1
      expect(result).toBe(true)
    })

    it('should classify correctly with very consistent WPM', () => {
      const session = {
        timeSpent: 720, // 12 minutes
        pauseEvents: [
          { wordIndex: 10, duration: 500 },
          { wordIndex: 50, duration: 800 }
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 301, timestamp: new Date() },
          { wordIndex: 100, oldWPM: 301, newWPM: 300, timestamp: new Date() },
          { wordIndex: 150, oldWPM: 300, newWPM: 302, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should not classify with short duration even if other conditions met', () => {
      const session = {
        timeSpent: 300, // only 5 minutes
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 50, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })

    it('should handle session with single speed change', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(true)
    })

    it('should not classify with one long pause among many short pauses', () => {
      const session = {
        timeSpent: 600,
        pauseEvents: [
          { wordIndex: 10, duration: 500 },
          { wordIndex: 20, duration: 800 },
          { wordIndex: 30, duration: 1200 },
          { wordIndex: 40, duration: 3001 }, // one long pause
          { wordIndex: 50, duration: 600 }
        ],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
        ]
      } as unknown as IReadingSession

      const result = classifyFlowState(session)
      expect(result).toBe(false)
    })
  })

  describe('calculateEnduranceScore', () => {
    it('should calculate endurance score with no streak', () => {
      const score = calculateEnduranceScore(30, 0)
      // (30 / 30) * (1 + 0) = 1.0
      expect(score).toBe(1.0)
    })

    it('should calculate endurance score with 15-day streak', () => {
      const score = calculateEnduranceScore(30, 15)
      // (30 / 30) * (1 + 15/30) = 1.0 * 1.5 = 1.5
      expect(score).toBe(1.5)
    })

    it('should cap streak bonus at 1.0 for 30-day streak', () => {
      const score = calculateEnduranceScore(30, 30)
      // (30 / 30) * (1 + min(30/30, 1.0)) = 1.0 * 2.0 = 2.0
      expect(score).toBe(2.0)
    })

    it('should cap streak bonus at 1.0 for streaks over 30 days', () => {
      const score = calculateEnduranceScore(30, 60)
      // (30 / 30) * (1 + min(60/30, 1.0)) = 1.0 * 2.0 = 2.0
      expect(score).toBe(2.0)
    })

    it('should calculate endurance score with 100-day streak (capped)', () => {
      const score = calculateEnduranceScore(30, 100)
      // (30 / 30) * (1 + min(100/30, 1.0)) = 1.0 * 2.0 = 2.0
      expect(score).toBe(2.0)
    })

    it('should handle zero average session duration', () => {
      const score = calculateEnduranceScore(0, 10)
      // (0 / 30) * (1 + 10/30) = 0
      expect(score).toBe(0)
    })

    it('should handle zero duration and zero streak', () => {
      const score = calculateEnduranceScore(0, 0)
      // (0 / 30) * (1 + 0) = 0
      expect(score).toBe(0)
    })

    it('should calculate endurance score with short sessions', () => {
      const score = calculateEnduranceScore(10, 5)
      // (10 / 30) * (1 + 5/30) = 0.333... * 1.166... ≈ 0.389
      expect(score).toBeCloseTo(0.389, 2)
    })

    it('should calculate endurance score with long sessions', () => {
      const score = calculateEnduranceScore(60, 10)
      // (60 / 30) * (1 + 10/30) = 2.0 * 1.333... ≈ 2.667
      expect(score).toBeCloseTo(2.667, 2)
    })

    it('should calculate endurance score with very long sessions and max streak', () => {
      const score = calculateEnduranceScore(90, 45)
      // (90 / 30) * (1 + min(45/30, 1.0)) = 3.0 * 2.0 = 6.0
      expect(score).toBe(6.0)
    })

    it('should handle fractional session durations', () => {
      const score = calculateEnduranceScore(22.5, 7)
      // (22.5 / 30) * (1 + 7/30) = 0.75 * 1.233... ≈ 0.925
      expect(score).toBeCloseTo(0.925, 2)
    })

    it('should calculate endurance score at exactly 30-minute sessions', () => {
      const score = calculateEnduranceScore(30, 20)
      // (30 / 30) * (1 + 20/30) = 1.0 * 1.666... ≈ 1.667
      expect(score).toBeCloseTo(1.667, 2)
    })

    it('should handle 1-day streak', () => {
      const score = calculateEnduranceScore(15, 1)
      // (15 / 30) * (1 + 1/30) = 0.5 * 1.033... ≈ 0.517
      expect(score).toBeCloseTo(0.517, 2)
    })

    it('should handle 29-day streak (just below cap)', () => {
      const score = calculateEnduranceScore(30, 29)
      // (30 / 30) * (1 + 29/30) = 1.0 * 1.966... ≈ 1.967
      expect(score).toBeCloseTo(1.967, 2)
    })

    it('should calculate endurance score with realistic values', () => {
      const score = calculateEnduranceScore(25, 14)
      // (25 / 30) * (1 + 14/30) = 0.833... * 1.466... ≈ 1.222
      expect(score).toBeCloseTo(1.222, 2)
    })

    it('should handle very short sessions with no streak', () => {
      const score = calculateEnduranceScore(5, 0)
      // (5 / 30) * (1 + 0) = 0.166... * 1.0 ≈ 0.167
      expect(score).toBeCloseTo(0.167, 2)
    })

    it('should handle very short sessions with max streak', () => {
      const score = calculateEnduranceScore(5, 50)
      // (5 / 30) * (1 + min(50/30, 1.0)) = 0.166... * 2.0 ≈ 0.333
      expect(score).toBeCloseTo(0.333, 2)
    })
  })

  describe('generateReadingDNA', () => {
    const mockUserId = new mongoose.Types.ObjectId().toString()
    const mockBookId1 = new mongoose.Types.ObjectId()
    const mockBookId2 = new mongoose.Types.ObjectId()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should throw error with insufficient sessions', async () => {
      // Mock only 5 sessions (need 10)
      const mockSessions = Array(5).fill(null).map((_, i) => ({
        userId: mockUserId,
        bookId: mockBookId1,
        currentWPM: 300,
        lastWordIndex: 1000,
        timeSpent: 600,
        date: new Date(Date.now() - i * 86400000),
        pauseEvents: [],
        speedChanges: [{ wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }],
        readingVelocity: 300
      }));

      (ReadingSession.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSessions)
        })
      })

      await expect(generateReadingDNA(mockUserId)).rejects.toThrow('Insufficient data')
    })

    it('should throw error with insufficient words', async () => {
      // Mock 10 sessions but only 4000 words total (need 5000)
      const mockSessions = Array(10).fill(null).map((_, i) => ({
        userId: mockUserId,
        bookId: mockBookId1,
        currentWPM: 300,
        lastWordIndex: 400, // 10 * 400 = 4000 words
        timeSpent: 600,
        date: new Date(Date.now() - i * 86400000),
        pauseEvents: [],
        speedChanges: [{ wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }],
        readingVelocity: 300
      }));

      (ReadingSession.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSessions)
        })
      })

      await expect(generateReadingDNA(mockUserId)).rejects.toThrow('Insufficient data')
    })

    it('should generate complete Reading DNA with sufficient data', async () => {
      // Mock 15 sessions with 6000 words total
      const mockSessions = Array(15).fill(null).map((_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        userId: mockUserId,
        bookId: i % 2 === 0 ? mockBookId1 : mockBookId2,
        currentWPM: 300 + (i % 3) * 10, // Varying WPM
        lastWordIndex: 400,
        timeSpent: 600 + i * 60, // Varying duration
        date: new Date(Date.now() - i * 86400000),
        pauseEvents: [],
        speedChanges: [
          { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
          { wordIndex: 100, oldWPM: 300, newWPM: 305, timestamp: new Date() }
        ],
        readingVelocity: 300 + i * 5
      }));

      const mockBooks = [
        {
          _id: mockBookId1,
          genre: 'Fiction',
          totalWords: 50000,
          isCompleted: true
        },
        {
          _id: mockBookId2,
          genre: 'Non-Fiction',
          totalWords: 60000,
          isCompleted: true
        }
      ];

      const mockUser = {
        _id: mockUserId,
        currentStreak: 15
      };

      const mockQuizzes = [
        { userId: mockUserId, bookId: mockBookId1, score: 85 },
        { userId: mockUserId, bookId: mockBookId2, score: 90 }
      ];

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 305,
        medianWPM: 300,
        wpmStandardDeviation: 5.77
      };

      (ReadingSession.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSessions)
        })
      });

      (Book.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooks)
      });

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (Quiz.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuizzes)
      });

      (ReadingDNA.findOneAndUpdate as jest.Mock).mockResolvedValue(mockDNA)

      const result = await generateReadingDNA(mockUserId)

      expect(result).toBeDefined()
      expect(ReadingSession.find).toHaveBeenCalledWith({ userId: mockUserId })
      expect(User.findById).toHaveBeenCalledWith(mockUserId)
      expect(ReadingDNA.findOneAndUpdate).toHaveBeenCalled()
    })
  })
})
