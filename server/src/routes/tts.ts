import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { synthesizeSpeech, listVoices } from '../controllers/ttsController'

const router = Router()

router.use(authMiddleware)
router.post('/synthesize', synthesizeSpeech)
router.get('/voices', listVoices)

export default router
