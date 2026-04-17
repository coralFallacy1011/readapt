import ReadingSession, { IReadingSession } from '../../models/ReadingSession'
import Book from '../../models/Book'
import User from '../../models/User'
import ReadingDNA, { IReadingDNA } from '../../models/ReadingDNA'
import Quiz from '../../models/Quiz'
import Follow from '../../models/Follow'
import crypto from 'crypto'

/**
 * Task 6.1: Classify flow state for Reading DNA profiling
 * 
 * Flow state criteria (Requirement 4.3):
 * - Duration >= 10 minutes (600 seconds)
 * - Zero pauses longer than 3 seconds (3000ms)
 * - WPM variance < 10%
 * 
 * @param session - The reading session to analyze
 * @returns true if session meets all flow state criteria, false otherwise
 */
export function classifyFlowState(session: IReadingSession): boolean {
  // Check duration >= 10 minutes (600 seconds)
  const duration = session.timeSpent
  if (duration < 600) return false
  
  // Check for zero pauses longer than 3 seconds (3000ms)
  const longPauses = session.pauseEvents.filter(p => p.duration > 3000).length
  if (longPauses > 0) return false
  
  // Calculate WPM variance
  const wpmVariance = calculateWPMVariance(session.speedChanges)
  
  // Check WPM variance < 10%
  if (wpmVariance >= 0.1) return false
  
  return true
}

/**
 * Calculate WPM variance from speed changes
 * Returns coefficient of variation (std dev / mean)
 * 
 * @param speedChanges - Array of speed change events
 * @returns Coefficient of variation (0.0 to 1.0+)
 */
