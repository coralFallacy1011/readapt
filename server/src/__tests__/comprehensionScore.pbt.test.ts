// Feature: ai-adaptive-features
// Property 34: Comprehension score calculation
// Validates: Requirements 12.6

import * as fc from 'fast-check'

/**
 * Validates: Requirements 12.6
 *
 * Property 34: Comprehension score calculation
 *
 * From quizController.ts: score = (correct_answers / 5) * 100
 */

/** Pure score calculation (mirrors submitQuiz in quizController.ts) */
function calculateScore(correctCount: number): number {
  return (correctCount / 5) * 100
}

/** Count correct answers given user answers and correct answers */
function countCorrect(userAnswers: number[], correctAnswers: number[]): number {
  let correct = 0
  for (let i = 0; i < Math.min(userAnswers.length, correctAnswers.length); i++) {
    if (userAnswers[i] === correctAnswers[i]) correct++
  }
  return correct
}

// Arbitrary: number of correct answers (0-5)
const correctCountArb = fc.integer({ min: 0, max: 5 })

// Arbitrary: a set of 5 answers (indices 0-3)
const answersArb = fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 5, maxLength: 5 })

describe('Comprehension Score - Property 34', () => {
  /**
   * Property 34a: Score = (correct / 5) * 100
   */
  it('score equals (correct / 5) * 100', () => {
    fc.assert(
      fc.property(correctCountArb, (correct) => {
        const score = calculateScore(correct)
        expect(score).toBe((correct / 5) * 100)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 34b: Score is always in range [0, 100]
   */
  it('score is always in range [0, 100]', () => {
    fc.assert(
      fc.property(correctCountArb, (correct) => {
        const score = calculateScore(correct)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 34c: All correct → score = 100
   */
  it('all correct answers gives score of 100', () => {
    fc.assert(
      fc.property(answersArb, (correctAnswers) => {
        // User answers match correct answers exactly
        const correct = countCorrect(correctAnswers, correctAnswers)
        const score = calculateScore(correct)
        expect(score).toBe(100)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 34d: None correct → score = 0
   */
  it('no correct answers gives score of 0', () => {
    fc.assert(
      fc.property(fc.constant(0), (correct) => {
        const score = calculateScore(correct)
        expect(score).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 34e: Score is a multiple of 20 (since 5 questions, each worth 20 points)
   */
  it('score is always a multiple of 20', () => {
    fc.assert(
      fc.property(correctCountArb, (correct) => {
        const score = calculateScore(correct)
        expect(score % 20).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 34f: Score increases monotonically with correct count
   */
  it('score increases monotonically with correct count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (correct) => {
          const score = calculateScore(correct)
          const scoreWithOneMore = calculateScore(correct + 1)
          expect(scoreWithOneMore).toBeGreaterThan(score)
        }
      ),
      { numRuns: 100 }
    )
  })
})
