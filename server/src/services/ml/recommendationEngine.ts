import { IBook } from '../../models/Book'
import Book from '../../models/Book'
import ReadingSession from '../../models/ReadingSession'
import { Types } from 'mongoose'

/**
 * Calculate similarity score between two books
 * 
 * Uses weighted formula:
 * - Genre similarity: 40% weight (1.0 if match, 0.0 otherwise)
 * - Word count similarity: 30% weight (1 - relative difference)
 * - Complexity similarity: 30% weight (1 - absolute difference)
 * 
 * @param book1 First book to compare
 * @param book2 Second book to compare
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
export function calculateBookSimilarity(book1: IBook, book2: IBook): number {
  // Genre similarity (40% weight)
  const genreSimilarity = book1.genre === book2.genre ? 1.0 : 0.0
  const genreScore = genreSimilarity * 0.4
  
  // Word count similarity (30% weight)
  const maxWordCount = Math.max(book1.totalWords, book2.totalWords)
  const wordCountDiff = Math.abs(book1.totalWords - book2.totalWords)
  const wordCountSimilarity = 1 - (wordCountDiff / maxWordCount)
  const wordCountScore = wordCountSimilarity * 0.3
  
  // Complexity similarity (30% weight)
  const complexityDiff = Math.abs(book1.complexityScore - book2.complexityScore)
  const complexitySimilarity = 1 - complexityDiff
  const complexityScore = complexitySimilarity * 0.3
  
  // Total similarity score
  return genreScore + wordCountScore + complexityScore
}

/**
 * Generate book recommendations for a user based on their completed books
 * 
 * Finds books similar to what the user has read by:
 * 1. Finding all books the user has completed
 * 2. Finding all public books from other users
 * 3. Calculating similarity between each candidate and user's completed books
 * 4. Using maximum similarity score for each candidate
 * 5. Returning top 5 candidates ranked by similarity
 * 
 * **Validates: Requirements 3.1, 3.3**
 * 
 * @param userId The user ID to generate recommendations for
 * @returns Array of up to 5 recommended books, sorted by similarity score (highest first)
 */
export async function generateBookRecommendations(userId: string | Types.ObjectId): Promise<IBook[]> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
  
  // Find all books the user has completed
  const completedBooks = await Book.find({ 
    userId: userObjectId, 
    isCompleted: true 
  })
  
  // If user hasn't completed any books, return empty array
  if (completedBooks.length === 0) {
    return []
  }
  
  // Find all books the user owns (to exclude from recommendations)
  const userBookIds = await Book.find({ userId: userObjectId }).distinct('_id')
  
  // Find all public books from other users that the user doesn't own
  const candidateBooks = await Book.find({
    userId: { $ne: userObjectId },
    isPublic: true,
    _id: { $nin: userBookIds }
  })
  
  // If no candidate books available, return empty array
  if (candidateBooks.length === 0) {
    return []
  }
  
  // Calculate similarity scores for each candidate book
  const scoredBooks = candidateBooks.map(candidate => {
    // Calculate similarity with each completed book
    const similarities = completedBooks.map(completed => 
      calculateBookSimilarity(completed, candidate)
    )
    
    // Use the maximum similarity score
    const maxSimilarity = Math.max(...similarities)
    
    return {
      book: candidate,
      score: maxSimilarity
    }
  })
  
  // Sort by similarity score (highest first) and return top 5
  return scoredBooks
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(scored => scored.book)
}

/**
 * Calculate average of an array of numbers
 * 
 * @param values Array of numbers
 * @returns Average value
 */
function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Find the optimal 2-hour reading time window for a user
 * 
 * Analyzes reading sessions to identify the 2-hour window with the highest
 * average reading velocity. Reading velocity accounts for both speed and
 * comprehension/retention.
 * 
 * Algorithm:
 * 1. Query all reading sessions for the user
 * 2. Group sessions by hour of day (0-23)
 * 3. Calculate average velocity for each hour
 * 4. Find the 2-hour consecutive window with highest combined average velocity
 * 5. Return the optimal time window (e.g., "14-16" for 2pm-4pm)
 * 
 * **Validates: Requirements 3.4, 3.5**
 * 
 * @param userId The user ID to analyze
 * @returns Time window string (e.g., "14-16") or empty string if insufficient data
 */
