import { getActivityFeed } from '../services/social/activityManager'
import Activity from '../models/Activity'
import Follow from '../models/Follow'
import User from '../models/User'
import { Types } from 'mongoose'

jest.mock('../models/Activity')
jest.mock('../models/Follow')
jest.mock('../models/User')

describe('activityManager', () => {
  describe('getActivityFeed', () => {
    const mockUserId = new Types.ObjectId()
    const mockFollowedUser1 = new Types.ObjectId()
    const mockFollowedUser2 = new Types.ObjectId()
    const mockFollowedUser3 = new Types.ObjectId()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return empty array when user follows no one', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      })

      const result = await getActivityFeed(mockUserId, 20, 0)

      expect(result).toEqual([])
      expect(Follow.find).toHaveBeenCalledWith({ followerId: mockUserId })
    })

    it('should return empty array when no followed users have activity sharing enabled', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 },
          { followingId: mockFollowedUser2 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      })

      const result = await getActivityFeed(mockUserId, 20, 0)

      expect(result).toEqual([])
      expect(User.find).toHaveBeenCalledWith({
        _id: { $in: [mockFollowedUser1, mockFollowedUser2] },
        activitySharingEnabled: true
      })
    })

    it('should return activities from followed users with sharing enabled', async () => {
      const mockActivities = [
        {
          _id: new Types.ObjectId(),
          userId: { _id: mockFollowedUser1, name: 'User 1' },
          type: 'book_completed',
          bookTitle: 'Test Book',
          timestamp: new Date(),
          visibility: 'followers'
        },
        {
          _id: new Types.ObjectId(),
          userId: { _id: mockFollowedUser2, name: 'User 2' },
          type: 'streak_milestone',
          streakCount: 7,
          timestamp: new Date(),
          visibility: 'public'
        }
      ];

      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 },
          { followingId: mockFollowedUser2 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 },
          { _id: mockFollowedUser2 }
        ])
      });

      (Activity.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockActivities)
      })

      const result = await getActivityFeed(mockUserId, 20, 0)

      expect(result).toEqual(mockActivities)
      expect(Activity.find).toHaveBeenCalledWith({
        userId: { $in: [mockFollowedUser1, mockFollowedUser2] },
        visibility: { $in: ['public', 'followers'] }
      })
    })

    it('should filter out private activities', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 }
        ])
      });

      (Activity.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      })

      await getActivityFeed(mockUserId, 20, 0)

      // Verify that the query excludes 'private' visibility
      expect(Activity.find).toHaveBeenCalledWith({
        userId: { $in: [mockFollowedUser1] },
        visibility: { $in: ['public', 'followers'] }
      })
    })

    it('should sort activities by timestamp in reverse chronological order', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 }
        ])
      })

      const mockSort = jest.fn().mockReturnThis()
      const mockSkip = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockReturnThis()
      const mockPopulate = jest.fn().mockReturnThis()
      const mockLean = jest.fn().mockResolvedValue([])

      ;(Activity.find as jest.Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        lean: mockLean
      })

      await getActivityFeed(mockUserId, 20, 0)

      expect(mockSort).toHaveBeenCalledWith({ timestamp: -1 })
    })

    it('should respect pagination with limit and offset', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 }
        ])
      })

      const mockSort = jest.fn().mockReturnThis()
      const mockSkip = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockReturnThis()
      const mockPopulate = jest.fn().mockReturnThis()
      const mockLean = jest.fn().mockResolvedValue([])

      ;(Activity.find as jest.Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        lean: mockLean
      })

      await getActivityFeed(mockUserId, 10, 5)

      expect(mockSkip).toHaveBeenCalledWith(5)
      expect(mockLimit).toHaveBeenCalledWith(10)
    })

    it('should use default limit and offset when not provided', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 }
        ])
      })

      const mockSort = jest.fn().mockReturnThis()
      const mockSkip = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockReturnThis()
      const mockPopulate = jest.fn().mockReturnThis()
      const mockLean = jest.fn().mockResolvedValue([])

      ;(Activity.find as jest.Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        lean: mockLean
      })

      await getActivityFeed(mockUserId)

      expect(mockSkip).toHaveBeenCalledWith(0)
      expect(mockLimit).toHaveBeenCalledWith(20)
    })

    it('should populate userId and bookId fields', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 }
        ])
      })

      const mockSort = jest.fn().mockReturnThis()
      const mockSkip = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockReturnThis()
      const mockPopulate = jest.fn().mockReturnThis()
      const mockLean = jest.fn().mockResolvedValue([])

      ;(Activity.find as jest.Mock).mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        lean: mockLean
      })

      await getActivityFeed(mockUserId, 20, 0)

      expect(mockPopulate).toHaveBeenCalledWith('userId', '_id name email')
      expect(mockPopulate).toHaveBeenCalledWith('bookId', '_id title')
    })

    it('should only include activities from users with activitySharingEnabled', async () => {
      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 },
          { followingId: mockFollowedUser2 },
          { followingId: mockFollowedUser3 }
        ])
      });

      // Only user1 and user2 have sharing enabled
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 },
          { _id: mockFollowedUser2 }
        ])
      });

      (Activity.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      })

      await getActivityFeed(mockUserId, 20, 0)

      // Should only query activities from users with sharing enabled
      expect(Activity.find).toHaveBeenCalledWith({
        userId: { $in: [mockFollowedUser1, mockFollowedUser2] },
        visibility: { $in: ['public', 'followers'] }
      })
    })

    it('should handle different activity types', async () => {
      const mockActivities = [
        {
          _id: new Types.ObjectId(),
          userId: { _id: mockFollowedUser1, name: 'User 1' },
          type: 'book_completed',
          bookTitle: 'Test Book',
          timestamp: new Date(),
          visibility: 'followers'
        },
        {
          _id: new Types.ObjectId(),
          userId: { _id: mockFollowedUser1, name: 'User 1' },
          type: 'streak_milestone',
          streakCount: 7,
          timestamp: new Date(),
          visibility: 'public'
        },
        {
          _id: new Types.ObjectId(),
          userId: { _id: mockFollowedUser2, name: 'User 2' },
          type: 'book_uploaded',
          bookTitle: 'New Book',
          timestamp: new Date(),
          visibility: 'public'
        }
      ];

      (Follow.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { followingId: mockFollowedUser1 },
          { followingId: mockFollowedUser2 }
        ])
      });

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: mockFollowedUser1 },
          { _id: mockFollowedUser2 }
        ])
      });

      (Activity.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockActivities)
      })

      const result = await getActivityFeed(mockUserId, 20, 0)

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('book_completed')
      expect(result[1].type).toBe('streak_milestone')
      expect(result[2].type).toBe('book_uploaded')
    })
  })
})
