import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getAnalytics } from '../controllers/analyticsController'

const router = Router()

router.use(authMiddleware)
router.get('/', getAnalytics)

export default router
