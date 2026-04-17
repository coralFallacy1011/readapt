import { Types } from 'mongoose'
import ReadingSession, { IReadingSession } from '../../models/ReadingSession'
import SpeedRecommendation from '../../models/SpeedRecommendation'
import User from '../../models/User'
import Book from '../../models/Book'

/**
 * Task 3.1: Calculate text complexity based on average word length
 * Returns complexity score 0.0-1.0
 */
export function calculateTextComplexity(
  words: string[],
  startIndex: number,
  windowSize: number = 50
): number {
  const window = words.slice(startIndex, startIndex + windowSize)
  
  if (window.length === 0) return 0.0
  
  const avgLength = window.reduce((sum, w) => sum + w.length, 0) / window.length
  
  // Complexity score: 0.0 (simple) to 1.0 (complex)
  // Based on requirements: avgLength > 7 = high complexity
  if (avgLength <= 5) return 0.3  // low complexity
  if (avgLength <= 7) return 0.6  // medium complexity
  return 0.9  // high complexity
}

/**
 * Task 3.3: Calculate pause rate for a session
 * Returns the fraction of words followed by pauses longer than 2 seconds
 */
export function calculatePauseRate(session: IReadingSession): number {
  const totalWords = session.lastWordIndex
  if (totalWords === 0) return 0
  
  const longPauses = session.pauseEvents.filter(p => p.duration > 2000).length
  return longPauses / totalWords
}

/**
 * Task 3.3: Detect frequent pausing in a session
 * Returns true if 5+ pauses occur within any 100-word window
 */
export function detectFrequentPausing(session: IReadingSession): boolean {
  // Check for 5+ pauses in any 100-word window
  const pauseIndices = session.pauseEvents
    .map(p => p.wordIndex)
    .sort((a, b) => a - b)
  
  if (pauseIndices.length < 5) return false
  
  for (let i = 0; i < pauseIndices.length - 4; i++) {
    const windowSize = pauseIndices[i + 4] - pauseIndices[i]
    if (windowSize <= 100) return true
  }
  
  return false
}

/**
 * Task 3.5: Calculate WPM variance from speed changes
 * Returns coefficient of variation (std dev / mean)
 */
export function calculateWPMVariance(
  speedChanges: Array<{ oldWPM: number; newWPM: number }>
): number {
  if (speedChanges.length === 0) return 0
  
  const wpms = speedChanges.map(sc => sc.newWPM)
  const mean = wpms.reduce((sum, wpm) => sum + wpm, 0) / wpms.length
  
  if (mean === 0) return 0
  
  const variance = wpms.reduce((sum, wpm) => sum + Math.pow(wpm - mean, 2), 0) / wpms.length
  return Math.sqrt(variance) / mean  // coefficient of variation
}

/**
 * Task 3.5: Detect flow state in a session
 * Flow state: duration >= 300s, zero pauses > 2s, WPM variance < 10%
 */
export function detectFlowState(session: IReadingSession): boolean {
  const duration = session.timeSpent
  const longPauses = session.pauseEvents.filter(p => p.duration > 3000).length
  const wpmVariance = calculateWPMVariance(session.speedChanges)
  
  return duration >= 300 && longPauses === 0 && wpmVariance < 0.1
}

/**
 * Task 3.7: Generate speed recommendation for a user based on session analysis
 * Analyzes complexity, pauses, flow state and generates recommendation
 * Respects user min/max WPM boundaries
 */
export async function generateSpeedRecommendation(
  userId: Types.ObjectId,
  session: IReadingSession
): Promise<typeof SpeedRecommendation.prototype | null> {
  // Requirement 1.2: Require minimum 5 sessions
  const sessionCount = await ReadingSession.countDocuments({ userId })
  if (sessionCount < 5) return null
  
  const currentWPM = session.currentWPM
  let recommendedWPM = currentWPM
  let rationale = ''
  let confidence = 0.5
  let textComplexity: 'low' | 'medium' | 'high' = 'medium'
  
  // Get book words for complexity analysis
  const book = await Book.findById(session.bookId)
  if (!book) return null
  
  // Check for high complexity (Requirement 1.3, 1.4)
  const complexity = calculateTextComplexity(
    book.words,
    Math.max(0, session.lastWordIndex - 50),
    50
  )
  
  if (complexity > 0.7) {
    recommendedWPM = Math.round(currentWPM * 0.85)  // 15% reduction
    rationale = 'Detected complex text, suggesting slower pace'
    confidence = 0.8
    textComplexity = 'high'
  }
  
  // Check for flow state (Requirement 1.5)
  if (detectFlowState(session)) {
    recommendedWPM = Math.round(currentWPM * 1.08)  // 8% increase
    rationale = 'Excellent flow detected, suggesting speed increase'
    confidence = 0.9
    textComplexity = complexity > 0.7 ? 'high' : complexity > 0.5 ? 'medium' : 'low'
  }
  
  // Check for frequent pausing (Requirement 1.6, 1.7)
  if (detectFrequentPausing(session)) {
    recommendedWPM = Math.round(currentWPM * 0.85)  // 15% reduction
    rationale = 'Frequent pausing detected, suggesting slower pace'
    confidence = 0.85
    textComplexity = complexity > 0.7 ? 'high' : complexity > 0.5 ? 'medium' : 'low'
  }
  
  // Requirement 1.9: Respect user boundaries
  const user = await User.findById(userId)
  if (!user) return null
  
  recommendedWPM = Math.max(user.minWPM, Math.min(user.maxWPM, recommendedWPM))
  
  // Only recommend if change is significant (>5%)
  if (Math.abs(recommendedWPM - currentWPM) / currentWPM < 0.05) {
    return null
  }
  
  // Requirement 1.8: Store recommendation in database
  const recommendation = new SpeedRecommendation({
    userId,
    sessionId: session._id,
    currentWPM,
    recommendedWPM,
    rationale,
    confidence,
    textComplexity,
    pauseRate: calculatePauseRate(session),
    sessionDuration: session.timeSpent,
    accepted: false
  })
  
  await recommendation.save()
  
  return recommendation
}
