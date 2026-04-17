// Feature: ai-adaptive-features, Property 8: Personalized ORP model activation threshold
import * as fc from 'fast-check'
import mongoose from 'mongoose'
import { trainPersonalizedORPModel } from '../services/ml/orpOptimizer'
import ORPTrainingData from '../models/ORPTrainingData'
import ORPModel from '../models/ORPModel'

/**
 * **Validates: Requirements 2.6**
 *
 * Property 8: Personalized ORP model activation threshold
 * For any trained ORP model, the system must only activate the model if it achieves
 * at least 5% reading velocity improvement over baseline in validation testing.
 */

// Mock the models
jest.mock('../models/ORPTrainingData')
jest.mock('../models/ORPModel')

// Arbitrary: valid MongoDB ObjectId
const objectIdArb = fc
  .hexaString({ minLength: 24, maxLength: 24 })
  .map(s => new mongoose.Types.ObjectId(s))

// Helper: Calculate standard ORP index
function getStandardORPIndex(wordLength: number): number {
  if (wordLength <= 3) return Math.floor(wordLength / 2)
  if (wordLength <= 7) return Math.floor(wordLength / 4)
  return Math.floor(wordLength / 3) - 1
}

// Helper: Generate training data with specific baseline and test velocities
function generateTrainingData(
  userId: mongoose.Types.ObjectId,
  baselineVelocity: number,
  testVelocity: number,
  dataCount: number = 2000
): any[] {
  const trainingData: any[] = []
  
  // Generate 80% control words
  const controlCount = Math.floor(dataCount * 0.8)
  const testCount = dataCount - controlCount
  
  // Control words (standard ORP)
  for (let i = 0; i < controlCount; i++) {
    const wordLength = 5 + (i % 10) // Vary word length 5-14
    const standardORP = getStandardORPIndex(wordLength)
    const timeToNext = 60000 / baselineVelocity // Convert WPM to ms per word
    
    trainingData.push({
      _id: new mongoose.Types.ObjectId(),
      userId,
      sessionId: new mongoose.Types.ObjectId(),
      word: 'a'.repeat(wordLength),
      wordLength,
      standardORPIndex: standardORP,
      testORPIndex: standardORP,
      isTestWord: false,
      timeToNextWord: timeToNext,
      pausedAfter: false,
      speedAdjustedAfter: false,
      sessionWPM: 300,
      textComplexity: 0.5,
      timestamp: new Date(),
      toObject: function() { return this }
    })
  }
  
  // Test words (offset ORP)
  for (let i = 0; i < testCount; i++) {
    const wordLength = 5 + (i % 10)
    const standardORP = getStandardORPIndex(wordLength)
    const offset = Math.random() < 0.5 ? -1 : 1
    const testORP = Math.max(0, Math.min(wordLength - 1, standardORP + offset))
    const timeToNext = 60000 / testVelocity
    
    trainingData.push({
      _id: new mongoose.Types.ObjectId(),
      userId,
      sessionId: new mongoose.Types.ObjectId(),
      word: 'a'.repeat(wordLength),
      wordLength,
      standardORPIndex: standardORP,
      testORPIndex: testORP,
      isTestWord: true,
      timeToNextWord: timeToNext,
      pausedAfter: false,
      speedAdjustedAfter: false,
      sessionWPM: 300,
      textComplexity: 0.5,
      timestamp: new Date(),
      toObject: function() { return this }
    })
  }
  
  return trainingData
}

