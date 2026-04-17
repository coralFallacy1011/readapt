import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getAnalytics,
  getProfile,
  getTrends,
  getProductiveTimes,
  getSessionStats,
  getGenreStats,
  getHeatmap,
  getComparison
} from '../controllers/analyticsController'

const router = Router()

router.use(authMiddleware)

router.get('/', getAnalytics)
router.get('/profile', getProfile)

// Enhanced analytics endpoints (Requirements 13.1–13.7)
router.get('/trends', getTrends)                // GET /api/analytics/trends?period=week|month
router.get('/productive-times', getProductiveTimes) // GET /api/analytics/productive-times
router.get('/session-stats', getSessionStats)   // GET /api/analytics/session-stats
router.get('/genres', getGenreStats)            // GET /api/analytics/genres
router.get('/heatmap', getHeatmap)              // GET /api/analytics/heatmap
router.get('/comparison', getComparison)        // GET /api/analytics/comparison?period=week|month

export default router
