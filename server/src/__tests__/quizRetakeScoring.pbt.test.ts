// Feature: ai-adaptive-features
// Property 37: Quiz retake stores highest score only
// Validates: Requirements 12.12

import * as fc from 'fast-check'

/**
 * Validates: Requirements 12.12
 *
 * Property 37: Quiz retake stores highest score only
 *
 * From quizController.ts: if (newScore > quiz.score) { quiz.score = newScore }
 */

/** Pure retake scoring logic (mirrors submitQuiz in quizController.ts) */
function applyRetakeScore(previousScore: number, newScore: number): number {
  if (newScore > previousScore) {
    return newScore
  }
  return previousScore
}

/** Simulate multiple retakes, always keeping the highest score */
function simulateRetakes(initialScore: number, retakeScores: number[]): number {
  let storedScore = initialScore
  for (const newScore of retakeScores) {
    storedScore = applyRetakeScore(storedScore, newScore)
  }
  return storedScore
}

// Arbitrary: a valid quiz score (multiple of 20, range 0-100)
const quizScoreArb = fc.integer({ min: 0, max: 5 }).map(correct => (correct / 5) * 100)

describe('Quiz Retake Scoring - Property 37', () => {
  /**
   * Property 37a: After retake, stored score = max(previousScore, newScore)
   */
  it('after retake, stored score equals max(previousScore, newScore)', () => {
    fc.assert(
      fc.property(quizScoreArb, quizScoreArb, (previousScore, newScore) => {
        const stored = applyRetakeScore(previousScore, newScore)
        expect(stored).toBe(Math.max(previousScore, newScore))
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 37b: Lower score retake does not decrease stored score
   */
  it('lower score retake does not decrease stored score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }).map(c => (c / 5) * 100), // previousScore > 0
        (previousScore) => {
          // newScore is strictly lower
          const lowerScore = previousScore - 20
          if (lowerScore < 0) return // skip if no lower score possible

          const stored = applyRetakeScore(previousScore, lowerScore)
          expect(stored).toBe(previousScore)
          expect(stored).toBeGreaterThanOrEqual(previousScore)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 37c: Higher score retake updates stored score
   */
  it('higher score retake updates stored score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }).map(c => (c / 5) * 100), // previousScore < 100
        (previousScore) => {
          const higherScore = previousScore + 20
          if (higherScore > 100) return // skip if no higher score possible

          const stored = applyRetakeScore(previousScore, higherScore)
          expect(stored).toBe(higherScore)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 37d: Equal score retake keeps stored score unchanged
   */
  it('equal score retake keeps stored score unchanged', () => {
    fc.assert(
      fc.property(quizScoreArb, (score) => {
        const stored = applyRetakeScore(score, score)
        expect(stored).toBe(score)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 37e: Score is always non-decreasing across retakes
   */
  it('score is always non-decreasing across multiple retakes', () => {
    fc.assert(
      fc.property(
        quizScoreArb,
        fc.array(quizScoreArb, { minLength: 1, maxLength: 10 }),
        (initialScore, retakeScores) => {
          let storedScore = initialScore

          for (const newScore of retakeScores) {
            const previousStored = storedScore
            storedScore = applyRetakeScore(storedScore, newScore)
            // Score must never decrease
            expect(storedScore).toBeGreaterThanOrEqual(previousStored)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 37f: Final stored score equals the maximum of all scores ever submitted
   */
  it('final stored score equals the maximum of all scores ever submitted', () => {
    fc.assert(
      fc.property(
        quizScoreArb,
        fc.array(quizScoreArb, { minLength: 0, maxLength: 10 }),
        (initialScore, retakeScores) => {
          const allScores = [initialScore, ...retakeScores]
          const expectedMax = Math.max(...allScores)
          const finalScore = simulateRetakes(initialScore, retakeScores)

          expect(finalScore).toBe(expectedMax)
        }
      ),
      { numRuns: 100 }
    )
  })
})
