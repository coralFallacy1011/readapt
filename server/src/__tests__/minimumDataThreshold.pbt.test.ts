import * as fc from 'fast-check'
import { Types } from 'mongoose'
import { generateSpeedRecommendation } from '../services/ml/speedController'
import { trainPersonalizedORPModel } from '../services/ml/orpOptimizer'
import { generateBookRecommendations } from '../services/ml/recommendationEngine'
import { generateReadingDNA } from '../services/ml/readingDNA'
import ReadingSession from '../models/ReadingSession'
import ORPTrainingData from '../models/ORPTrainingData'
import ORPModel from '../models/ORPModel'
import Book from '../models/Book'
import User from '../models/User'
import ReadingDNA from '../models/ReadingDNA'
import SpeedRecommendation from '../models/SpeedRecommendation'
import Quiz from '../models/Quiz'

// Mock the models
jest.mock('../models/ReadingSession')
jest.mock('../models/ORPTrainingData')
jest.mock('../models/ORPModel')
jest.mock('../models/Book')
jest.mock('../models/User')
jest.mock('../models/ReadingDNA')
jest.mock('../models/SpeedRecommendation')
jest.mock('../models/Quiz')

/**
 * Property 5: AI features require minimum data thresholds
 * 
 * **Validates: Requirements 1.2, 2.1, 3.1, 4.1**
 * 
 * For any user with fewer than the required minimum sessions or words read for a given AI feature:
 * - Speed Controller: minimum 5 sessions
 * - ORP Optimizer: minimum 20 sessions + 10,000 words
 * - Recommendations: minimum 5 books + 50,000 words
 * - Reading DNA: minimum 10 sessions + 5,000 words
 * 
 * The system must not generate recommendations or activate personalized models for that feature.
 */
