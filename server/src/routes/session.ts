import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { updateSession, getSessionByBook } from '../controllers/sessionController'

const router = Router()

router.use(authMiddleware)

router.post('/update', updateSession)
router.get('/:bookId', getSessionByBook)

export default router
