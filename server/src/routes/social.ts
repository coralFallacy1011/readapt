import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { 
  searchUsers, 
  followUser, 
  unfollowUser, 
  getFollowing, 
  getFollowers, 
  getFollowingFeed, 
  getActivityFeed, 
  likeActivity, 
  commentActivity,
  getChallenges,
  createChallenge,
  respondToChallenge,
  leaveChallenge,
  completeChallenge,
  getChallengeLeaderboard
} from '../controllers/socialController'

const router = Router()

router.use(authMiddleware)
router.get('/users/search', searchUsers)
router.post('/follow/:userId', followUser)
router.delete('/follow/:userId', unfollowUser)
router.get('/following', getFollowing)
router.get('/followers', getFollowers)
router.get('/feed', getFollowingFeed)
router.get('/activity/feed', getActivityFeed)
router.post('/activities/:id/like', likeActivity)
router.post('/activities/:id/comment', commentActivity)

// Challenge routes
router.get('/challenges', getChallenges)
router.post('/challenges', createChallenge)
router.post('/challenges/:id/respond', respondToChallenge)
router.post('/challenges/:id/leave', leaveChallenge)
router.post('/challenges/:id/complete', completeChallenge)
router.get('/challenges/:id/leaderboard', getChallengeLeaderboard)

export default router
