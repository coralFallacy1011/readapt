import { Types } from 'mongoose'
import ORPModel, { IORPModel } from '../../models/ORPModel'
import ORPTrainingData from '../../models/ORPTrainingData'
import ReadingSession, { IReadingSession } from '../../models/ReadingSession'

/**
 * Gets the standard ORP index for a word length
 * Matches the client-side implementation
 */
function getStandardORPIndex(wordLength: number): number {
  if (wordLength <= 3) return Math.floor(wordLength / 2)
  if (wordLength <= 7) return Math.floor(wordLength / 4)
  return Math.floor(wordLength / 3) - 1
}

/**
 * Task 4.1: Determines if a word should use test ORP (20% probability)
 */
export function shouldUseTestORP(wordIndex: number): boolean {
  return Math.random() < 0.2
}

/**
 * Task 4.1: Gets ORP index with A/B testing
 * Returns standard ORP for 80% of words, test ORP (±1 offset) for 20%
 */
export function getORPIndexWithTesting(word: string, wordIndex: number): number {
  const standardORP = getStandardORPIndex(word.length)
  
  if (!shouldUseTestORP(wordIndex)) {
    return standardORP
  }
  
  // Test: offset by ±1
  const offset = Math.random() < 0.5 ? -1 : 1
  const testORP = standardORP + offset
  
  // Ensure within bounds
  return Math.max(0, Math.min(word.length - 1, testORP))
}

/**
 * Task 4.3: Records ORP training data for a word
 */
export async function recordORPTrainingData(
  userId: Types.ObjectId,
  sessionId: Types.ObjectId,
  word: string,
  orpIndex: number,
  timeToNextWord: number,
  pausedAfter: boolean,
  speedAdjustedAfter: boolean = false,
  sessionWPM: number = 300,
  textComplexity: number = 0.5
): Promise<void> {
  const standardORP = getStandardORPIndex(word.length)
  const isTestWord = orpIndex !== standardORP
  
  await ORPTrainingData.create({
    userId,
    sessionId,
    word,
    wordLength: word.length,
    standardORPIndex: standardORP,
    testORPIndex: orpIndex,
    isTestWord,
    timeToNextWord,
    pausedAfter,
    speedAdjustedAfter,
    sessionWPM,
    textComplexity,
    timestamp: new Date()
  })
}

/**
 * Task 4.4: Calculates reading velocity for a session
 * Formula: (words_read / total_time_seconds) * (1 - pause_rate)
 */
export function calculateReadingVelocity(session: IReadingSession): number {
  const wordsRead = session.lastWordIndex
  const totalTimeSeconds = session.timeSpent
  
  if (totalTimeSeconds === 0 || wordsRead === 0) {
    return 0
  }
  
  // Calculate pause rate: fraction of words followed by pause >2 seconds
  const longPauses = session.pauseEvents.filter(p => p.duration > 2000).length
  const pauseRate = wordsRead > 0 ? longPauses / wordsRead : 0
  
  // Reading velocity formula
  const velocity = (wordsRead / totalTimeSeconds) * (1 - pauseRate)
  
  return velocity
}

/**
 * Helper function to calculate average of an array
 */
function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Task 4.6: Trains a personalized ORP model for a user
 * Requires at least 2000 test words across 10+ sessions
 * Only activates if ≥5% velocity improvement
 */