function calculateWPMVariance(
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
 * Task 6.3: Calculate reading endurance score
 * 
 * Endurance score formula (Requirement 4.5):
 * (average_session_duration_minutes / 30) * (1 + streak_consistency_bonus)
 * where streak_consistency_bonus = (current_streak / 30) capped at 1.0
 * 
 * @param avgSessionDurationMinutes - Average session duration in minutes
 * @param currentStreak - Current reading streak in days
 * @returns Reading endurance score
 */
export function calculateEnduranceScore(
  avgSessionDurationMinutes: number,
  currentStreak: number
): number {
  const streakBonus = Math.min(currentStreak / 30, 1.0)
  return (avgSessionDurationMinutes / 30) * (1 + streakBonus)
}

/**
 * Task 6.5: Generate Reading DNA profile
 * 
 * Requirements: 4.2, 4.4, 4.6, 4.7
 * 
 * @param userId - The user ID to generate profile for
 * @returns Reading DNA profile with all metrics and visualizations
 */
export async function generateReadingDNA(userId: string): Promise<IReadingDNA> {
  // Query all user's reading sessions
  const sessions = await ReadingSession.find({ userId }).sort({ date: 1 }).lean()
  
  // Calculate total words read
  const totalWordsRead = sessions.reduce((sum, s) => {
    return sum + (s.lastWordIndex || 0)
  }, 0)
  
  // Check for insufficient data (Requirement 4.1)
  if (sessions.length < 10 || totalWordsRead < 5000) {
    throw new Error(`Insufficient data - need ${Math.max(0, 10 - sessions.length)} more sessions and ${Math.max(0, 5000 - totalWordsRead)} more words`)
  }
  
  // Get user for streak data
  const user = await User.findById(userId).lean()
  if (!user) {
    throw new Error('User not found')
  }
  
  // Get all books for genre and length data
  const bookIds = [...new Set(sessions.map(s => s.bookId.toString()))]
  const books = await Book.find({ _id: { $in: bookIds } }).lean()
  const bookMap = new Map(books.map(b => [b._id.toString(), b]))
  
  // Get quizzes for comprehension data
  const quizzes = await Quiz.find({ userId }).lean()
  
  // Calculate speed metrics (Requirement 4.2)
  const wpms = sessions.map(s => s.currentWPM).filter(wpm => wpm > 0)
  const averageWPM = wpms.reduce((sum, wpm) => sum + wpm, 0) / wpms.length
  const sortedWPMs = [...wpms].sort((a, b) => a - b)
  const medianWPM = sortedWPMs[Math.floor(sortedWPMs.length / 2)]
  const wpmStandardDeviation = Math.sqrt(
    wpms.reduce((sum, wpm) => sum + Math.pow(wpm - averageWPM, 2), 0) / wpms.length
  )
  
  // Calculate temporal patterns (Requirement 4.2)
  const optimalTimeOfDay = calculateOptimalTimeOfDay(sessions)
  const optimalDayOfWeek = calculateOptimalDayOfWeek(sessions)
  const averageSessionDuration = sessions.reduce((sum, s) => sum + s.timeSpent, 0) / sessions.length / 60 // minutes
  
  // Calculate content preferences (Requirement 4.2)
  const completedBooks = books.filter(b => b.isCompleted)
  const preferredBookLength = completedBooks.length > 0
    ? calculateMedian(completedBooks.map(b => b.totalWords))
    : 0
  const genreAffinity = calculateGenreAffinity(sessions, bookMap)
  
  // Calculate flow state metrics (Requirement 4.4)
  const flowSessions = sessions.filter(s => classifyFlowState(s as any))
  const flowStateWPMRange = calculateFlowStateWPMRange(flowSessions)
  const flowStateDuration = flowSessions.length > 0
    ? flowSessions.reduce((sum, s) => sum + s.timeSpent, 0) / flowSessions.length / 60
    : 0
  const flowStateTimeOfDay = calculateOptimalTimeOfDay(flowSessions)
  const flowStateFrequency = calculateFlowStateFrequency(flowSessions)
  
  // Calculate endurance (Requirement 4.5)
  const enduranceScore = calculateEnduranceScore(averageSessionDuration, user.currentStreak)
  const streakConsistencyBonus = Math.min(user.currentStreak / 30, 1.0)
  
  // Calculate comprehension metrics
  const averageComprehensionScore = quizzes.length > 0
    ? quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length
    : 0
  const comprehensionByGenre = calculateComprehensionByGenre(quizzes, bookMap)
  
  // Generate visualization data (Requirement 4.6)
  const wpmHistory = generateWPMHistory(sessions)
  const activityHeatmap = generateActivityHeatmap(sessions)
  
  // Create or update Reading DNA profile
  const dnaData = {
    userId,
    lastUpdated: new Date(),
    averageWPM,
    medianWPM,
    wpmStandardDeviation,
    optimalTimeOfDay,
    optimalDayOfWeek,
    averageSessionDuration,
    preferredBookLength,
    genreAffinity,
    flowStateWPMRange,
    flowStateDuration,
    flowStateTimeOfDay,
    flowStateFrequency,
    enduranceScore,
    streakConsistencyBonus,
    averageComprehensionScore,
    comprehensionByGenre,
    wpmHistory,
    activityHeatmap
  }
  
  const dna = await ReadingDNA.findOneAndUpdate(
    { userId },
    dnaData,
    { upsert: true, new: true }
  )
  
  return dna
}

/**
 * Calculate optimal time of day (4-hour window with highest velocity)
 * Requirement 4.2
 */
function calculateOptimalTimeOfDay(sessions: any[]): string {
  if (sessions.length === 0) return ''
  
  // Group sessions by 4-hour windows
  const windows = [
    { start: 0, end: 4, label: '00:00-04:00' },
    { start: 4, end: 8, label: '04:00-08:00' },
    { start: 8, end: 12, label: '08:00-12:00' },
    { start: 12, end: 16, label: '12:00-16:00' },
    { start: 16, end: 20, label: '16:00-20:00' },
    { start: 20, end: 24, label: '20:00-24:00' }
  ]
  
  const windowVelocities = windows.map(window => {
    const windowSessions = sessions.filter(s => {
      const hour = new Date(s.date).getHours()
      return hour >= window.start && hour < window.end
    })
    
    if (windowSessions.length === 0) return { ...window, velocity: 0 }
    
    const avgVelocity = windowSessions.reduce((sum, s) => sum + (s.readingVelocity || 0), 0) / windowSessions.length
    return { ...window, velocity: avgVelocity }
  })
  
  const optimal = windowVelocities.reduce((best, current) => 
    current.velocity > best.velocity ? current : best
  )
  
  return optimal.label
}

/**
 * Calculate optimal day of week
 */
function calculateOptimalDayOfWeek(sessions: any[]): string[] {
  if (sessions.length === 0) return []
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayVelocities = dayNames.map((day, index) => {
    const daySessions = sessions.filter(s => new Date(s.date).getDay() === index)
    if (daySessions.length === 0) return { day, velocity: 0 }
    
    const avgVelocity = daySessions.reduce((sum, s) => sum + (s.readingVelocity || 0), 0) / daySessions.length
    return { day, velocity: avgVelocity }
  })
  
  const maxVelocity = Math.max(...dayVelocities.map(d => d.velocity))
  if (maxVelocity === 0) return []
  
  // Return days within 90% of max velocity
  return dayVelocities
    .filter(d => d.velocity >= maxVelocity * 0.9)
    .map(d => d.day)
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Calculate genre affinity (top 3 genres by words read)
 * Requirement 4.2
 */
function calculateGenreAffinity(sessions: any[], bookMap: Map<string, any>): Array<{ genre: string; wordsRead: number; percentage: number }> {
  const genreWords = new Map<string, number>()
  let totalWords = 0
  
  sessions.forEach(s => {
    const book = bookMap.get(s.bookId.toString())
    if (book && book.genre) {
      const words = s.lastWordIndex || 0
      genreWords.set(book.genre, (genreWords.get(book.genre) || 0) + words)
      totalWords += words
    }
  })
  
  if (totalWords === 0) return []
  
  // Sort by words read and take top 3
  const sorted = Array.from(genreWords.entries())
    .map(([genre, wordsRead]) => ({
      genre,
      wordsRead,
      percentage: (wordsRead / totalWords) * 100
    }))
    .sort((a, b) => b.wordsRead - a.wordsRead)
    .slice(0, 3)
  
  return sorted
}

/**
 * Calculate flow state WPM range (±10% of median flow WPM)
 * Requirement 4.4
 */
function calculateFlowStateWPMRange(flowSessions: any[]): { min: number; max: number } {
  if (flowSessions.length === 0) return { min: 0, max: 0 }
  
  const wpms = flowSessions.map(s => s.currentWPM).filter(wpm => wpm > 0)
  const sortedWPMs = [...wpms].sort((a, b) => a - b)
  const medianWPM = sortedWPMs[Math.floor(sortedWPMs.length / 2)]
  
  return {
    min: Math.round(medianWPM * 0.9),
    max: Math.round(medianWPM * 1.1)
  }
}

/**
 * Calculate flow state frequency (sessions per week)
 * Requirement 4.4
 */
function calculateFlowStateFrequency(flowSessions: any[]): number {
  if (flowSessions.length === 0) return 0
  
  // Calculate date range
  const dates = flowSessions.map(s => new Date(s.date).getTime())
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24)
  const weeks = Math.max(daysDiff / 7, 1)
  
  return flowSessions.length / weeks
}

/**
 * Calculate comprehension by genre
 */
function calculateComprehensionByGenre(quizzes: any[], bookMap: Map<string, any>): Map<string, number> {
  const genreScores = new Map<string, { total: number; count: number }>()
  
  quizzes.forEach(q => {
    const book = bookMap.get(q.bookId.toString())
    if (book && book.genre) {
      const current = genreScores.get(book.genre) || { total: 0, count: 0 }
      genreScores.set(book.genre, {
        total: current.total + q.score,
        count: current.count + 1
      })
    }
  })
  
  const result = new Map<string, number>()
  genreScores.forEach((value, genre) => {
    result.set(genre, value.total / value.count)
  })
  
  return result
}

/**
 * Generate WPM history (last 30 sessions)
 * Requirement 4.6
 */
function generateWPMHistory(sessions: any[]): Array<{ date: string; wpm: number }> {
  const last30 = sessions.slice(-30)
  return last30.map(s => ({
    date: new Date(s.date).toISOString().split('T')[0],
    wpm: s.currentWPM
  }))
}

/**
 * Generate activity heatmap (last 90 days by hour and day of week)
 * Requirement 4.6
 * Returns 24x7 array (24 hours x 7 days)
 */
function generateActivityHeatmap(sessions: any[]): number[][] {
  // Initialize 24x7 grid
  const heatmap: number[][] = Array(24).fill(0).map(() => Array(7).fill(0))
  
  // Filter to last 90 days
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const recentSessions = sessions.filter(s => new Date(s.date) >= ninetyDaysAgo)
  
  // Count sessions by hour and day
  recentSessions.forEach(s => {
    const date = new Date(s.date)
    const hour = date.getHours()
    const day = date.getDay()
    heatmap[hour][day]++
  })
  
  return heatmap
}

/**
 * Task 6.6: Generate shareable URL for Reading DNA profile
 * 
 * Requirements: 4.8, 4.9
 * 
 * Generates a unique shareable URL for a user's Reading DNA profile.
 * The URL includes a secure token that can be used to access the profile
 * based on the user's privacy settings.
 * 
 * @param userId - The user ID whose profile to share
 * @returns Shareable URL with secure token
 */
export async function generateShareableURL(userId: string): Promise<string> {
  // Verify user exists
  const user = await User.findById(userId).lean()
  if (!user) {
    throw new Error('User not found')
  }
  
  // Verify Reading DNA profile exists
  const dna = await ReadingDNA.findOne({ userId }).lean()
  if (!dna) {
    throw new Error('Reading DNA profile not found')
  }
  
  // Generate secure token (hash of userId + timestamp + random bytes)
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(16).toString('hex')
  const token = crypto
    .createHash('sha256')
    .update(`${userId}-${timestamp}-${randomBytes}`)
    .digest('hex')
  
  // In production, this would be stored in a ShareToken model with expiration
  // For now, we'll encode the userId in the token for retrieval
  const shareableToken = Buffer.from(JSON.stringify({ userId, token, timestamp })).toString('base64url')
  
  // Return shareable URL
  return `/api/ml/reading-dna/shared/${shareableToken}`
}

/**
 * Task 6.6: Retrieve shared Reading DNA profile with privacy validation
 * 
 * Requirements: 4.8, 4.9
 * 
 * Retrieves a Reading DNA profile from a shareable URL token, validating
 * privacy settings and follower relationships.
 * 
 * @param shareToken - The shareable URL token
 * @param viewerId - The ID of the user viewing the profile (optional, null for anonymous)
 * @param anonymize - Whether to anonymize the username in the response
 * @returns Reading DNA profile with user info (anonymized if requested)
 */
export async function getSharedProfile(
  shareToken: string,
  viewerId: string | null = null,
  anonymize: boolean = false
): Promise<{
  profile: IReadingDNA
  user: {
    name: string
    profileVisibility: string
  }
}> {
  // Decode token to get userId
  let tokenData: { userId: string; token: string; timestamp: number }
  try {
    const decoded = Buffer.from(shareToken, 'base64url').toString('utf-8')
    tokenData = JSON.parse(decoded)
  } catch (error) {
    throw new Error('Invalid share token')
  }
  
  const { userId } = tokenData
  
  // Get user and their privacy settings
  const user = await User.findById(userId).lean()
  if (!user) {
    throw new Error('User not found')
  }
  
  // Get Reading DNA profile
  const profile = await ReadingDNA.findOne({ userId }).lean()
  if (!profile) {
    throw new Error('Reading DNA profile not found')
  }
  
  // Validate privacy settings
  const visibility = user.profileVisibility
  
  if (visibility === 'private') {
    // Private: only the owner can view
    if (!viewerId || viewerId !== userId) {
      throw new Error('This profile is private')
    }
  } else if (visibility === 'followers-only') {
    // Followers-only: owner or followers can view
    if (!viewerId) {
      throw new Error('This profile is only visible to followers')
    }
    
    if (viewerId !== userId) {
      // Check if viewer is a follower
      const isFollower = await Follow.findOne({
        followerId: viewerId,
        followingId: userId
      }).lean()
      
      if (!isFollower) {
        throw new Error('This profile is only visible to followers')
      }
    }
  }
  // Public: anyone can view (no additional checks needed)
  
  // Return profile with user info (anonymized if requested)
  return {
    profile: profile as unknown as IReadingDNA,
    user: {
      name: anonymize ? 'Anonymous Reader' : user.name,
      profileVisibility: visibility
    }
  }
}
