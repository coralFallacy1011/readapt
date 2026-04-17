// Feature: ai-adaptive-features, Property 9: ORP model retraining triggers
import * as fc from 'fast-check'
import mongoose from 'mongoose'
import { shouldRetrain } from '../services/ml/orpOptimizer'
import ORPModel from '../models/ORPModel'
import ORPTrainingData from '../models/ORPTrainingData'

/**
 * **Validates: Requirements 2.8**
 *
 * Property 9: ORP model retraining triggers
 * For any user with an active personalized ORP model, the system must trigger model
 * retraining when either 50 additional reading sessions are completed OR 25,000
 * additional words are read, whichever occurs first.
 */

// Mock the models
jest.mock('../models/ORPModel')
jest.mock('../models/ORPTrainingData')

// Arbitrary: valid MongoDB ObjectId
const objectIdArb = fc
  .hexaString({ minLength: 24, maxLength: 24 })
  .map(s => new mongoose.Types.ObjectId(s))

// Helper: Generate training data with specified session count and word count
function generateTrainingDataSince(
  userId: mongoose.Types.ObjectId,
  sessionCount: number,
  wordsPerSession: number,
  baseTimestamp: Date
): any[] {
  const trainingData: any[] = []
  
  for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
    const sessionId = new mongoose.Types.ObjectId()
    
    for (let wordIdx = 0; wordIdx < wordsPerSession; wordIdx++) {
      trainingData.push({
        _id: new mongoose.Types.ObjectId(),
        userId,
        sessionId,
        word: 'test',
        wordLength: 4,
        standardORPIndex: 1,
        testORPIndex: 1,
        isTestWord: false,
        timeToNextWord: 200,
        pausedAfter: false,
        speedAdjustedAfter: false,
        sessionWPM: 300,
        textComplexity: 0.5,
        timestamp: new Date(baseTimestamp.getTime() + sessionIdx * 1000)
      })
    }
  }
  
  return trainingData
}

