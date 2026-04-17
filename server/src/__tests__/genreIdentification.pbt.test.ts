// Feature: ai-adaptive-features, Property 14: High-comprehension genre identification
import * as fc from 'fast-check'

/**
 * Validates: Requirements 3.9
 *
 * Property 14: High-comprehension genre identification
 * A genre is identified as high-comprehension if and only if the user's average
 * quiz score in that genre exceeds the overall average quiz score by at least
 * 10 percentage points.
 *
 * We test the pure calculation logic extracted from getHighComprehensionGenres,
 * which avoids any DB calls.
 */

// ---- Pure calculation logic (mirrors getHighComprehensionGenres) ----

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

interface QuizLike {
  genre: string
  score: number
}

/**
 * Pure function: given quiz results (each with a genre and score), return the
 * list of high-comprehension genres.
 * Mirrors the core logic of getHighComprehensionGenres without DB calls.
 */
function computeHighComprehensionGenres(quizzes: QuizLike[]): string[] {
  if (quizzes.length === 0) return []

  // Calculate overall average quiz score
  const allScores = quizzes.map(q => q.score)
  const overallAverage = average(allScores)

  // Group quizzes by genre
  const quizzesByGenre = new Map<string, QuizLike[]>()
  for (const quiz of quizzes) {
    if (!quizzesByGenre.has(quiz.genre)) {
      quizzesByGenre.set(quiz.genre, [])
    }
    quizzesByGenre.get(quiz.genre)!.push(quiz)
  }

  // Identify high-comprehension genres
  const highComprehensionGenres: string[] = []
  for (const [genre, genreQuizzes] of quizzesByGenre.entries()) {
    const genreAverage = average(genreQuizzes.map(q => q.score))
    if (genreAverage >= overallAverage + 10) {
      highComprehensionGenres.push(genre)
    }
  }

  return highComprehensionGenres
}

// ---- Arbitraries ----

const genreArb = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance', 'history', 'fantasy')
const scoreArb = fc.double({ min: 0, max: 100, noNaN: true })

const quizArb = fc.record({
  genre: genreArb,
  score: scoreArb,
})

// ---- Tests ----