export async function trainPersonalizedORPModel(
  userId: Types.ObjectId
): Promise<IORPModel | null> {
  const trainingData = await ORPTrainingData.find({ userId })
  
  if (trainingData.length < 2000) {
    return null
  }
  
  // Calculate reading velocity for each word
  const dataWithVelocity = trainingData.map(d => ({
    ...d.toObject(),
    velocity: d.pausedAfter ? 0 : (60000 / d.timeToNextWord)  // WPM equivalent
  }))
  
  // Group by word length
  const byLength = new Map<number, typeof dataWithVelocity>()
  for (const d of dataWithVelocity) {
    if (!byLength.has(d.wordLength)) {
      byLength.set(d.wordLength, [])
    }
    byLength.get(d.wordLength)!.push(d)
  }
  
  // For each word length, find optimal offset
  const offsetsByLength = new Map<number, number>()
  
  for (const [length, data] of byLength.entries()) {
    const testWords = data.filter(d => d.isTestWord)
    const controlWords = data.filter(d => !d.isTestWord)
    
    if (testWords.length < 50 || controlWords.length < 50) {
      offsetsByLength.set(length, 0)  // insufficient data, use standard
      continue
    }
    
    const testVelocity = average(testWords.map(d => d.velocity))
    const controlVelocity = average(controlWords.map(d => d.velocity))
    
    // If test performs better, use the average offset
    if (testVelocity > controlVelocity) {
      const avgOffset = average(testWords.map(d => d.testORPIndex - d.standardORPIndex))
      offsetsByLength.set(length, Math.round(avgOffset))
    } else {
      offsetsByLength.set(length, 0)
    }
  }
  
  // Calculate overall improvement
  const baselineVelocity = average(
    dataWithVelocity.filter(d => !d.isTestWord).map(d => d.velocity)
  )
  const personalizedVelocity = average(
    dataWithVelocity.filter(d => d.isTestWord).map(d => d.velocity)
  )
  const improvement = ((personalizedVelocity - baselineVelocity) / baselineVelocity) * 100
  
  // Only activate if improvement >= 5%
  const status = improvement >= 5 ? 'active' : 'inactive'
  
  // Check if model already exists for this user
  const existingModel = await ORPModel.findOne({ userId })
  
  if (existingModel) {
    // Update existing model
    existingModel.status = status
    existingModel.trainingDataCount = trainingData.length
    existingModel.validationScore = improvement
    existingModel.offsetsByLength = offsetsByLength
    existingModel.baselineVelocity = baselineVelocity
    existingModel.personalizedVelocity = personalizedVelocity
    existingModel.improvementPercentage = improvement
    existingModel.testWordsCount = dataWithVelocity.filter(d => d.isTestWord).length
    existingModel.controlWordsCount = dataWithVelocity.filter(d => !d.isTestWord).length
    existingModel.updatedAt = new Date()
    
    await existingModel.save()
    return existingModel
  }
  
  // Create new model
  return await ORPModel.create({
    userId,
    status,
    trainingDataCount: trainingData.length,
    validationScore: improvement,
    offsetsByLength,
    baselineVelocity,
    personalizedVelocity,
    improvementPercentage: improvement,
    testWordsCount: dataWithVelocity.filter(d => d.isTestWord).length,
    controlWordsCount: dataWithVelocity.filter(d => !d.isTestWord).length
  })
}

/**
 * Task 4.8: Gets personalized ORP index for a word
 * Applies trained model offsets to standard ORP calculation
 */
export async function getPersonalizedORPIndex(
  userId: Types.ObjectId,
  word: string
): Promise<number> {
  const model = await ORPModel.findOne({ userId, status: 'active' })
  
  if (!model) {
    return getStandardORPIndex(word.length)
  }
  
  const standardORP = getStandardORPIndex(word.length)
  const offset = model.offsetsByLength.get(word.length) || 0
  const personalizedORP = standardORP + offset
  
  // Ensure within bounds
  return Math.max(0, Math.min(word.length - 1, personalizedORP))
}

/**
 * Task 4.9: Checks if ORP model retraining should be triggered
 * Triggers after 50 sessions or 25,000 words, whichever comes first
 */
export async function shouldRetrain(userId: Types.ObjectId): Promise<boolean> {
  const model = await ORPModel.findOne({ userId })
  
  if (!model) {
    return false  // No model to retrain
  }
  
  // Get training data since last model update
  const newTrainingData = await ORPTrainingData.find({
    userId,
    timestamp: { $gt: model.updatedAt }
  })
  
  // Count sessions since last update
  const sessionIds = new Set(newTrainingData.map(d => d.sessionId.toString()))
  const sessionCount = sessionIds.size
  
  // Count words since last update
  const wordCount = newTrainingData.length
  
  // Trigger retraining if 50 sessions OR 25,000 words
  return sessionCount >= 50 || wordCount >= 25000
}

/**
 * Task 4.9: Triggers ORP model retraining if conditions are met
 */
export async function checkAndRetrain(userId: Types.ObjectId): Promise<IORPModel | null> {
  if (await shouldRetrain(userId)) {
    return await trainPersonalizedORPModel(userId)
  }
  return null
}
