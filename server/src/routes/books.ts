import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { upload, uploadBook, getAll, getById } from '../controllers/bookController'

const router = Router()

router.use(authMiddleware)

router.post('/upload', upload.single('file'), uploadBook)
router.get('/', getAll)
router.get('/:id', getById)

export default router
