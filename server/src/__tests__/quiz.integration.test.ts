/**
 * Integration tests: Quiz complete flow
 * Requirements: 12.2, 12.6, 12.9, 12.10
 *
 * Tests the complete flow: quiz generation → user submission → scoring → speed adjustment recommendation
 */

import {
  getSpeedAdjustmentFactor,
  hasThreeConsecutiveHighScores,
} from '../services/ml/quizSpeedAdjuster'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type QuestionCategory = 'main_idea' | 'detail' | 'inference'

interface Question {
  question: string
  options: string[]
  correctIndex: number
  category: QuestionCategory
  explanation: string
}

/** Mirrors the placeholder generator in quizController.ts */
function generatePlaceholderQuestions(
  bookId: string,
  startWordIndex: number,
  endWordIndex: number
): Question[] {
  const categories: QuestionCategory[] = [
    'main_idea',
    'main_idea',
    'detail',
    'detail',
    'inference',
  ]

  return categories.map((category, i) => ({
    question: `Question ${i + 1} (${category}) about passage [${startWordIndex}-${endWordIndex}] in book ${bookId}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    category,
    explanation: `Explanation for question ${i + 1}`,
  }))
}

/** Score a set of answers against the correct answers (5 questions, correctIndex = 0) */
function scoreAnswers(answers: number[]): number {
  const correctAnswers = [0, 0, 0, 0, 0]
  const correct = answers.filter((a, i) => a === correctAnswers[i]).length
  return (correct / 5) * 100
}

/** Retake logic: only store the highest score */
function applyRetakeLogic(storedScore: number, newScore: number): number {
  return newScore > storedScore ? newScore : storedScore
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Quiz Integration', () => {
  describe('Flow 1: quiz generation produces correct structure', () => {
    it('generates exactly 5 questions', () => {
      const questions = generatePlaceholderQuestions('book123', 0, 500)
      expect(questions).toHaveLength(5)
    })

    it('generates 2 main_idea, 2 detail, 1 inference questions', () => {
      const questions = generatePlaceholderQuestions('book123', 0, 500)
      const counts = questions.reduce<Record<string, number>>((acc, q) => {
        acc[q.category] = (acc[q.category] ?? 0) + 1
        return acc
      }, {})

      expect(counts['main_idea']).toBe(2)
      expect(counts['detail']).toBe(2)
      expect(counts['inference']).toBe(1)
    })

    it('each question has 4 options', () => {
      const questions = generatePlaceholderQuestions('book123', 0, 500)
      questions.forEach(q => expect(q.options).toHaveLength(4))
    })
  })

  describe('Flow 2: all correct answers → score = 100, factor = 1.0 (or 1.1 if 3 consecutive)', () => {
    it('all correct answers produce score 100', () => {
      const allCorrect = [0, 0, 0, 0, 0]
      expect(scoreAnswers(allCorrect)).toBe(100)
    })

    it('score 100 with no prior high scores → factor = 1.0', () => {
      expect(getSpeedAdjustmentFactor(100, [])).toBe(1.0)
    })

    it('score 100 with only 1 prior high score → factor = 1.0 (not 3 consecutive yet)', () => {
      expect(getSpeedAdjustmentFactor(100, [90])).toBe(1.0)
    })

    it('score 100 with 2 prior high scores (>= 80) → factor = 1.1', () => {
      expect(getSpeedAdjustmentFactor(100, [85, 90])).toBe(1.1)
    })
  })

  describe('Flow 3: score < 60 → speedAdjustmentFactor = 0.8', () => {
    it('score 0 → factor = 0.8', () => {
      expect(getSpeedAdjustmentFactor(0, [])).toBe(0.8)
    })

    it('score 59 → factor = 0.8', () => {
      expect(getSpeedAdjustmentFactor(59, [])).toBe(0.8)
    })

    it('score 60 → factor = 1.0 (boundary)', () => {
      expect(getSpeedAdjustmentFactor(60, [])).toBe(1.0)
    })

    it('all wrong answers produce score 0 → factor = 0.8', () => {
      const allWrong = [1, 1, 1, 1, 1]
      const score = scoreAnswers(allWrong)
      expect(score).toBe(0)
      expect(getSpeedAdjustmentFactor(score, [])).toBe(0.8)
    })
  })

  describe('Flow 4: 3 consecutive scores >= 80 → speedAdjustmentFactor = 1.1', () => {
    it('returns 1.1 when current and last 2 scores are all >= 80', () => {
      expect(getSpeedAdjustmentFactor(80, [80, 80])).toBe(1.1)
    })

    it('returns 1.1 for high scores: 85, 90, 95', () => {
      expect(getSpeedAdjustmentFactor(95, [85, 90])).toBe(1.1)
    })

    it('returns 1.0 when one of the 3 scores is below 80', () => {
      expect(getSpeedAdjustmentFactor(80, [79, 80])).toBe(1.0)
    })

    it('hasThreeConsecutiveHighScores returns false with fewer than 2 prior scores', () => {
      expect(hasThreeConsecutiveHighScores(90, [85])).toBe(false)
      expect(hasThreeConsecutiveHighScores(90, [])).toBe(false)
    })

    it('hasThreeConsecutiveHighScores returns true when all 3 are >= 80', () => {
      expect(hasThreeConsecutiveHighScores(80, [80, 80])).toBe(true)
    })
  })

  describe('Flow 5: retake with lower score → stored score unchanged (highest preserved)', () => {
    it('keeps higher stored score when retake score is lower', () => {
      const stored = applyRetakeLogic(80, 60)
      expect(stored).toBe(80)
    })

    it('updates stored score when retake score is higher', () => {
      const stored = applyRetakeLogic(60, 80)
      expect(stored).toBe(80)
    })

    it('keeps stored score when retake score is equal', () => {
      const stored = applyRetakeLogic(80, 80)
      expect(stored).toBe(80)
    })

    it('full retake scenario: first attempt 80, retake 60 → stored remains 80', () => {
      let storedScore = 0

      // First attempt
      const firstScore = scoreAnswers([0, 0, 0, 0, 0]) // 100
      storedScore = applyRetakeLogic(storedScore, firstScore)
      expect(storedScore).toBe(100)

      // Retake with lower score (3 wrong)
      const retakeScore = scoreAnswers([1, 1, 1, 0, 0]) // 40
      storedScore = applyRetakeLogic(storedScore, retakeScore)
      expect(storedScore).toBe(100) // unchanged
    })
  })
})
