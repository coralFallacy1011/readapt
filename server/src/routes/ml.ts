import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getSpeedRecommendation,
  respondToSpeedRecommendation,
  getORPStatus,
  toggleORP,
  getBookRecommendations,
  getTimeRecommendation,
  getWPMRecommendation,
  getReadingDNA
} from '../controllers/mlController'

const router = Router()

// All ML endpoints require authentication
router.use(authMiddleware)

// Speed recommendation endpoints
router.get('/speed-recommendation', getSpeedRecommendation)
router.post('/speed-recommendation/respond', respondToSpeedRecommendation)

// ORP optimizer endpoints
router.get('/orp-status', getORPStatus)
router.post('/orp-toggle', toggleORP)

// Recommendation engine endpoints
router.get('/recommendations/books', getBookRecommendations)
router.get('/recommendations/time', getTimeRecommendation)
router.get('/recommendations/wpm', getWPMRecommendation)

// Reading DNA endpoint
router.get('/reading-dna', getReadingDNA)

export default router