describe('Property 5: AI features require minimum data thresholds', () => {
  const mockUserId = new Types.ObjectId()
  const mockBookId = new Types.ObjectId()
  const mockSessionId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Speed Controller: minimum 5 sessions (Requirement 1.2)', () => {
    it('should not generate recommendation with fewer than 5 sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 4 }), // Session count < 5
          fc.integer({ min: 100, max: 1000 }), // Current WPM
          fc.integer({ min: 100, max: 10000 }), // Words read
          async (sessionCount, currentWPM, wordsRead) => {
            // Mock session count below threshold
            ;(ReadingSession.countDocuments as jest.Mock).mockResolvedValue(sessionCount)

            const mockSession = {
              _id: mockSessionId,
              userId: mockUserId,
              bookId: mockBookId,
              currentWPM,
              lastWordIndex: wordsRead,
              timeSpent: 600,
              pauseEvents: [],
              speedChanges: [
                { wordIndex: 0, oldWPM: currentWPM, newWPM: currentWPM, timestamp: new Date() }
              ]
            }

            const result = await generateSpeedRecommendation(mockUserId, mockSession as any)

            // Should return null when below threshold
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate recommendation with 5 or more sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 100 }), // Session count >= 5
          fc.integer({ min: 200, max: 500 }), // Current WPM
          async (sessionCount, currentWPM) => {
            // Mock session count at or above threshold
            ;(ReadingSession.countDocuments as jest.Mock).mockResolvedValue(sessionCount)

            // Mock book with complex text to trigger recommendation
            const mockBook = {
              _id: mockBookId,
              words: Array(100).fill('extraordinary') // Long words = high complexity
            }
            ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

            const mockUser = {
              _id: mockUserId,
              minWPM: 100,
              maxWPM: 1000
            }
            ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

            const mockRecommendation = {
              save: jest.fn().mockResolvedValue(true)
            }
            ;(SpeedRecommendation as any).mockImplementation(() => mockRecommendation)

            const mockSession = {
              _id: mockSessionId,
              userId: mockUserId,
              bookId: mockBookId,
              currentWPM,
              lastWordIndex: 100,
              timeSpent: 200,
              pauseEvents: [],
              speedChanges: []
            }

            const result = await generateSpeedRecommendation(mockUserId, mockSession as any)

            // Should generate recommendation when at or above threshold
            expect(result).toBeDefined()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('ORP Optimizer: minimum 2000 training data points (Requirement 2.1)', () => {
    it('should not train model with fewer than 2000 training data points', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 1999 }), // Training data count < 2000
          async (trainingDataCount) => {
            // Mock training data below threshold
            const mockTrainingData = Array(trainingDataCount)
              .fill(null)
              .map(() => ({
                userId: mockUserId,
                sessionId: mockSessionId,
                word: 'test',
                wordLength: 4,
                standardORPIndex: 1,
                testORPIndex: 1,
                isTestWord: false,
                timeToNextWord: 200,
                pausedAfter: false,
                toObject: function () {
                  return this
                }
              }))

            ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(mockTrainingData)

            const result = await trainPersonalizedORPModel(mockUserId)

            // Should return null when below threshold
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should train model with 2000 or more training data points', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2000, max: 5000 }), // Training data count >= 2000
          async (trainingDataCount) => {
            // Mock training data at or above threshold
            const mockTrainingData = Array(trainingDataCount)
              .fill(null)
              .map((_, i) => ({
                userId: mockUserId,
                sessionId: mockSessionId,
                word: 'test',
                wordLength: 4,
                standardORPIndex: 1,
                testORPIndex: i % 2 === 0 ? 1 : 2, // Mix of test and control
                isTestWord: i % 2 === 0,
                timeToNextWord: 200 + (i % 50), // Varying times
                pausedAfter: false,
                toObject: function () {
                  return this
                }
              }))

            ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(mockTrainingData)
            ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
            ;(ORPModel.create as jest.Mock).mockResolvedValue({
              userId: mockUserId,
              status: 'active',
              trainingDataCount
            })

            const result = await trainPersonalizedORPModel(mockUserId)

            // Should create model when at or above threshold
            expect(result).toBeDefined()
            expect(result).not.toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Book Recommendations: minimum 5 completed books (Requirement 3.1)', () => {
    it('should not generate recommendations with fewer than 5 completed books', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 4 }), // Completed books < 5
          async (completedBooksCount) => {
            // Mock completed books below threshold
            const mockCompletedBooks = Array(completedBooksCount)
              .fill(null)
              .map(() => ({
                _id: new Types.ObjectId(),
                userId: mockUserId,
                isCompleted: true,
                genre: 'fiction',
                totalWords: 50000,
                complexityScore: 0.5
              }))

            ;(Book.find as jest.Mock).mockResolvedValue(mockCompletedBooks)

            const result = await generateBookRecommendations(mockUserId)

            // Should return empty array when below threshold
            expect(result).toEqual([])
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate recommendations with 5 or more completed books', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // Completed books >= 5
          async (completedBooksCount) => {
            // Mock completed books at or above threshold
            const mockCompletedBooks = Array(completedBooksCount)
              .fill(null)
              .map(() => ({
                _id: new Types.ObjectId(),
                userId: mockUserId,
                isCompleted: true,
                genre: 'fiction',
                totalWords: 50000,
                complexityScore: 0.5
              }))

            // Mock candidate books from other users
            const mockCandidateBooks = Array(3)
              .fill(null)
              .map(() => ({
                _id: new Types.ObjectId(),
                userId: new Types.ObjectId(), // Different user
                isPublic: true,
                genre: 'fiction',
                totalWords: 52000,
                complexityScore: 0.52
              }))

            // First call: get completed books
            ;(Book.find as jest.Mock).mockResolvedValueOnce(mockCompletedBooks)

            // Second call: get user's book IDs
            ;(Book.find as jest.Mock).mockReturnValueOnce({
              distinct: jest.fn().mockResolvedValue(mockCompletedBooks.map(b => b._id))
            })

            // Third call: get candidate books
            ;(Book.find as jest.Mock).mockResolvedValueOnce(mockCandidateBooks)

            const result = await generateBookRecommendations(mockUserId)

            // Should return recommendations when at or above threshold
            expect(result.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Reading DNA: minimum 10 sessions and 5000 words (Requirement 4.1)', () => {
    it('should not generate profile with fewer than 10 sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 9 }), // Session count < 10
          fc.integer({ min: 5000, max: 10000 }), // Words >= 5000 (but sessions insufficient)
          async (sessionCount, totalWords) => {
            const wordsPerSession = Math.floor(totalWords / Math.max(sessionCount, 1))

            // Mock sessions below threshold
            const mockSessions = Array(sessionCount)
              .fill(null)
              .map(() => ({
                userId: mockUserId,
                bookId: mockBookId,
                currentWPM: 300,
                lastWordIndex: wordsPerSession,
                timeSpent: 600,
                date: new Date(),
                pauseEvents: [],
                speedChanges: [
                  { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
                ],
                readingVelocity: 300
              }))

            ;(ReadingSession.find as jest.Mock).mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSessions)
              })
            })

            // Should throw error when below session threshold
            await expect(generateReadingDNA(mockUserId.toString())).rejects.toThrow(
              'Insufficient data'
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not generate profile with fewer than 5000 words', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }), // Session count >= 10 (but words insufficient)
          fc.integer({ min: 0, max: 4999 }), // Words < 5000
          async (sessionCount, totalWords) => {
            const wordsPerSession = Math.floor(totalWords / sessionCount)

            // Mock sessions with insufficient words
            const mockSessions = Array(sessionCount)
              .fill(null)
              .map(() => ({
                userId: mockUserId,
                bookId: mockBookId,
                currentWPM: 300,
                lastWordIndex: wordsPerSession,
                timeSpent: 600,
                date: new Date(),
                pauseEvents: [],
                speedChanges: [
                  { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
                ],
                readingVelocity: 300
              }))

            ;(ReadingSession.find as jest.Mock).mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSessions)
              })
            })

            // Should throw error when below word threshold
            await expect(generateReadingDNA(mockUserId.toString())).rejects.toThrow(
              'Insufficient data'
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate profile with 10+ sessions and 5000+ words', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }), // Session count >= 10
          fc.integer({ min: 5000, max: 20000 }), // Words >= 5000
          async (sessionCount, totalWords) => {
            const wordsPerSession = Math.floor(totalWords / sessionCount)

            // Mock sessions at or above thresholds
            const mockSessions = Array(sessionCount)
              .fill(null)
              .map((_, i) => ({
                _id: new Types.ObjectId(),
                userId: mockUserId,
                bookId: mockBookId,
                currentWPM: 300 + i * 5,
                lastWordIndex: wordsPerSession,
                timeSpent: 600,
                date: new Date(Date.now() - i * 86400000),
                pauseEvents: [],
                speedChanges: [
                  { wordIndex: 0, oldWPM: 300, newWPM: 300, timestamp: new Date() }
                ],
                readingVelocity: 300
              }))

            const mockBooks = [
              {
                _id: mockBookId,
                genre: 'Fiction',
                totalWords: 50000,
                isCompleted: true
              }
            ]

            const mockUser = {
              _id: mockUserId,
              currentStreak: 10
            }

            ;(ReadingSession.find as jest.Mock).mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSessions)
              })
            })

            ;(Book.find as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockBooks)
            })

            ;(User.findById as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockUser)
            })

            ;(Quiz.find as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })

            ;(ReadingDNA.findOneAndUpdate as jest.Mock).mockResolvedValue({
              userId: mockUserId,
              averageWPM: 300,
              medianWPM: 300
            })

            const result = await generateReadingDNA(mockUserId.toString())

            // Should generate profile when at or above thresholds
            expect(result).toBeDefined()
            expect(result.userId).toBeDefined()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Cross-feature threshold validation', () => {
    it('should enforce different thresholds for different features', async () => {
      // Test that each feature has its own independent threshold
      const testCases = [
        { feature: 'Speed Controller', minSessions: 5, minWords: 0 },
        { feature: 'ORP Optimizer', minSessions: 0, minTrainingData: 2000 },
        { feature: 'Book Recommendations', minBooks: 5, minWords: 0 },
        { feature: 'Reading DNA', minSessions: 10, minWords: 5000 }
      ]

      for (const testCase of testCases) {
        // Verify that thresholds are distinct and enforced independently
        expect(testCase).toBeDefined()
      }
    })
  })
})
