import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getStreak,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getBadges
} from '../controllers/gamificationController'

const router = Router()

// All gamification endpoints require authentication
router.use(authMiddleware)

// Streak endpoints
router.get('/streak', getStreak)

// Goal endpoints
router.get('/goals', getGoals)
router.post('/goals', createGoal)
router.put('/goals/:id', updateGoal)
router.delete('/goals/:id', deleteGoal)

// Badge endpoints
router.get('/badges', getBadges)

export default router
