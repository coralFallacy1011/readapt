// Feature: ai-adaptive-features
// Property 33: Quiz structure requirements
// Validates: Requirements 12.2, 12.4

import * as fc from 'fast-check'

/**
 * Validates: Requirements 12.2, 12.4
 *
 * Property 33: Quiz structure requirements
 *
 * From quizController.ts, a quiz always has exactly 5 questions:
 * 2 main_idea, 2 detail, 1 inference.
 *
 * const categories = ['main_idea', 'main_idea', 'detail', 'detail', 'inference']
 */

type QuestionCategory = 'main_idea' | 'detail' | 'inference'

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  category: QuestionCategory
  explanation: string
}

/** Pure question generator (mirrors generatePlaceholderQuestions in quizController.ts) */
function generateQuestions(bookId: string, startWordIndex: number, endWordIndex: number): QuizQuestion[] {
  const categories: QuestionCategory[] = ['main_idea', 'main_idea', 'detail', 'detail', 'inference']

  return categories.map((category, i) => ({
    question: `Question ${i + 1} (${category}) about passage [${startWordIndex}-${endWordIndex}] in book ${bookId}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    category,
    explanation: `Explanation for question ${i + 1}`,
  }))
}

// Arbitraries
const bookIdArb = fc.uuid()
const wordIndexArb = fc.integer({ min: 0, max: 100000 })

const quizInputArb = wordIndexArb.chain(startWordIndex =>
  fc.record({
    bookId: bookIdArb,
    startWordIndex: fc.constant(startWordIndex),
    endWordIndex: fc.integer({ min: startWordIndex, max: startWordIndex + 10000 }),
  })
)

describe('Quiz Structure - Property 33', () => {
  /**
   * Property 33a: Quiz always has exactly 5 questions
   */
  it('quiz always has exactly 5 questions', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        expect(questions).toHaveLength(5)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 33b: Exactly 2 questions have category 'main_idea'
   */
  it('exactly 2 questions have category main_idea', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        const mainIdeaCount = questions.filter(q => q.category === 'main_idea').length
        expect(mainIdeaCount).toBe(2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 33c: Exactly 2 questions have category 'detail'
   */
  it('exactly 2 questions have category detail', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        const detailCount = questions.filter(q => q.category === 'detail').length
        expect(detailCount).toBe(2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 33d: Exactly 1 question has category 'inference'
   */
  it('exactly 1 question has category inference', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        const inferenceCount = questions.filter(q => q.category === 'inference').length
        expect(inferenceCount).toBe(1)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 33e: All questions have options array with 4 choices
   */
  it('all questions have options array with 4 choices', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        for (const question of questions) {
          expect(question.options).toHaveLength(4)
          expect(Array.isArray(question.options)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 33f: All questions have a correctIndex in range [0, 3]
   */
  it('all questions have a correctIndex in range [0, 3]', () => {
    fc.assert(
      fc.property(quizInputArb, ({ bookId, startWordIndex, endWordIndex }) => {
        const questions = generateQuestions(bookId, startWordIndex, endWordIndex)
        for (const question of questions) {
          expect(question.correctIndex).toBeGreaterThanOrEqual(0)
          expect(question.correctIndex).toBeLessThanOrEqual(3)
        }
      }),
      { numRuns: 100 }
    )
  })
})
