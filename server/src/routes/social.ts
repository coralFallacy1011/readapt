import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { searchUsers, followUser, unfollowUser, getFollowing, getFollowingFeed } from '../controllers/socialController'

const router = Router()

router.use(authMiddleware)
router.get('/search', searchUsers)
router.post('/follow', followUser)
router.delete('/follow/:userId', unfollowUser)
router.get('/following', getFollowing)
router.get('/feed', getFollowingFeed)

export default router
