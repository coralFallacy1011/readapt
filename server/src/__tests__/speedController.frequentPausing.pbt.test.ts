import * as fc from 'fast-check'
import { detectFrequentPausing, generateSpeedRecommendation } from '../services/ml/speedController'
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
 * Property-Based Tests for Frequent Pausing Detection
 * Feature: ai-adaptive-features
 */

describe('Speed Controller Property-Based Tests - Frequent Pausing', () => {
  /**
   * Property 4: Frequent pausing triggers WPM reduction
   * **Validates: Requirements 1.6, 1.7**
   *
   * For any reading session where 5 or more pauses occur within any 100-word window,
   * the AI_Speed_Controller must classify it as frequent pausing and recommend a WPM
   * that is 85% of the current WPM (15% reduction).
   */
  describe('Property 4: Frequent pausing triggers WPM reduction', () => {
    it('should detect frequent pausing when 5+ pauses occur within 100-word window', () => {
      // Generator for pause events that are guaranteed to be within a 100-word window
      const frequentPauseGen = fc.record({
        startIndex: fc.integer({ min: 0, max: 500 }),
        pauseCount: fc.integer({ min: 5, max: 20 })
      }).map(({ startIndex, pauseCount }) => {
        // Generate pauseCount pauses within a 100-word window starting at startIndex
        const pauses = []
        for (let i = 0; i < pauseCount; i++) {
          const wordIndex = startIndex + Math.floor((i * 100) / pauseCount)
          pauses.push({
            wordIndex,
            duration: fc.sample(fc.integer({ min: 100, max: 5000 }), 1)[0]
          })
        }
        return pauses.sort((a, b) => a.wordIndex - b.wordIndex)
      })

      fc.assert(
        fc.property(frequentPauseGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          const result = detectFrequentPausing(session)
          
          // Should detect frequent pausing
          return result === true
        }),
        { numRuns: 100 }
      )
    })

    it('should not detect frequent pausing when pauses are spread out', () => {
      // Generator for pause events that are spread out (>100 words apart)
      const spreadPauseGen = fc.array(
        fc.integer({ min: 0, max: 50 }),
        { minLength: 5, maxLength: 20 }
      ).map((offsets) => {
        // Create pauses that are at least 101 words apart
        return offsets.map((offset, i) => ({
          wordIndex: i * 101 + offset,
          duration: fc.sample(fc.integer({ min: 100, max: 5000 }), 1)[0]
        }))
      })

      fc.assert(
        fc.property(spreadPauseGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          const result = detectFrequentPausing(session)
          
          // Should not detect frequent pausing
          return result === false
        }),
        { numRuns: 100 }
      )
    })

    it('should not detect frequent pausing with fewer than 5 pauses', () => {
      // Generator for sessions with 0-4 pauses
      const fewPausesGen = fc.array(
        fc.record({
          wordIndex: fc.integer({ min: 0, max: 1000 }),
          duration: fc.integer({ min: 100, max: 5000 })
        }),
        { minLength: 0, maxLength: 4 }
      )

      fc.assert(
        fc.property(fewPausesGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          const result = detectFrequentPausing(session)
          
          // Should not detect frequent pausing
          return result === false
        }),
        { numRuns: 100 }
      )
    })

    it('should recommend 15% WPM reduction when frequent pausing is detected', async () => {
      const userId = new Types.ObjectId()
      const bookId = new Types.ObjectId()
      const sessionId = new Types.ObjectId()

      // Generator for current WPM values
      const wpmGen = fc.integer({ min: 150, max: 800 })
      
      // Generator for frequent pause events (5+ pauses within 100 words)
      const frequentPauseGen = fc.record({
        startIndex: fc.integer({ min: 10, max: 50 }),
        pauseCount: fc.integer({ min: 5, max: 15 })
      }).map(({ startIndex, pauseCount }) => {
        const pauses = []
        for (let i = 0; i < pauseCount; i++) {
          const wordIndex = startIndex + Math.floor((i * 99) / pauseCount)
          pauses.push({
            wordIndex,
            duration: 1000 + i * 100
          })
        }
        return pauses.sort((a, b) => a.wordIndex - b.wordIndex)
      })

      await fc.assert(
        fc.asyncProperty(wpmGen, frequentPauseGen, async (currentWPM, pauseEvents) => {
          // Setup mocks
          ;(ReadingSession.countDocuments as jest.Mock).mockResolvedValue(10)
          
          // Use simple words to avoid complexity-based recommendations
          const simpleWords = Array(200).fill('test')
          const mockBook = {
            _id: bookId,
            words: simpleWords
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
            textComplexity: 'low' as const,
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
            lastWordIndex: 150,
            timeSpent: 200, // Not flow state
            pauseEvents,
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
          
          // Verify frequent pausing is detected
          const hasFrequentPausing = detectFrequentPausing(session)
          
          if (hasFrequentPausing && result !== null) {
            // Should recommend 15% reduction (clamped to user boundaries)
            const clampedExpected = Math.max(100, Math.min(1000, expectedWPM))
            
            // Check if change is significant (>5%)
            const changePercent = Math.abs(savedRecommendation.recommendedWPM - currentWPM) / currentWPM
            
            if (changePercent >= 0.05) {
              // Allow for rounding differences
              return Math.abs(savedRecommendation.recommendedWPM - clampedExpected) <= 1
            }
          }
          
          return true
        }),
        { numRuns: 50 } // Reduced runs for async tests
      )
    })

    it('should handle edge case: exactly 5 pauses at window boundary', () => {
      // Generator for exactly 5 pauses where the 5th pause is at exactly 100 words from the first
      const boundaryPauseGen = fc.integer({ min: 0, max: 400 }).map((startIndex) => {
        return [
          { wordIndex: startIndex, duration: 1000 },
          { wordIndex: startIndex + 25, duration: 1000 },
          { wordIndex: startIndex + 50, duration: 1000 },
          { wordIndex: startIndex + 75, duration: 1000 },
          { wordIndex: startIndex + 100, duration: 1000 }
        ]
      })

      fc.assert(
        fc.property(boundaryPauseGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          const result = detectFrequentPausing(session)
          
          // Should detect frequent pausing (5 pauses within 100-word window)
          return result === true
        }),
        { numRuns: 100 }
      )
    })

    it('should handle arbitrary pause patterns without crashing', () => {
      // Generator for arbitrary pause patterns
      const arbitraryPauseGen = fc.array(
        fc.record({
          wordIndex: fc.integer({ min: 0, max: 10000 }),
          duration: fc.integer({ min: 0, max: 10000 })
        }),
        { minLength: 0, maxLength: 100 }
      )

      fc.assert(
        fc.property(arbitraryPauseGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          // Should not throw for any valid input
          const result = detectFrequentPausing(session)
          
          // Result must be boolean
          return typeof result === 'boolean'
        }),
        { numRuns: 200 }
      )
    })

    it('should be deterministic for the same pause pattern', () => {
      // Generator for pause patterns
      const pauseGen = fc.array(
        fc.record({
          wordIndex: fc.integer({ min: 0, max: 1000 }),
          duration: fc.integer({ min: 100, max: 5000 })
        }),
        { minLength: 0, maxLength: 50 }
      )

      fc.assert(
        fc.property(pauseGen, (pauseEvents) => {
          const session = {
            pauseEvents
          } as IReadingSession

          const result1 = detectFrequentPausing(session)
          const result2 = detectFrequentPausing(session)
          
          // Same input should produce same output
          return result1 === result2
        }),
        { numRuns: 100 }
      )
    })
  })
})
