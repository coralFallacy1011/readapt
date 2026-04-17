import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  upload,
  uploadBook,
  getAll,
  getById,
  getPDF,
  toggleVisibility,
  uploadEpub,
  uploadEPUB,
  getChapters,
} from '../controllers/bookController'

const router = Router()

router.use(authMiddleware)

router.post('/upload', upload.single('file'), uploadBook)
router.post('/upload/epub', uploadEpub.single('file'), uploadEPUB)
router.get('/', getAll)
router.get('/:id', getById)
router.get('/:id/pdf', getPDF)
router.get('/:id/chapters', getChapters)
router.patch('/:id/visibility', toggleVisibility)

export default router
