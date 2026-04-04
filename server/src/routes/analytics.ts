import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getAnalytics, getProfile } from '../controllers/analyticsController'

const router = Router()

router.use(authMiddleware)
router.get('/', getAnalytics)
router.get('/profile', getProfile)

export default router
