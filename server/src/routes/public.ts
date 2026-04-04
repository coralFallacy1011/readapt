import { Router } from 'express'
import { getPublicBooks } from '../controllers/publicController'

const router = Router()

router.get('/books', getPublicBooks)

export default router
