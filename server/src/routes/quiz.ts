import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { generateQuiz, submitQuiz, getQuizHistory } from '../controllers/quizController'

const router = Router()

router.use(authMiddleware)
router.post('/generate', generateQuiz)
router.post('/:id/submit', submitQuiz)
router.get('/:bookId', getQuizHistory)

export default router
