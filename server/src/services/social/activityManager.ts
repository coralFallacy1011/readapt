import Activity from '../../models/Activity'
import Follow from '../../models/Follow'
import User from '../../models/User'
import { Types } from 'mongoose'
import { emitToUsers } from '../../utils/websocket'

/**
 * Get activity feed for a user
 * 
 * Requirements:
 * - 9.1: Show activities when user completes a book
 * - 9.2: Show activities when user achieves streak milestone
 * - 9.3: Show activities when user uploads new book
 * - 9.4: Display activities in reverse chronological order
 * - 9.7: Respect user privacy settings (activitySharingEnabled)
 * 
 * Privacy Rules:
 * - Only show activities from users the current user follows
 * - Respect activity visibility: 'public', 'followers', 'private'
 * - Respect user activitySharingEnabled setting
 * - Filter out private activities
 * 
 * @param userId - The ID of the user requesting the feed
 * @param limit - Maximum number of activities to return
 * @param offset - Number of activities to skip (for pagination)
 * @returns Array of activities with user information
 */
export async function getActivityFeed(
  userId: string | Types.ObjectId,
  limit: number = 20,
  offset: number = 0
) {
  // Get list of users the current user follows
  const follows = await Follow.find({ followerId: userId }).select('followingId')
  const followingIds = follows.map(f => f.followingId)
  
  if (followingIds.length === 0) {
    return []
  }
  
  // Get users who have activity sharing enabled
  const usersWithSharingEnabled = await User.find({
    _id: { $in: followingIds },
    activitySharingEnabled: true
  }).select('_id')
  
  const eligibleUserIds = usersWithSharingEnabled.map(u => u._id)
  
  if (eligibleUserIds.length === 0) {
    return []
  }
  
  // Query activities from followed users with proper visibility
  // - Must be from users with activitySharingEnabled: true
  // - Must have visibility 'public' or 'followers' (not 'private')
  // - Sort by timestamp in reverse chronological order (Requirement 9.4)
  const activities = await Activity.find({
    userId: { $in: eligibleUserIds },
    visibility: { $in: ['public', 'followers'] }
  })
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .populate('userId', '_id name email')
    .populate('bookId', '_id title')
    .lean()
  
  return activities
}

/**
 * Broadcast a new activity to all followers of the activity creator
 * Requirements: 9.4
 */
export async function broadcastActivityToFollowers(
  activity: any,
  userId: string | Types.ObjectId
): Promise<void> {
  try {
    // Find all users who follow the activity creator
    const followers = await Follow.find({ followingId: userId }).select('followerId')
    const followerIds = followers.map(f => f.followerId.toString())

    if (followerIds.length === 0) return

    emitToUsers(followerIds, 'activity:new', activity)
  } catch (err) {
    console.error('broadcastActivityToFollowers error:', err)
  }
}

/**
 * Create an activity document and broadcast it to followers
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export async function createActivity(
  userId: string,
  type: string,
  data: Record<string, any>
): Promise<void> {
  const activity = await Activity.create({
    userId,
    type,
    timestamp: new Date(),
    visibility: 'followers',
    likes: [],
    comments: [],
    ...data,
  })

  await broadcastActivityToFollowers(activity, userId)
}