export async function findOptimalReadingTime(userId: string | Types.ObjectId): Promise<string> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
  
  // Query all reading sessions for the user
  const sessions = await ReadingSession.find({ userId: userObjectId })
  
  // Require at least 10 sessions for statistical validity
  if (sessions.length < 10) {
    return ''
  }
  
  // Group sessions by 2-hour windows
  const windows = new Map<string, number[]>()  // window -> velocities
  
  for (const session of sessions) {
    const hour = new Date(session.date).getHours()
    // Calculate 2-hour window (0-2, 2-4, 4-6, ..., 22-24)
    const windowStart = Math.floor(hour / 2) * 2
    const windowEnd = windowStart + 2
    const window = `${windowStart}-${windowEnd}`
    
    if (!windows.has(window)) {
      windows.set(window, [])
    }
    windows.get(window)!.push(session.readingVelocity)
  }
  
  // Find window with highest average velocity
  let bestWindow = ''
  let bestVelocity = 0
  
  for (const [window, velocities] of windows.entries()) {
    const avg = average(velocities)
    if (avg > bestVelocity) {
      bestVelocity = avg
      bestWindow = window
    }
  }
  
  return bestWindow
}

/**
 * Calculate median of an array of numbers
 * 
 * @param values Array of numbers
 * @returns Median value
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * Get time-specific WPM recommendations for a user
 * 
 * Analyzes reading sessions to provide personalized WPM recommendations
 * for different 2-hour time windows throughout the day. For each window,
 * calculates the median WPM from sessions where the user's reading velocity
 * exceeded their overall median velocity.
 * 
 * Algorithm:
 * 1. Query all reading sessions for the user
 * 2. Calculate the overall median reading velocity across all sessions
 * 3. For each 2-hour time window (0-2, 2-4, ..., 22-24):
 *    a. Filter sessions in that window where velocity > overall median
 *    b. Calculate median WPM for those high-velocity sessions
 *    c. Add to recommendations map if data exists
 * 4. Return map of time windows to recommended WPM values
 * 
 * **Validates: Requirements 3.6, 3.7**
 * 
 * @param userId The user ID to analyze
 * @returns Map of time window strings (e.g., "14-16") to recommended WPM values
 */
export async function getTimeSpecificWPMRecommendations(
  userId: string | Types.ObjectId
): Promise<Map<string, number>> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
  
  // Query all reading sessions for the user
  const sessions = await ReadingSession.find({ userId: userObjectId })
  
  // Return empty map if insufficient data
  if (sessions.length === 0) {
    return new Map()
  }
  
  // Calculate overall median reading velocity
  const allVelocities = sessions.map(s => s.readingVelocity)
  const overallMedianVelocity = median(allVelocities)
  
  // Group sessions by 2-hour windows
  const windowSessions = new Map<string, typeof sessions>()
  
  for (const session of sessions) {
    const hour = new Date(session.date).getHours()
    // Calculate 2-hour window (0-2, 2-4, 4-6, ..., 22-24)
    const windowStart = Math.floor(hour / 2) * 2
    const windowEnd = windowStart + 2
    const window = `${windowStart}-${windowEnd}`
    
    if (!windowSessions.has(window)) {
      windowSessions.set(window, [])
    }
    windowSessions.get(window)!.push(session)
  }
  
  // Calculate time-specific WPM recommendations
  const recommendations = new Map<string, number>()
  
  for (const [window, windowSessionList] of windowSessions.entries()) {
    // Filter sessions where velocity exceeded overall median
    const highVelocitySessions = windowSessionList.filter(
      s => s.readingVelocity > overallMedianVelocity
    )
    
    // Only add recommendation if we have high-velocity sessions in this window
    if (highVelocitySessions.length > 0) {
      const wpms = highVelocitySessions.map(s => s.currentWPM)
      const medianWPM = median(wpms)
      recommendations.set(window, Math.round(medianWPM))
    }
  }
  
  return recommendations
}

