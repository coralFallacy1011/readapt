import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import Quiz from '../models/Quiz'
import { getSpeedAdjustmentFactor } from '../services/ml/quizSpeedAdjuster'

// Placeholder question generator — produces 5 questions (2 main_idea, 2 detail, 1 inference)
function generatePlaceholderQuestions(bookId: string, startWordIndex: number, endWordIndex: number) {
  const categories: Array<'main_idea' | 'detail' | 'inference'> = [
    'main_idea', 'main_idea', 'detail', 'detail', 'inference',
  ]

  return categories.map((category, i) => ({
    question: `Question ${i + 1} (${category}) about passage [${startWordIndex}-${endWordIndex}] in book ${bookId}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    category,
    explanation: `Explanation for question ${i + 1}`,
  }))
}

export async function generateQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { bookId, startWordIndex, endWordIndex } = req.body

    if (!bookId || startWordIndex === undefined || endWordIndex === undefined) {
      res.status(400).json({ error: 'Missing required fields: bookId, startWordIndex, endWordIndex' })
      return
    }

    const questions = generatePlaceholderQuestions(bookId, startWordIndex, endWordIndex)

    const quiz = await Quiz.create({
      userId: req.user!.id,
      bookId,
      questions,
      userAnswers: [],
      score: 0,
      timeTaken: 0,
      textComplexity: 0.5,
      sessionWPM: 0,
    })

    res.status(201).json(quiz)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function submitQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { answers } = req.body

    if (!Array.isArray(answers)) {
      res.status(400).json({ error: 'answers must be an array' })
      return
    }

    const quiz = await Quiz.findOne({ _id: id, userId: req.user!.id })
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' })
      return
    }

    // Score: (correct / 5) * 100
    let correct = 0
    const correctAnswers: number[] = quiz.questions.map(q => q.correctIndex)
    answers.forEach((answer: number, i: number) => {
      if (answer === correctAnswers[i]) correct++
    })
    const newScore = (correct / 5) * 100

    // Retake logic (Requirements 12.11, 12.12): users may retake quizzes unlimited times,
    // but only the highest score is stored so analytics always reflect peak comprehension.
    if (newScore > quiz.score) {
      quiz.score = newScore
    }
    quiz.userAnswers = answers

    await quiz.save()

    // Get recent quiz scores for this book (last 3, excluding current quiz)
    const recentQuizzes = await Quiz.find({
      userId: req.user!.id,
      bookId: quiz.bookId,
      _id: { $ne: quiz._id },
    })
      .sort({ timestamp: -1 })
      .limit(2)
      .select('score')

    // recentScores ordered oldest-first (most recent last) for the adjuster
    const recentScores = recentQuizzes.map(q => q.score).reverse()
    const speedAdjustmentFactor = getSpeedAdjustmentFactor(newScore, recentScores)

    res.json({ score: quiz.score, correctAnswers, speedAdjustmentFactor })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getQuizHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { bookId } = req.params
    const quizzes = await Quiz.find({ userId: req.user!.id, bookId }).sort({ timestamp: -1 })
    res.json(quizzes)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
