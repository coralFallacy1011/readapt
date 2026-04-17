import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import User from '../models/User'
import Follow from '../models/Follow'
import Book from '../models/Book'
import Activity from '../models/Activity'
import { getActivityFeed as getActivityFeedService } from '../services/social/activityManager'
import { 
  createChallenge as createChallengeService,
  respondToInvitation,
  leaveChallenge as leaveChallengeService,
  getUserChallenges,
  getChallengeLeaderboard as getChallengeLeaderboardService,
  completeChallenge as completeChallengeService
} from '../services/social/challengeManager'
import Challenge from '../models/Challenge'
import { Types } from 'mongoose'

export async function searchUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string) ?? ''
    if (!q.trim()) { res.json([]); return }
    
    const searchTerm = q.trim()
    
    // Search by name OR email (Requirement 8.1)
    const users = await User.find({
      _id: { $ne: req.user!.id },
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select('_id name email').limit(20)
    
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function followUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params
    
    if (!userId) {
      res.status(400).json({ error: 'userId required' })
      return
    }
    
    // Prevent self-follow
    if (userId === req.user!.id.toString()) {
      res.status(400).json({ error: 'Cannot follow yourself' })
      return
    }
    
    // Check if target user exists
    const targetUser = await User.findById(userId)
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    
    // Create unidirectional follow relationship (Requirement 8.2, 8.6)
    await Follow.create({ followerId: req.user!.id, followingId: userId })
    res.status(201).json({ message: 'Following' })
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code
    if (code === 11000) {
      res.status(409).json({ error: 'Already following' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function unfollowUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params
    
    if (!userId) {
      res.status(400).json({ error: 'userId required' })
      return
    }
    
    // Unfollow (Requirement 8.3)
    const result = await Follow.deleteOne({ 
      followerId: req.user!.id, 
      followingId: userId 
    })
    
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Follow relationship not found' })
      return
    }
    
    res.json({ message: 'Unfollowed' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFollowing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const follows = await Follow.find({ followerId: req.user!.id }).select('followingId')
    const ids = follows.map(f => f.followingId)
    const users = await User.find({ _id: { $in: ids } }).select('_id name')
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFollowers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const follows = await Follow.find({ followingId: req.user!.id }).select('followerId')
    const ids = follows.map(f => f.followerId)
    const users = await User.find({ _id: { $in: ids } }).select('_id name')
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFollowingFeed(req: AuthRequest, res: Response): Promise<void> {
  try {
    const follows = await Follow.find({ followerId: req.user!.id }).select('followingId')
    const ids = follows.map(f => f.followingId)
    const books = await Book.find({ userId: { $in: ids }, isPublic: true })
      .select('-words -pdfData')
      .sort({ createdAt: -1 })
      .limit(20)
      .populate<{ userId: { _id: unknown; name: string } }>('userId', '_id name')
    const result = books.map(b => ({
      _id: b._id,
      title: b.title,
      totalWords: b.totalWords,
      createdAt: b.createdAt,
      owner: b.userId
    }))
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getActivityFeed(req: AuthRequest, res: Response): Promise<void> {
  try {
    const limitParam = req.query.limit as string
    const offsetParam = req.query.offset as string
    
    let limit = limitParam ? parseInt(limitParam) : 20
    let offset = offsetParam ? parseInt(offsetParam) : 0
    
    // Default to 20/0 if parsing fails
    if (isNaN(limit)) limit = 20
    if (isNaN(offset)) offset = 0
    
    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      res.status(400).json({ error: 'Limit must be between 1 and 100' })
      return
    }
    
    if (offset < 0) {
      res.status(400).json({ error: 'Offset must be non-negative' })
      return
    }
    
    const activities = await getActivityFeedService(req.user!.id, limit, offset)
    res.json(activities)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function likeActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    
    if (!id) {
      res.status(400).json({ error: 'Activity ID required' })
      return
    }
    
    const activity = await Activity.findById(id)
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' })
      return
    }
    
    const userId = req.user!.id
    const likeIndex = activity.likes.findIndex(like => like.toString() === userId.toString())
    
    // Toggle like: remove if already liked, add if not liked
    if (likeIndex > -1) {
      activity.likes.splice(likeIndex, 1)
    } else {
      activity.likes.push(userId as any)
    }
    
    await activity.save()
    res.json({ liked: likeIndex === -1, likesCount: activity.likes.length })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function commentActivity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { text } = req.body
    
    if (!id) {
      res.status(400).json({ error: 'Activity ID required' })
      return
    }
    
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Comment text required' })
      return
    }
    
    const activity = await Activity.findById(id)
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' })
      return
    }
    
    const comment = {
      userId: req.user!.id as any,
      text: text.trim(),
      timestamp: new Date()
    }
    
    activity.comments.push(comment)
    await activity.save()
    
    res.status(201).json({ comment, commentsCount: activity.comments.length })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Challenge endpoints

export async function getChallenges(req: AuthRequest, res: Response): Promise<void> {
  try {
    const status = req.query.status as 'pending' | 'active' | 'completed' | 'cancelled' | undefined
    
    if (status && !['pending', 'active', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status parameter' })
      return
    }
    
    const userId = new Types.ObjectId(req.user!.id)
    const challenges = await getUserChallenges(userId, status)
    res.json(challenges)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, description, goalType, goalValue, duration, participantIds } = req.body
    
    // Validate required fields
    if (!name || !goalType || !goalValue || !duration || !participantIds) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }
    
    // Validate goalType
    if (!['words', 'books', 'time'].includes(goalType)) {
      res.status(400).json({ error: 'Invalid goal type' })
      return
    }
    
    // Validate goalValue and duration are positive numbers
    if (typeof goalValue !== 'number' || goalValue < 1) {
      res.status(400).json({ error: 'Goal value must be at least 1' })
      return
    }
    
    if (typeof duration !== 'number' || duration < 1) {
      res.status(400).json({ error: 'Duration must be at least 1 day' })
      return
    }
    
    // Validate participantIds is an array
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      res.status(400).json({ error: 'At least one participant is required' })
      return
    }
    
    // Convert participantIds to ObjectIds
    const participantObjectIds = participantIds.map((id: string) => new Types.ObjectId(id))
    
    const challenge = await createChallengeService(
      new Types.ObjectId(req.user!.id),
      name,
      description || '',
      goalType,
      goalValue,
      duration,
      participantObjectIds
    )
    
    res.status(201).json(challenge)
  } catch (err: unknown) {
    const message = (err as Error).message
    if (message.includes('not found') || message.includes('required')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function respondToChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { accept } = req.body
    
    if (!id) {
      res.status(400).json({ error: 'Challenge ID required' })
      return
    }
    
    if (typeof accept !== 'boolean') {
      res.status(400).json({ error: 'Accept parameter must be a boolean' })
      return
    }
    
    const challengeId = new Types.ObjectId(id)
    const userId = new Types.ObjectId(req.user!.id)
    const challenge = await respondToInvitation(challengeId, userId, accept)
    
    res.json(challenge)
  } catch (err: unknown) {
    const message = (err as Error).message
    if (message.includes('not found') || message.includes('not invited') || message.includes('already responded')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function leaveChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    
    if (!id) {
      res.status(400).json({ error: 'Challenge ID required' })
      return
    }
    
    const challengeId = new Types.ObjectId(id)
    const userId = new Types.ObjectId(req.user!.id)
    const challenge = await leaveChallengeService(challengeId, userId)
    
    res.json(challenge)
  } catch (err: unknown) {
    const message = (err as Error).message
    if (message.includes('not found') || message.includes('not a participant') || message.includes('already left') || message.includes('not accepted')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function completeChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    
    if (!id) {
      res.status(400).json({ error: 'Challenge ID required' })
      return
    }
    
    // Only the creator can complete the challenge
    const challenge = await Challenge.findById(id)
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' })
      return
    }
    
    if (challenge.creatorId.toString() !== req.user!.id.toString()) {
      res.status(403).json({ error: 'Only the challenge creator can complete it' })
      return
    }
    
    const completed = await completeChallengeService(new Types.ObjectId(id))
    res.json(completed)
  } catch (err: unknown) {
    const message = (err as Error).message
    if (message.includes('not found') || message.includes('not active')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getChallengeLeaderboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    
    if (!id) {
      res.status(400).json({ error: 'Challenge ID required' })
      return
    }
    
    const challengeId = new Types.ObjectId(id)
    const challenge = await getChallengeLeaderboardService(challengeId)
    
    res.json(challenge.leaderboard)
  } catch (err: unknown) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}