/**
 * Identify genres where the user has high comprehension
 * 
 * Analyzes quiz results to identify which genres the user comprehends best.
 * A genre is considered high-comprehension if the user's average quiz score
 * in that genre exceeds their overall average by at least 10 percentage points.
 * 
 * Algorithm:
 * 1. Query all quiz results for the user
 * 2. Calculate the overall average quiz score across all genres
 * 3. Group quizzes by book genre
 * 4. Calculate average quiz score for each genre
 * 5. Identify genres where average score exceeds overall average by at least 10%
 * 6. Return array of high-comprehension genres
 * 
 * **Validates: Requirements 3.8, 3.9**
 * 
 * @param userId The user ID to analyze
 * @returns Array of genre names where user has high comprehension
 */
export async function getHighComprehensionGenres(
  userId: string | Types.ObjectId
): Promise<string[]> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
  
  // Import Quiz model dynamically to avoid circular dependencies
  const Quiz = (await import('../../models/Quiz')).default
  
  // Query all quiz results for the user
  const quizzes = await Quiz.find({ userId: userObjectId }).populate('bookId')
  
  // Return empty array if no quizzes
  if (quizzes.length === 0) {
    return []
  }
  
  // Calculate overall average quiz score
  const allScores = quizzes.map(q => q.score)
  const overallAverage = average(allScores)
  
  // Group quizzes by book genre
  const quizzesByGenre = new Map<string, typeof quizzes>()
  
  for (const quiz of quizzes) {
    const book = quiz.bookId as any
    const genre = book?.genre
    
    // Skip quizzes where book or genre is not available
    if (!genre) continue
    
    if (!quizzesByGenre.has(genre)) {
      quizzesByGenre.set(genre, [])
    }
    quizzesByGenre.get(genre)!.push(quiz)
  }
  
  // Identify high-comprehension genres
  const highComprehensionGenres: string[] = []
  
  for (const [genre, genreQuizzes] of quizzesByGenre.entries()) {
    // Calculate average quiz score for this genre
    const genreScores = genreQuizzes.map(q => q.score)
    const genreAverage = average(genreScores)
    
    // Check if genre average exceeds overall average by at least 10 percentage points
    if (genreAverage >= overallAverage + 10) {
      highComprehensionGenres.push(genre)
    }
  }
  
  return highComprehensionGenres
}

/**
 * Get initial WPM recommendation for a new book
 * 
 * Calculates an initial reading speed recommendation when a user starts reading
 * a new book. The recommendation is based on the user's historical median WPM
 * adjusted by a complexity factor based on the book's complexity score.
 * 
 * Algorithm:
 * 1. Query all reading sessions for the user
 * 2. Calculate the user's median WPM across all sessions
 * 3. Apply a complexity factor based on the book's complexity score:
 *    - Low complexity (0.0-0.3): factor = 1.2 (20% faster)
 *    - Medium complexity (0.3-0.7): factor = 1.0 (baseline)
 *    - High complexity (0.7-1.0): factor = 0.8 (20% slower)
 * 4. Return recommended WPM = median WPM * complexity factor (rounded to integer)
 * 
 * **Validates: Requirements 3.10**
 * 
 * @param userId The user ID to analyze
 * @param bookComplexity The complexity score of the book (0.0-1.0)
 * @returns Recommended initial WPM for the book
 */
export async function getInitialWPMForBook(
  userId: string | Types.ObjectId,
  bookComplexity: number
): Promise<number> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
  
  // Query all reading sessions for the user
  const sessions = await ReadingSession.find({ userId: userObjectId })
  
  // If no sessions, return default WPM of 300
  if (sessions.length === 0) {
    return 300
  }
  
  // Calculate median WPM across all sessions
  const wpms = sessions.map(s => s.currentWPM)
  const medianWPM = median(wpms)
  
  // Determine complexity factor based on book complexity score
  let complexityFactor: number
  
  if (bookComplexity < 0.3) {
    // Low complexity: 20% faster
    complexityFactor = 1.2
  } else if (bookComplexity < 0.7) {
    // Medium complexity: baseline
    complexityFactor = 1.0
  } else {
    // High complexity: 20% slower
    complexityFactor = 0.8
  }
  
  // Calculate recommended WPM
  const recommendedWPM = medianWPM * complexityFactor
  
  // Round to nearest integer
  return Math.round(recommendedWPM)
}
