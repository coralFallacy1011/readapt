import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { upload, uploadBook, getAll, getById, getPDF, toggleVisibility } from '../controllers/bookController'

const router = Router()

router.use(authMiddleware)

router.post('/upload', upload.single('file'), uploadBook)
router.get('/', getAll)
router.get('/:id', getById)
router.get('/:id/pdf', getPDF)
router.patch('/:id/visibility', toggleVisibility)

export default router