describe('ORP Optimizer - Property 9: ORP model retraining triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retraining must trigger when 50 sessions completed, regardless of word count', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 50, max: 100 }), // Session count >= 50
        fc.integer({ min: 1, max: 400 }),  // Words per session (total < 25000)
        async (userId, sessionCount, wordsPerSession) => {
          // Precondition: Total words should be less than 25,000 to isolate session trigger
          fc.pre(sessionCount * wordsPerSession < 25000)
          
          const modelUpdatedAt = new Date('2024-01-01')
          
          // Setup: Existing model
          const existingModel = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            status: 'active',
            updatedAt: modelUpdatedAt
          }
          
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
          
          // Setup: Training data since model update
          const trainingData = generateTrainingDataSince(
            userId,
            sessionCount,
            wordsPerSession,
            new Date(modelUpdatedAt.getTime() + 1000)
          )
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          
          // Execute
          const result = await shouldRetrain(userId)
          
          // Property: Must trigger retraining when sessionCount >= 50
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('retraining must trigger when 25000 words read, regardless of session count', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 1, max: 49 }),     // Session count < 50
        fc.integer({ min: 510, max: 1000 }), // Words per session (total >= 25000)
        async (userId, sessionCount, wordsPerSession) => {
          // Precondition: Total words should be >= 25,000 to isolate word trigger
          fc.pre(sessionCount * wordsPerSession >= 25000)
          
          const modelUpdatedAt = new Date('2024-01-01')
          
          // Setup: Existing model
          const existingModel = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            status: 'active',
            updatedAt: modelUpdatedAt
          }
          
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
          
          // Setup: Training data since model update
          const trainingData = generateTrainingDataSince(
            userId,
            sessionCount,
            wordsPerSession,
            new Date(modelUpdatedAt.getTime() + 1000)
          )
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          
          // Execute
          const result = await shouldRetrain(userId)
          
          // Property: Must trigger retraining when wordCount >= 25000
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('retraining must NOT trigger when neither threshold is met', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 1, max: 49 }),   // Session count < 50
        fc.integer({ min: 1, max: 400 }),  // Words per session
        async (userId, sessionCount, wordsPerSession) => {
          // Precondition: Neither threshold met
          fc.pre(sessionCount < 50 && sessionCount * wordsPerSession < 25000)
          
          const modelUpdatedAt = new Date('2024-01-01')
          
          // Setup: Existing model
          const existingModel = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            status: 'active',
            updatedAt: modelUpdatedAt
          }
          
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
          
          // Setup: Training data since model update
          const trainingData = generateTrainingDataSince(
            userId,
            sessionCount,
            wordsPerSession,
            new Date(modelUpdatedAt.getTime() + 1000)
          )
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          
          // Execute
          const result = await shouldRetrain(userId)
          
          // Property: Must NOT trigger retraining when both thresholds not met
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('retraining triggers at exactly 50 sessions boundary', async () => {
    const userId = new mongoose.Types.ObjectId()
    const modelUpdatedAt = new Date('2024-01-01')
    
    // Test cases around the 50 session boundary
    const testCases = [
      { sessions: 49, wordsPerSession: 100, shouldTrigger: false },
      { sessions: 50, wordsPerSession: 100, shouldTrigger: true },
      { sessions: 51, wordsPerSession: 100, shouldTrigger: true }
    ]
    
    for (const testCase of testCases) {
      const existingModel = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        status: 'active',
        updatedAt: modelUpdatedAt
      }
      
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
      
      const trainingData = generateTrainingDataSince(
        userId,
        testCase.sessions,
        testCase.wordsPerSession,
        new Date(modelUpdatedAt.getTime() + 1000)
      )
      
      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
      
      const result = await shouldRetrain(userId)
      
      expect(result).toBe(testCase.shouldTrigger)
    }
  })

  it('retraining triggers at exactly 25000 words boundary', async () => {
    const userId = new mongoose.Types.ObjectId()
    const modelUpdatedAt = new Date('2024-01-01')
    
    // Test cases around the 25000 word boundary
    const testCases = [
      { sessions: 10, wordsPerSession: 2499, shouldTrigger: false }, // 24,990 words
      { sessions: 10, wordsPerSession: 2500, shouldTrigger: true },  // 25,000 words
      { sessions: 10, wordsPerSession: 2501, shouldTrigger: true }   // 25,010 words
    ]
    
    for (const testCase of testCases) {
      const existingModel = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        status: 'active',
        updatedAt: modelUpdatedAt
      }
      
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
      
      const trainingData = generateTrainingDataSince(
        userId,
        testCase.sessions,
        testCase.wordsPerSession,
        new Date(modelUpdatedAt.getTime() + 1000)
      )
      
      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
      
      const result = await shouldRetrain(userId)
      
      expect(result).toBe(testCase.shouldTrigger)
    }
  })

  it('retraining does not trigger when no model exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 50, max: 100 }),
        fc.integer({ min: 500, max: 1000 }),
        async (userId, sessionCount, wordsPerSession) => {
          // Setup: No existing model
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
          
          // Execute
          const result = await shouldRetrain(userId)
          
          // Property: Cannot retrain if no model exists
          expect(result).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('whichever threshold comes first triggers retraining', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 1000 }),
        async (userId, sessionCount, wordsPerSession) => {
          const totalWords = sessionCount * wordsPerSession
          const modelUpdatedAt = new Date('2024-01-01')
          
          // Setup: Existing model
          const existingModel = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            status: 'active',
            updatedAt: modelUpdatedAt
          }
          
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
          
          // Setup: Training data
          const trainingData = generateTrainingDataSince(
            userId,
            sessionCount,
            wordsPerSession,
            new Date(modelUpdatedAt.getTime() + 1000)
          )
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          
          // Execute
          const result = await shouldRetrain(userId)
          
          // Property: Trigger if EITHER threshold is met
          const expectedResult = sessionCount >= 50 || totalWords >= 25000
          expect(result).toBe(expectedResult)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('only counts training data after model updatedAt timestamp', async () => {
    const userId = new mongoose.Types.ObjectId()
    const modelUpdatedAt = new Date('2024-01-15')
    
    // Setup: Existing model
    const existingModel = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      status: 'active',
      updatedAt: modelUpdatedAt
    }
    
    ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
    
    // Setup: Training data with some before and some after model update
    const oldData = generateTrainingDataSince(
      userId,
      30,
      500,
      new Date('2024-01-01') // Before model update
    )
    
    const newData = generateTrainingDataSince(
      userId,
      10,
      100,
      new Date(modelUpdatedAt.getTime() + 1000) // After model update
    )
    
    // Mock should only return data after updatedAt
    ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(newData)
    
    const result = await shouldRetrain(userId)
    
    // Property: Should not trigger (only 10 sessions and 1000 words since update)
    expect(result).toBe(false)
    
    // Verify the query was called with correct timestamp filter
    expect(ORPTrainingData.find).toHaveBeenCalledWith({
      userId,
      timestamp: { $gt: modelUpdatedAt }
    })
  })
})
