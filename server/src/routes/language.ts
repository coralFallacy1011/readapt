import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { detectLanguage, updateBookLanguage } from '../controllers/languageController'

const router = Router()

router.post('/detect', authMiddleware, detectLanguage)
router.put('/books/:id/language', authMiddleware, updateBookLanguage)

export default router