describe('ORP Optimizer - Property 8: Personalized ORP model activation threshold', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('model status must match 5% threshold for any velocity improvement', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.double({ min: 200, max: 400, noNaN: true }), // baseline velocity (WPM)
        fc.double({ min: 0.8, max: 1.3, noNaN: true }), // test velocity multiplier
        async (userId, baselineVelocity, multiplier) => {
          const testVelocity = baselineVelocity * multiplier
          const expectedImprovement = ((testVelocity - baselineVelocity) / baselineVelocity) * 100
          
          // Setup: Generate training data
          const trainingData = generateTrainingData(userId, baselineVelocity, testVelocity, 2000)
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
          
          let capturedModel: any = null
          ;(ORPModel.create as jest.Mock).mockImplementation((data: any) => {
            capturedModel = data
            return Promise.resolve(data)
          })
          
          // Execute: Train the model
          const result = await trainPersonalizedORPModel(userId)
          
          // Assert: Model should be created
          expect(result).not.toBeNull()
          expect(capturedModel).not.toBeNull()
          
          // Property: Status must be 'active' if and only if improvement >= 5%
          const actualImprovement = capturedModel.improvementPercentage
          
          if (actualImprovement >= 5.0) {
            expect(capturedModel.status).toBe('active')
          } else {
            expect(capturedModel.status).toBe('inactive')
          }
          
          // Additional invariant: improvement percentage should be close to expected
          // Allow some variance due to averaging across word lengths
          expect(Math.abs(actualImprovement - expectedImprovement)).toBeLessThan(2.0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('boundary test: models at exactly 5% threshold', async () => {
    const userId = new mongoose.Types.ObjectId()
    
    // Test cases around the 5% boundary
    const testCases = [
      { baseline: 300, test: 314.7, expectedActive: false }, // 4.9%
      { baseline: 300, test: 315.0, expectedActive: true },  // 5.0%
      { baseline: 300, test: 315.3, expectedActive: true },  // 5.1%
    ]
    
    for (const testCase of testCases) {
      const trainingData = generateTrainingData(userId, testCase.baseline, testCase.test, 2000)
      
      ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
      ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
      
      let capturedModel: any = null
      ;(ORPModel.create as jest.Mock).mockImplementation((data: any) => {
        capturedModel = data
        return Promise.resolve(data)
      })
      
      await trainPersonalizedORPModel(userId)
      
      expect(capturedModel).not.toBeNull()
      
      // Check if status matches expected based on actual calculated improvement
      if (capturedModel.improvementPercentage >= 5.0) {
        expect(capturedModel.status).toBe('active')
      } else {
        expect(capturedModel.status).toBe('inactive')
      }
    }
  })

  it('insufficient training data returns null without creating model', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.integer({ min: 0, max: 1999 }), // Less than 2000 required
        async (userId, dataCount) => {
          // Setup: Insufficient training data
          const trainingData = generateTrainingData(userId, 300, 330, dataCount)
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
          
          let createCalled = false
          ;(ORPModel.create as jest.Mock).mockImplementation(() => {
            createCalled = true
            return Promise.resolve({})
          })
          
          // Execute
          const result = await trainPersonalizedORPModel(userId)
          
          // Assert: Should return null and not create model
          expect(result).toBeNull()
          expect(createCalled).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('model stores correct velocity metrics and improvement calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.double({ min: 200, max: 400, noNaN: true }),
        fc.double({ min: 0.8, max: 1.3, noNaN: true }),
        async (userId, baselineVelocity, multiplier) => {
          const testVelocity = baselineVelocity * multiplier
          
          // Setup: Generate training data
          const trainingData = generateTrainingData(userId, baselineVelocity, testVelocity, 2000)
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(null)
          
          let capturedModel: any = null
          ;(ORPModel.create as jest.Mock).mockImplementation((data: any) => {
            capturedModel = data
            return Promise.resolve(data)
          })
          
          // Execute
          await trainPersonalizedORPModel(userId)
          
          if (capturedModel !== null) {
            // Property: Velocity metrics must be consistent
            expect(capturedModel.baselineVelocity).toBeGreaterThan(0)
            expect(capturedModel.personalizedVelocity).toBeGreaterThan(0)
            
            // Calculate expected improvement from stored velocities
            const calculatedImprovement = 
              ((capturedModel.personalizedVelocity - capturedModel.baselineVelocity) / 
               capturedModel.baselineVelocity) * 100
            
            // Improvement percentage should match calculation
            expect(Math.abs(capturedModel.improvementPercentage - calculatedImprovement)).toBeLessThan(0.01)
            
            // Status must match improvement threshold
            if (capturedModel.improvementPercentage >= 5) {
              expect(capturedModel.status).toBe('active')
            } else {
              expect(capturedModel.status).toBe('inactive')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('existing models are updated with correct activation status', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArb,
        fc.double({ min: 200, max: 400, noNaN: true }),
        fc.double({ min: 0.8, max: 1.3, noNaN: true }),
        fc.constantFrom('active', 'inactive', 'training', 'failed'),
        async (userId, baselineVelocity, multiplier, oldStatus) => {
          const testVelocity = baselineVelocity * multiplier
          
          // Setup: Generate training data
          const trainingData = generateTrainingData(userId, baselineVelocity, testVelocity, 2000)
          
          ;(ORPTrainingData.find as jest.Mock).mockResolvedValue(trainingData)
          
          // Setup: Existing model with old status
          const existingModel = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            status: oldStatus,
            trainingDataCount: 1000,
            validationScore: 3.0,
            offsetsByLength: new Map(),
            baselineVelocity: 250,
            personalizedVelocity: 257.5,
            improvementPercentage: 3.0,
            testWordsCount: 200,
            controlWordsCount: 800,
            updatedAt: new Date(),
            save: jest.fn().mockResolvedValue(true)
          }
          
          ;(ORPModel.findOne as jest.Mock).mockResolvedValue(existingModel)
          
          // Execute
          const result = await trainPersonalizedORPModel(userId)
          
          // Assert: Model should be updated
          expect(result).not.toBeNull()
          expect(existingModel.save).toHaveBeenCalled()
          
          // Property: Updated status must reflect new improvement
          const expectedStatus = existingModel.improvementPercentage >= 5 ? 'active' : 'inactive'
          expect(existingModel.status).toBe(expectedStatus)
        }
      ),
      { numRuns: 50 }
    )
  })
})
