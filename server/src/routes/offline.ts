import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { cacheBook, removeCachedBook, getCachedBooks, syncOfflineSessions } from '../controllers/offlineController'

const router = Router()

router.post('/cache/:bookId', authMiddleware, cacheBook)
router.delete('/cache/:bookId', authMiddleware, removeCachedBook)
router.get('/cached', authMiddleware, getCachedBooks)
router.post('/sync', authMiddleware, syncOfflineSessions)

export default router
