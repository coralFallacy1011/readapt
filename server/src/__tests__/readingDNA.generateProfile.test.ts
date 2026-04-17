import { generateReadingDNA } from '../services/ml/readingDNA'
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

describe('generateReadingDNA - Additional Tests', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString()
  const mockBookId1 = new mongoose.Types.ObjectId()
  const mockBookId2 = new mongoose.Types.ObjectId()
  const mockBookId3 = new mongoose.Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should calculate correct speed metrics', async () => {
    const mockSessions = [
      { currentWPM: 300, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 300, bookId: mockBookId1 },
      { currentWPM: 310, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 310, bookId: mockBookId1 },
      { currentWPM: 290, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 290, bookId: mockBookId1 },
      { currentWPM: 305, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 305, bookId: mockBookId1 },
      { currentWPM: 295, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 295, bookId: mockBookId1 },
      { currentWPM: 300, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 300, bookId: mockBookId1 },
      { currentWPM: 310, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 310, bookId: mockBookId1 },
      { currentWPM: 290, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 290, bookId: mockBookId1 },
      { currentWPM: 305, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 305, bookId: mockBookId1 },
      { currentWPM: 295, lastWordIndex: 500, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 295, bookId: mockBookId1 }
    ]

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    const result = await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.averageWPM).toBe(300)
    expect(dnaData.medianWPM).toBe(300)
    expect(dnaData.wpmStandardDeviation).toBeCloseTo(7.07, 1)
  })

  it('should calculate optimal time of day correctly', async () => {
    const now = new Date()
    const mockSessions = Array(10).fill(null).map((_, i) => ({
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 600,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14 + (i % 4), 0), // 14:00-17:00 range
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 350, // High velocity in afternoon
      bookId: mockBookId1
    }))

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.optimalTimeOfDay).toBe('12:00-16:00')
  })

  it('should calculate genre affinity with top 3 genres', async () => {
    const mockSessions = [
      ...Array(5).fill(null).map(() => ({ currentWPM: 300, lastWordIndex: 1000, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 300, bookId: mockBookId1 })),
      ...Array(3).fill(null).map(() => ({ currentWPM: 300, lastWordIndex: 1000, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 300, bookId: mockBookId2 })),
      ...Array(2).fill(null).map(() => ({ currentWPM: 300, lastWordIndex: 1000, timeSpent: 600, date: new Date(), pauseEvents: [], speedChanges: [], readingVelocity: 300, bookId: mockBookId3 }))
    ]

    const mockBooks = [
      { _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true },
      { _id: mockBookId2, genre: 'Science', totalWords: 60000, isCompleted: true },
      { _id: mockBookId3, genre: 'History', totalWords: 40000, isCompleted: true }
    ]

    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.genreAffinity).toHaveLength(3)
    expect(dnaData.genreAffinity[0].genre).toBe('Fiction')
    expect(dnaData.genreAffinity[0].wordsRead).toBe(5000)
    expect(dnaData.genreAffinity[0].percentage).toBe(50)
  })

  it('should calculate flow state metrics correctly', async () => {
    const flowSession = {
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 720, // 12 minutes
      date: new Date(),
      pauseEvents: [{ wordIndex: 10, duration: 2000 }],
      speedChanges: [
        { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() },
        { wordIndex: 100, oldWPM: 300, newWPM: 305, timestamp: new Date() }
      ],
      readingVelocity: 300,
      bookId: mockBookId1
    }

    const nonFlowSession = {
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 300, // Only 5 minutes
      date: new Date(),
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }

    const mockSessions = [
      flowSession,
      flowSession,
      flowSession,
      nonFlowSession,
      nonFlowSession,
      nonFlowSession,
      nonFlowSession,
      nonFlowSession,
      nonFlowSession,
      nonFlowSession
    ]

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.flowStateWPMRange.min).toBe(270) // 300 * 0.9
    expect(dnaData.flowStateWPMRange.max).toBe(330) // 300 * 1.1
    expect(dnaData.flowStateDuration).toBe(12)
  })

  it('should generate WPM history for last 30 sessions', async () => {
    const mockSessions = Array(40).fill(null).map((_, i) => ({
      currentWPM: 300 + i,
      lastWordIndex: 500,
      timeSpent: 600,
      date: new Date(Date.now() - i * 86400000),
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }))

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.wpmHistory).toHaveLength(30)
    expect(dnaData.wpmHistory[0].wpm).toBe(310) // Last 30 sessions start from index 10
  })

  it('should generate activity heatmap for last 90 days', async () => {
    const now = new Date()
    const mockSessions = Array(20).fill(null).map((_, i) => ({
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 600,
      date: new Date(now.getTime() - i * 86400000 * 3), // Every 3 days
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }))

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.activityHeatmap).toHaveLength(24) // 24 hours
    expect(dnaData.activityHeatmap[0]).toHaveLength(7) // 7 days
  })

  it('should calculate comprehension scores correctly', async () => {
    const mockSessions = Array(10).fill(null).map(() => ({
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 600,
      date: new Date(),
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }))

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes = [
      { userId: mockUserId, bookId: mockBookId1, score: 80 },
      { userId: mockUserId, bookId: mockBookId1, score: 90 },
      { userId: mockUserId, bookId: mockBookId1, score: 85 }
    ]

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    await generateReadingDNA(mockUserId)

    const updateCall = (ReadingDNA.findOneAndUpdate as jest.Mock).mock.calls[0]
    const dnaData = updateCall[1]

    expect(dnaData.averageComprehensionScore).toBeCloseTo(85, 1)
  })

  it('should handle edge case with exactly 10 sessions and 5000 words', async () => {
    const mockSessions = Array(10).fill(null).map(() => ({
      currentWPM: 300,
      lastWordIndex: 500, // 10 * 500 = 5000 words
      timeSpent: 600,
      date: new Date(),
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }))

    const mockBooks = [{ _id: mockBookId1, genre: 'Fiction', totalWords: 50000, isCompleted: true }]
    const mockUser = { _id: mockUserId, currentStreak: 10 }
    const mockQuizzes: any[] = []

    setupMocks(mockSessions, mockBooks, mockUser, mockQuizzes)

    const result = await generateReadingDNA(mockUserId)

    expect(result).toBeDefined()
  })

  it('should throw error when user not found', async () => {
    const mockSessions = Array(10).fill(null).map(() => ({
      currentWPM: 300,
      lastWordIndex: 500,
      timeSpent: 600,
      date: new Date(),
      pauseEvents: [],
      speedChanges: [],
      readingVelocity: 300,
      bookId: mockBookId1
    }));

    (ReadingSession.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSessions)
      })
    });

    (User.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    })

    await expect(generateReadingDNA(mockUserId)).rejects.toThrow('User not found')
  })

  // Helper function to setup mocks
  function setupMocks(sessions: any[], books: any[], user: any, quizzes: any[]) {
    (ReadingSession.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(sessions)
      })
    });

    (Book.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(books)
    });

    (User.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(user)
    });

    (Quiz.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(quizzes)
    });

    (ReadingDNA.findOneAndUpdate as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      averageWPM: 300
    })
  }
})