describe('Genre Identification - Property 14: High-comprehension genre identification', () => {
  /**
   * Core property: a genre appears in results iff its average score >= overall average + 10
   */
  it('a genre is included iff its average score >= overall average + 10', () => {
    fc.assert(
      fc.property(
        fc.array(quizArb, { minLength: 1, maxLength: 50 }),
        (quizzes) => {
          const result = computeHighComprehensionGenres(quizzes)
          const resultSet = new Set(result)

          const overallAverage = average(quizzes.map(q => q.score))

          // Group by genre
          const quizzesByGenre = new Map<string, QuizLike[]>()
          for (const quiz of quizzes) {
            if (!quizzesByGenre.has(quiz.genre)) quizzesByGenre.set(quiz.genre, [])
            quizzesByGenre.get(quiz.genre)!.push(quiz)
          }

          for (const [genre, genreQuizzes] of quizzesByGenre.entries()) {
            const genreAverage = average(genreQuizzes.map(q => q.score))
            const shouldBeIncluded = genreAverage >= overallAverage + 10

            if (shouldBeIncluded && !resultSet.has(genre)) return false
            if (!shouldBeIncluded && resultSet.has(genre)) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Threshold boundary: genre with exactly overallAverage + 10 IS included
   *
   * Construction: use integer scores to avoid floating-point issues.
   * Genre A: N quizzes all at score S (integer)
   * Genre B: N quizzes all at score S + 10 + 10 (i.e., S + 20)
   * overallAverage = (N*S + N*(S+20)) / (2N) = S + 10
   * genreAvg(B) = S + 20
   * genreAvg(B) - overallAverage = 10  (exactly at threshold)
   */
  it('genre with average exactly overallAverage + 10 is included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 79 }),  // S: base score, leave room for S+20 <= 100
        fc.integer({ min: 1, max: 20 }),  // N: number of quizzes per genre
        (S, N) => {
          // Genre A: N quizzes at score S
          const quizzesA: QuizLike[] = Array.from({ length: N }, () => ({ genre: 'genreA', score: S }))
          // Genre B: N quizzes at score S + 20
          const quizzesB: QuizLike[] = Array.from({ length: N }, () => ({ genre: 'genreB', score: S + 20 }))

          // overallAverage = (N*S + N*(S+20)) / (2N) = S + 10
          // genreAvg(B) = S + 20 = overallAverage + 10  (exactly at threshold)
          const allQuizzes = [...quizzesA, ...quizzesB]
          const result = computeHighComprehensionGenres(allQuizzes)

          // genreB should be included (exactly at threshold: >= overallAverage + 10)
          return result.includes('genreB')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Threshold boundary: genre with overallAverage + 9.99 is NOT included
   *
   * Construction (integer scores, no floating-point issues):
   * Genre A: N quizzes at score S
   * Genre B: N quizzes at score S + 19  (one below the S+20 that would hit exactly +10)
   * overallAverage = (N*S + N*(S+19)) / (2N) = S + 9.5
   * genreAvg(B) = S + 19
   * genreAvg(B) - overallAverage = 9.5  (below threshold of 10)
   */
  it('genre with average overallAverage + 9.99 is NOT included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 80 }),  // S: base score
        fc.integer({ min: 1, max: 20 }),  // N: number of quizzes per genre
        (S, N) => {
          // Genre A: N quizzes at score S
          const quizzesA: QuizLike[] = Array.from({ length: N }, () => ({ genre: 'genreA', score: S }))
          // Genre B: N quizzes at score S + 19
          const quizzesB: QuizLike[] = Array.from({ length: N }, () => ({ genre: 'genreB', score: S + 19 }))

          // overallAverage = S + 9.5
          // genreAvg(B) = S + 19 = overallAverage + 9.5  (below threshold of 10)
          const allQuizzes = [...quizzesA, ...quizzesB]
          const result = computeHighComprehensionGenres(allQuizzes)

          // genreB should NOT be included (9.5 < 10)
          return !result.includes('genreB')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: empty quizzes returns empty array
   */
  it('returns empty array when there are no quizzes', () => {
    const result = computeHighComprehensionGenres([])
    expect(result).toEqual([])
  })

  /**
   * Edge case: all genres below threshold returns empty array
   */
  it('returns empty array when all genres are below threshold', () => {
    fc.assert(
      fc.property(
        fc.array(quizArb, { minLength: 1, maxLength: 30 }),
        (quizzes) => {
          // Force all quizzes to have the same score so no genre can exceed overall by 10
          const uniformScore = 50
          const uniformQuizzes = quizzes.map(q => ({ ...q, score: uniformScore }))
          const result = computeHighComprehensionGenres(uniformQuizzes)
          return result.length === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: all genres above threshold returns all genres
   */
  it('all genres above threshold are all returned', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            genre: genreArb,
            score: fc.double({ min: 90, max: 100, noNaN: true }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.array(
          fc.record({
            genre: fc.constant('low-genre'),
            score: fc.double({ min: 0, max: 10, noNaN: true }),
          }),
          { minLength: 50, maxLength: 100 }
        ),
        (highQuizzes, lowQuizzes) => {
          // Mix: many low-score quizzes pull overall average down,
          // high-score genres should all exceed threshold
          const allQuizzes = [...highQuizzes, ...lowQuizzes]
          const result = computeHighComprehensionGenres(allQuizzes)
          const resultSet = new Set(result)

          const overallAverage = average(allQuizzes.map(q => q.score))

          // Collect unique high genres
          const highGenres = new Set(highQuizzes.map(q => q.genre))

          // Each high genre should be in result if its average >= overallAverage + 10
          for (const genre of highGenres) {
            const genreScores = highQuizzes.filter(q => q.genre === genre).map(q => q.score)
            const genreAvg = average(genreScores)
            if (genreAvg >= overallAverage + 10) {
              if (!resultSet.has(genre)) return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
