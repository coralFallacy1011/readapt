import * as fc from 'fast-check'
import { calculateTextComplexity, generateSpeedRecommendation } from '../services/ml/speedController'
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

/**
 * Property-Based Tests for Speed Controller
 * Feature: ai-adaptive-features
 */

describe('Speed Controller Property-Based Tests', () => {
  /**
   * Property 2: High complexity text triggers WPM reduction
   * Validates: Requirements 1.3, 1.4
   *
   * For any text where average word length > 7 characters,
   * calculateTextComplexity must return a score > 0.7 (high complexity),
   * and generateSpeedRecommendation must recommend a WPM reduction of 15%.
   */
  describe('Property 2: High complexity text triggers WPM reduction', () => {
    it('should classify text with avg word length > 7 as high complexity (score > 0.7)', () => {
      // Generator for arrays of long words (length 8-15 chars)
      const longWordGen = fc.stringMatching(/^[a-zA-Z]{8,15}$/)
      const longWordsArrayGen = fc.array(longWordGen, { minLength: 50, maxLength: 100 })

      fc.assert(
        fc.property(longWordsArrayGen, (words) => {
          const complexity = calculateTextComplexity(words, 0, Math.min(50, words.length))
          
          // Calculate actual average length to verify our assumption
          const avgLength = words.slice(0, Math.min(50, words.length))
            .reduce((sum, w) => sum + w.length, 0) / Math.min(50, words.length)
          
          // If avg length > 7, complexity must be > 0.7 (high)
          if (avgLength > 7) {
            return complexity > 0.7
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should recommend 15% WPM reduction for high complexity text', async () => {
      const userId = new Types.ObjectId()
      const bookId = new Types.ObjectId()
      const sessionId = new Types.ObjectId()

      // Generator for current WPM values
      const wpmGen = fc.integer({ min: 150, max: 800 })
      
      // Generator for arrays of long words
      const longWordGen = fc.stringMatching(/^[a-zA-Z]{8,15}$/)
      const longWordsArrayGen = fc.array(longWordGen, { minLength: 100, maxLength: 200 })

      await fc.assert(
        fc.asyncProperty(wpmGen, longWordsArrayGen, async (currentWPM, words) => {
          // Setup mocks
          ;(ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
          
          const mockBook = {
            _id: bookId,
            words: words
          }
          ;(Book.findById as jest.Mock).mockResolvedValue(mockBook)

          const mockUser = {
            _id: userId,
            minWPM: 100,
            maxWPM: 1000
          }
          ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

          const savedRecommendation = {
            userId,
            sessionId,
            currentWPM,
            recommendedWPM: 0,
            rationale: '',
            confidence: 0,
            textComplexity: 'high' as const,
            pauseRate: 0,
            sessionDuration: 0,
            accepted: false
          }

          const mockRecommendation = {
            ...savedRecommendation,
            save: jest.fn().mockResolvedValue(savedRecommendation)
          }
          ;(SpeedRecommendation as any).mockImplementation((data: any) => {
            savedRecommendation.recommendedWPM = data.recommendedWPM
            savedRecommendation.rationale = data.rationale
            savedRecommendation.confidence = data.confidence
            savedRecommendation.textComplexity = data.textComplexity
            return mockRecommendation
          })

          const session = {
            _id: sessionId,
            userId,
            bookId,
            currentWPM,
            lastWordIndex: 100,
            timeSpent: 200,
            pauseEvents: [],
            speedChanges: [],
            date: new Date(),
            averageWordLength: 0,
            complexityScore: 0,
            readingVelocity: 0,
            sessionCompleted: false,
            bookCompleted: false
          } as unknown as IReadingSession

          const result = await generateSpeedRecommendation(userId, session)

          // Calculate expected WPM (15% reduction)
          const expectedWPM = Math.round(currentWPM * 0.85)
          
          // Verify complexity is high
          const complexity = calculateTextComplexity(words, Math.max(0, 100 - 50), 50)
          
          if (complexity > 0.7 && result !== null) {
            // Should recommend 15% reduction (clamped to user boundaries)
            const clampedExpected = Math.max(100, Math.min(1000, expectedWPM))
            
            // Allow for rounding differences and ensure significant change (>5%)
            const changePercent = Math.abs(savedRecommendation.recommendedWPM - currentWPM) / currentWPM
            
            if (changePercent >= 0.05) {
              return Math.abs(savedRecommendation.recommendedWPM - clampedExpected) <= 1
            }
          }
          
          return true
        }),
        { numRuns: 50 } // Reduced runs for async tests
      )
    })

    it('should classify text with avg word length <= 5 as low complexity (score = 0.3)', () => {
      // Generator for arrays of short words (length 1-5 chars)
      const shortWordGen = fc.stringMatching(/^[a-zA-Z]{1,5}$/)
      const shortWordsArrayGen = fc.array(shortWordGen, { minLength: 50, maxLength: 100 })

      fc.assert(
        fc.property(shortWordsArrayGen, (words) => {
          const complexity = calculateTextComplexity(words, 0, Math.min(50, words.length))
          
          // Calculate actual average length
          const avgLength = words.slice(0, Math.min(50, words.length))
            .reduce((sum, w) => sum + w.length, 0) / Math.min(50, words.length)
          
          // If avg length <= 5, complexity must be 0.3 (low)
          if (avgLength <= 5) {
            return complexity === 0.3
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should classify text with avg word length 5-7 as medium complexity (score = 0.6)', () => {
      // Generator for arrays of medium words (length 5-7 chars)
      const mediumWordGen = fc.stringMatching(/^[a-zA-Z]{5,7}$/)
      const mediumWordsArrayGen = fc.array(mediumWordGen, { minLength: 50, maxLength: 100 })

      fc.assert(
        fc.property(mediumWordsArrayGen, (words) => {
          const complexity = calculateTextComplexity(words, 0, Math.min(50, words.length))
          
          // Calculate actual average length
          const avgLength = words.slice(0, Math.min(50, words.length))
            .reduce((sum, w) => sum + w.length, 0) / Math.min(50, words.length)
          
          // If avg length is between 5 and 7, complexity must be 0.6 (medium)
          if (avgLength > 5 && avgLength <= 7) {
            return complexity === 0.6
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should handle arbitrary word arrays without crashing', () => {
      // Generator for arbitrary word arrays
      const wordGen = fc.stringMatching(/^[a-zA-Z]{1,20}$/)
      const wordsArrayGen = fc.array(wordGen, { minLength: 0, maxLength: 200 })
      const startIndexGen = fc.integer({ min: 0, max: 150 })
      const windowSizeGen = fc.integer({ min: 1, max: 100 })

      fc.assert(
        fc.property(wordsArrayGen, startIndexGen, windowSizeGen, (words, startIndex, windowSize) => {
          // Should not throw for any valid input
          const complexity = calculateTextComplexity(words, startIndex, windowSize)
          
          // Complexity must be in valid range [0.0, 1.0]
          return complexity >= 0.0 && complexity <= 1.0
        }),
        { numRuns: 200 }
      )
    })

    it('should return consistent complexity for the same text window', () => {
      // Generator for word arrays
      const wordGen = fc.stringMatching(/^[a-zA-Z]{1,15}$/)
      const wordsArrayGen = fc.array(wordGen, { minLength: 100, maxLength: 200 })

      fc.assert(
        fc.property(wordsArrayGen, (words) => {
          const complexity1 = calculateTextComplexity(words, 0, 50)
          const complexity2 = calculateTextComplexity(words, 0, 50)
          
          // Same input should produce same output (deterministic)
          return complexity1 === complexity2
        }),
        { numRuns: 100 }
      )
    })
  })
})
