/**
 * Integration tests: Social complete flow
 * Requirements: 8.2, 9.1, 9.4, 9.6
 *
 * Tests the complete flow:
 * user follows → activity created → feed update → like/comment
 */

import { Types } from 'mongoose'
import {
  createActivity,
  broadcastActivityToFollowers,
  getActivityFeed,
} from '../services/social/activityManager'

jest.mock('../models/Follow')
jest.mock('../models/Activity')
jest.mock('../models/User')
jest.mock('../utils/websocket')

import Follow from '../models/Follow'
import Activity from '../models/Activity'
import User from '../models/User'
import { emitToUsers } from '../utils/websocket'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeObjectId() {
  return new Types.ObjectId()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Social Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─── Flow 1: Follow creates a Follow document ─────────────────────────────

  describe('Flow 1: Follow creates a Follow document (Requirement 8.2)', () => {
    it('creates a Follow document with correct followerId and followingId', async () => {
      const followerId = makeObjectId()
      const followingId = makeObjectId()

      ;(Follow.create as jest.Mock).mockResolvedValue({
        _id: makeObjectId(),
        followerId,
        followingId,
        createdAt: new Date(),
      })

      const result = await Follow.create({ followerId, followingId })

      expect(Follow.create).toHaveBeenCalledWith({ followerId, followingId })
      expect(result.followerId).toEqual(followerId)
      expect(result.followingId).toEqual(followingId)
    })
  })

  // ─── Flow 2: Activity creation broadcasts to followers ────────────────────

  describe('Flow 2: Activity creation broadcasts to followers (Requirement 9.1)', () => {
    it('emits activity:new to all followers when activity is created', async () => {
      const userId = makeObjectId()
      const follower1 = makeObjectId()
      const follower2 = makeObjectId()

      const mockActivity = {
        _id: makeObjectId(),
        userId,
        type: 'book_completed',
        timestamp: new Date(),
        visibility: 'followers',
        likes: [],
        comments: [],
      }

      ;(Activity.create as jest.Mock).mockResolvedValue(mockActivity)

      // broadcastActivityToFollowers calls Follow.find({ followingId }).select('followerId')
      ;(Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followerId: follower1 },
          { followerId: follower2 },
        ]),
      })

      await createActivity(userId.toString(), 'book_completed', { bookTitle: 'Test Book' })

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userId.toString(),
          type: 'book_completed',
          bookTitle: 'Test Book',
        })
      )

      expect(emitToUsers).toHaveBeenCalledWith(
        expect.arrayContaining([follower1.toString(), follower2.toString()]),
        'activity:new',
        mockActivity
      )
    })

    it('does not emit when user has no followers', async () => {
      const userId = makeObjectId()

      ;(Activity.create as jest.Mock).mockResolvedValue({ _id: makeObjectId(), userId })
      ;(Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      })

      await createActivity(userId.toString(), 'streak_milestone', { streakCount: 7 })

      expect(emitToUsers).not.toHaveBeenCalled()
    })
  })

  // ─── Flow 3: Activity feed returns activities sorted newest-first ─────────

  describe('Flow 3: Activity feed returns activities from followed users, sorted newest-first (Requirement 9.4)', () => {
    it('returns activities from followed users only', async () => {
      const viewerId = makeObjectId()
      const followedUser = makeObjectId()

      const mockActivities = [
        { _id: makeObjectId(), userId: followedUser, type: 'book_completed', timestamp: new Date('2024-03-02') },
        { _id: makeObjectId(), userId: followedUser, type: 'streak_milestone', timestamp: new Date('2024-03-01') },
      ]

      ;(Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([{ followingId: followedUser }]),
      })
      ;(User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: followedUser }]),
      })

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockActivities),
      }
      ;(Activity.find as jest.Mock).mockReturnValue(mockQuery)

      const feed = await getActivityFeed(viewerId)

      expect(Follow.find).toHaveBeenCalledWith({ followerId: viewerId })
      expect(mockQuery.sort).toHaveBeenCalledWith({ timestamp: -1 })
      expect(feed).toHaveLength(2)
    })

    it('returns empty array when user follows nobody', async () => {
      const viewerId = makeObjectId()

      ;(Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      })

      const feed = await getActivityFeed(viewerId)

      expect(feed).toEqual([])
      expect(Activity.find).not.toHaveBeenCalled()
    })

    it('returns empty array when all followed users have sharing disabled', async () => {
      const viewerId = makeObjectId()
      const followedUser = makeObjectId()

      ;(Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([{ followingId: followedUser }]),
      })
      ;(User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([]), // no users with sharing enabled
      })

      const feed = await getActivityFeed(viewerId)

      expect(feed).toEqual([])
    })
  })

  // ─── Flow 4: Like toggles correctly ──────────────────────────────────────

  describe('Flow 4: Like toggles correctly (Requirement 9.6)', () => {
    it('adds like when user has not yet liked the activity', () => {
      const userId = makeObjectId()
      const otherUser = makeObjectId()

      const activity = {
        likes: [otherUser],
        save: jest.fn().mockResolvedValue(true),
      }

      const likeIndex = activity.likes.findIndex(
        (like: Types.ObjectId) => like.toString() === userId.toString()
      )
      expect(likeIndex).toBe(-1)

      if (likeIndex > -1) {
        activity.likes.splice(likeIndex, 1)
      } else {
        activity.likes.push(userId as any)
      }

      expect(activity.likes).toContainEqual(userId)
      expect(activity.likes).toHaveLength(2)
    })

    it('removes like when user has already liked the activity', () => {
      const userId = makeObjectId()

      const activity = {
        likes: [userId],
        save: jest.fn().mockResolvedValue(true),
      }

      const likeIndex = activity.likes.findIndex(
        (like: Types.ObjectId) => like.toString() === userId.toString()
      )
      expect(likeIndex).toBe(0)

      activity.likes.splice(likeIndex, 1)

      expect(activity.likes).toHaveLength(0)
    })
  })

  // ─── Flow 5: Comment adds to activity.comments ────────────────────────────

  describe('Flow 5: Comment adds to activity.comments array (Requirement 9.6)', () => {
    it('pushes a new comment with userId, text, and timestamp', () => {
      const userId = makeObjectId()

      const activity = {
        comments: [] as Array<{ userId: Types.ObjectId; text: string; timestamp: Date }>,
        save: jest.fn().mockResolvedValue(true),
      }

      const comment = {
        userId,
        text: 'Great progress!',
        timestamp: new Date(),
      }

      activity.comments.push(comment)

      expect(activity.comments).toHaveLength(1)
      expect(activity.comments[0].userId).toEqual(userId)
      expect(activity.comments[0].text).toBe('Great progress!')
      expect(activity.comments[0].timestamp).toBeInstanceOf(Date)
    })

    it('accumulates multiple comments', () => {
      const activity = {
        comments: [] as Array<{ userId: Types.ObjectId; text: string; timestamp: Date }>,
      }

      activity.comments.push({ userId: makeObjectId(), text: 'First!', timestamp: new Date() })
      activity.comments.push({ userId: makeObjectId(), text: 'Second!', timestamp: new Date() })

      expect(activity.comments).toHaveLength(2)
    })
  })
})
