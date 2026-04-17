import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getBookmarks, createBookmark, deleteBookmark } from '../controllers/bookmarkController'

const router = Router()

router.use(authMiddleware)
router.get('/:bookId', getBookmarks)
router.post('/', createBookmark)
router.delete('/:id', deleteBookmark)

export default router
