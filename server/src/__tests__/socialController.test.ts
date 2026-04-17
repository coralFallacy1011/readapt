import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { searchUsers, followUser, unfollowUser, getFollowing, getFollowers, getFollowingFeed, getActivityFeed, likeActivity, commentActivity } from '../controllers/socialController'
import User from '../models/User'
import Follow from '../models/Follow'
import Book from '../models/Book'
import Activity from '../models/Activity'
import * as activityManager from '../services/social/activityManager'

// Mock mongoose models
jest.mock('../models/User')
jest.mock('../models/Follow')
jest.mock('../models/Book')
jest.mock('../models/Activity')
jest.mock('../services/social/activityManager')

function makeAuthReq(user: { id: string }, query: Record<string, unknown> = {}, params: Record<string, unknown> = {}, body: Record<string, unknown> = {}): AuthRequest {
  return {
    user,
    query,
    params,
    body
  } as unknown as AuthRequest
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// searchUsers - Requirement 8.1
// ---------------------------------------------------------------------------
describe('searchUsers', () => {
  it('should search users by name', async () => {
    const mockUsers = [
      { _id: 'user2', name: 'Alice Smith', email: 'alice@example.com' },
      { _id: 'user3', name: 'Alice Johnson', email: 'alice.j@example.com' }
    ]
    
    const mockFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockUsers)
      })
    })
    ;(User.find as jest.Mock) = mockFind

    const req = makeAuthReq({ id: 'user1' }, { q: 'Alice' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(mockFind).toHaveBeenCalledWith({
      _id: { $ne: 'user1' },
      $or: [
        { name: { $regex: 'Alice', $options: 'i' } },
        { email: { $regex: 'Alice', $options: 'i' } }
      ]
    })
    expect(res.json).toHaveBeenCalledWith(mockUsers)
  })

  it('should search users by email', async () => {
    const mockUsers = [
      { _id: 'user2', name: 'Bob', email: 'bob@example.com' }
    ]
    
    const mockFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockUsers)
      })
    })
    ;(User.find as jest.Mock) = mockFind

    const req = makeAuthReq({ id: 'user1' }, { q: 'bob@example.com' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(mockFind).toHaveBeenCalledWith({
      _id: { $ne: 'user1' },
      $or: [
        { name: { $regex: 'bob@example.com', $options: 'i' } },
        { email: { $regex: 'bob@example.com', $options: 'i' } }
      ]
    })
    expect(res.json).toHaveBeenCalledWith(mockUsers)
  })

  it('should return empty array when query is empty', async () => {
    const req = makeAuthReq({ id: 'user1' }, { q: '' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(res.json).toHaveBeenCalledWith([])
    expect(User.find).not.toHaveBeenCalled()
  })

  it('should return empty array when query is whitespace', async () => {
    const req = makeAuthReq({ id: 'user1' }, { q: '   ' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(res.json).toHaveBeenCalledWith([])
    expect(User.find).not.toHaveBeenCalled()
  })

  it('should exclude current user from search results', async () => {
    const mockFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })
    ;(User.find as jest.Mock) = mockFind

    const req = makeAuthReq({ id: 'user1' }, { q: 'test' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: 'user1' }
      })
    )
  })

  it('should limit results to 20 users', async () => {
    const mockLimit = jest.fn().mockResolvedValue([])
    const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockFind = jest.fn().mockReturnValue({ select: mockSelect })
    ;(User.find as jest.Mock) = mockFind

    const req = makeAuthReq({ id: 'user1' }, { q: 'test' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(mockLimit).toHaveBeenCalledWith(20)
  })

  it('should handle database errors gracefully', async () => {
    const mockFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    })
    ;(User.find as jest.Mock) = mockFind

    const req = makeAuthReq({ id: 'user1' }, { q: 'test' })
    const res = makeRes()

    await searchUsers(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// followUser - Requirements 8.2, 8.6
// ---------------------------------------------------------------------------
describe('followUser', () => {
  it('should create unidirectional follow relationship', async () => {
    const mockTargetUser = { _id: 'user2', name: 'Bob' }
    ;(User.findById as jest.Mock).mockResolvedValue(mockTargetUser)
    ;(Follow.create as jest.Mock).mockResolvedValue({
      followerId: 'user1',
      followingId: 'user2'
    })

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await followUser(req, res)

    expect(User.findById).toHaveBeenCalledWith('user2')
    expect(Follow.create).toHaveBeenCalledWith({
      followerId: 'user1',
      followingId: 'user2'
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ message: 'Following' })
  })

  it('should return 400 when userId is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, {})
    const res = makeRes()

    await followUser(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'userId required' })
    expect(Follow.create).not.toHaveBeenCalled()
  })

  it('should return 400 when trying to follow yourself', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user1' })
    const res = makeRes()

    await followUser(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Cannot follow yourself' })
    expect(Follow.create).not.toHaveBeenCalled()
  })

  it('should return 404 when target user does not exist', async () => {
    ;(User.findById as jest.Mock).mockResolvedValue(null)

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'nonexistent' })
    const res = makeRes()

    await followUser(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
    expect(Follow.create).not.toHaveBeenCalled()
  })

  it('should return 409 when already following', async () => {
    const mockTargetUser = { _id: 'user2', name: 'Bob' }
    ;(User.findById as jest.Mock).mockResolvedValue(mockTargetUser)
    
    const duplicateError = new Error('Duplicate key') as Error & { code: number }
    duplicateError.code = 11000
    ;(Follow.create as jest.Mock).mockRejectedValue(duplicateError)

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await followUser(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Already following' })
  })

  it('should handle database errors gracefully', async () => {
    const mockTargetUser = { _id: 'user2', name: 'Bob' }
    ;(User.findById as jest.Mock).mockResolvedValue(mockTargetUser)
    ;(Follow.create as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await followUser(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// unfollowUser - Requirement 8.3
// ---------------------------------------------------------------------------
describe('unfollowUser', () => {
  it('should delete follow relationship', async () => {
    ;(Follow.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 })

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await unfollowUser(req, res)

    expect(Follow.deleteOne).toHaveBeenCalledWith({
      followerId: 'user1',
      followingId: 'user2'
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Unfollowed' })
  })

  it('should return 400 when userId is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, {})
    const res = makeRes()

    await unfollowUser(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'userId required' })
    expect(Follow.deleteOne).not.toHaveBeenCalled()
  })

  it('should return 404 when follow relationship does not exist', async () => {
    ;(Follow.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 })

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await unfollowUser(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Follow relationship not found' })
  })

  it('should handle database errors gracefully', async () => {
    ;(Follow.deleteOne as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = makeAuthReq({ id: 'user1' }, {}, { userId: 'user2' })
    const res = makeRes()

    await unfollowUser(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// getFollowing - Requirement 8.4
// ---------------------------------------------------------------------------
describe('getFollowing', () => {
  it('should return list of users being followed', async () => {
    const mockFollows = [
      { followingId: 'user2' },
      { followingId: 'user3' }
    ]
    const mockUsers = [
      { _id: 'user2', name: 'Alice' },
      { _id: 'user3', name: 'Bob' }
    ]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUsers)
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowing(req, res)

    expect(mockFollowFind).toHaveBeenCalledWith({ followerId: 'user1' })
    expect(mockUserFind).toHaveBeenCalledWith({ _id: { $in: ['user2', 'user3'] } })
    expect(res.json).toHaveBeenCalledWith(mockUsers)
  })

  it('should return empty array when not following anyone', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowing(req, res)

    expect(res.json).toHaveBeenCalledWith([])
  })

  it('should handle database errors gracefully', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowing(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// getFollowers - Requirement 8.5
// ---------------------------------------------------------------------------
describe('getFollowers', () => {
  it('should return list of users who follow the current user', async () => {
    const mockFollows = [
      { followerId: 'user2' },
      { followerId: 'user3' }
    ]
    const mockUsers = [
      { _id: 'user2', name: 'Alice' },
      { _id: 'user3', name: 'Bob' }
    ]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUsers)
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(mockFollowFind).toHaveBeenCalledWith({ followingId: 'user1' })
    expect(mockUserFind).toHaveBeenCalledWith({ _id: { $in: ['user2', 'user3'] } })
    expect(res.json).toHaveBeenCalledWith(mockUsers)
  })

  it('should return empty array when no followers', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(res.json).toHaveBeenCalledWith([])
  })

  it('should only return _id and name fields', async () => {
    const mockFollows = [{ followerId: 'user2' }]
    const mockUsers = [{ _id: 'user2', name: 'Alice' }]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockSelect = jest.fn().mockResolvedValue(mockUsers)
    const mockUserFind = jest.fn().mockReturnValue({
      select: mockSelect
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(mockSelect).toHaveBeenCalledWith('_id name')
  })

  it('should handle single follower', async () => {
    const mockFollows = [{ followerId: 'user2' }]
    const mockUsers = [{ _id: 'user2', name: 'Alice' }]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUsers)
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(res.json).toHaveBeenCalledWith(mockUsers)
    expect(mockUsers).toHaveLength(1)
  })

  it('should handle multiple followers', async () => {
    const mockFollows = [
      { followerId: 'user2' },
      { followerId: 'user3' },
      { followerId: 'user4' }
    ]
    const mockUsers = [
      { _id: 'user2', name: 'Alice' },
      { _id: 'user3', name: 'Bob' },
      { _id: 'user4', name: 'Charlie' }
    ]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUsers)
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(res.json).toHaveBeenCalledWith(mockUsers)
    expect(mockUsers).toHaveLength(3)
  })

  it('should handle database errors gracefully', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('should handle User.find errors gracefully', async () => {
    const mockFollows = [{ followerId: 'user2' }]
    
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockUserFind = jest.fn().mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    })
    ;(User.find as jest.Mock) = mockUserFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowers(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// getFollowingFeed - Requirement 9.1
// ---------------------------------------------------------------------------
describe('getFollowingFeed', () => {
  it('should return public books from followed users', async () => {
    const mockFollows = [
      { followingId: 'user2' },
      { followingId: 'user3' }
    ]

    const mockBooks = [
      {
        _id: 'book1',
        title: 'Book 1',
        totalWords: 5000,
        createdAt: new Date('2024-01-01'),
        userId: { _id: 'user2', name: 'Alice' }
      },
      {
        _id: 'book2',
        title: 'Book 2',
        totalWords: 3000,
        createdAt: new Date('2024-01-02'),
        userId: { _id: 'user3', name: 'Bob' }
      }
    ]

    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockBookFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockBooks)
          })
        })
      })
    })
    ;(Book.find as jest.Mock) = mockBookFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowingFeed(req, res)

    expect(mockFollowFind).toHaveBeenCalledWith({ followerId: 'user1' })
    expect(mockBookFind).toHaveBeenCalledWith({
      userId: { $in: ['user2', 'user3'] },
      isPublic: true
    })
    
    const result = (res.json as jest.Mock).mock.calls[0][0]
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      _id: 'book1',
      title: 'Book 1',
      totalWords: 5000,
      owner: { _id: 'user2', name: 'Alice' }
    })
  })

  it('should return empty array when not following anyone', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockBookFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue([])
          })
        })
      })
    })
    ;(Book.find as jest.Mock) = mockBookFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowingFeed(req, res)

    expect(res.json).toHaveBeenCalledWith([])
  })

  it('should limit feed to 20 books', async () => {
    const mockFollows = [{ followingId: 'user2' }]
    
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockLimit = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([])
    })
    const mockSort = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockSelect = jest.fn().mockReturnValue({ sort: mockSort })
    const mockBookFind = jest.fn().mockReturnValue({ select: mockSelect })
    ;(Book.find as jest.Mock) = mockBookFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowingFeed(req, res)

    expect(mockLimit).toHaveBeenCalledWith(20)
  })

  it('should sort books by creation date descending', async () => {
    const mockFollows = [{ followingId: 'user2' }]
    
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockFollows)
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const mockSort = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      })
    })
    const mockSelect = jest.fn().mockReturnValue({ sort: mockSort })
    const mockBookFind = jest.fn().mockReturnValue({ select: mockSelect })
    ;(Book.find as jest.Mock) = mockBookFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowingFeed(req, res)

    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 })
  })

  it('should handle database errors gracefully', async () => {
    const mockFollowFind = jest.fn().mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('DB error'))
    })
    ;(Follow.find as jest.Mock) = mockFollowFind

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getFollowingFeed(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// getActivityFeed - Requirements 9.1, 9.2, 9.3, 9.4, 9.7
// ---------------------------------------------------------------------------
describe('getActivityFeed', () => {
  it('should return activity feed with default pagination', async () => {
    const mockActivities = [
      {
        _id: 'activity1',
        userId: { _id: 'user2', name: 'Alice' },
        type: 'book_completed',
        bookTitle: 'Test Book',
        timestamp: new Date(),
        visibility: 'followers'
      }
    ];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 20, 0)
    expect(res.json).toHaveBeenCalledWith(mockActivities)
  })

  it('should respect custom limit parameter', async () => {
    const mockActivities: unknown[] = [];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' }, { limit: '10' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 10, 0)
    expect(res.json).toHaveBeenCalledWith(mockActivities)
  })

  it('should respect custom offset parameter', async () => {
    const mockActivities: unknown[] = [];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' }, { limit: '20', offset: '5' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 20, 5)
    expect(res.json).toHaveBeenCalledWith(mockActivities)
  })

  it('should return 400 when limit is less than 1', async () => {
    const req = makeAuthReq({ id: 'user1' }, { limit: '0' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Limit must be between 1 and 100' })
    expect(activityManager.getActivityFeed).not.toHaveBeenCalled()
  })

  it('should return 400 when limit is greater than 100', async () => {
    const req = makeAuthReq({ id: 'user1' }, { limit: '101' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Limit must be between 1 and 100' })
    expect(activityManager.getActivityFeed).not.toHaveBeenCalled()
  })

  it('should return 400 when offset is negative', async () => {
    const req = makeAuthReq({ id: 'user1' }, { offset: '-1' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Offset must be non-negative' })
    expect(activityManager.getActivityFeed).not.toHaveBeenCalled()
  })

  it('should handle empty activity feed', async () => {
    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue([])

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.json).toHaveBeenCalledWith([])
  })

  it('should handle multiple activity types', async () => {
    const mockActivities = [
      {
        _id: 'activity1',
        userId: { _id: 'user2', name: 'Alice' },
        type: 'book_completed',
        bookTitle: 'Test Book',
        timestamp: new Date(),
        visibility: 'followers'
      },
      {
        _id: 'activity2',
        userId: { _id: 'user3', name: 'Bob' },
        type: 'streak_milestone',
        streakCount: 7,
        timestamp: new Date(),
        visibility: 'public'
      },
      {
        _id: 'activity3',
        userId: { _id: 'user2', name: 'Alice' },
        type: 'book_uploaded',
        bookTitle: 'New Book',
        timestamp: new Date(),
        visibility: 'public'
      }
    ];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.json).toHaveBeenCalledWith(mockActivities)
    expect(mockActivities).toHaveLength(3)
  })

  it('should handle database errors gracefully', async () => {
    (activityManager.getActivityFeed as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = makeAuthReq({ id: 'user1' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('should parse limit and offset as integers', async () => {
    const mockActivities: unknown[] = [];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' }, { limit: '15', offset: '10' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 15, 10)
  })

  it('should use default values when limit and offset are not provided', async () => {
    const mockActivities: unknown[] = [];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' }, {})
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 20, 0)
  })

  it('should use default values when limit and offset are invalid strings', async () => {
    const mockActivities: unknown[] = [];

    (activityManager.getActivityFeed as jest.Mock).mockResolvedValue(mockActivities)

    const req = makeAuthReq({ id: 'user1' }, { limit: 'invalid', offset: 'invalid' })
    const res = makeRes()

    await getActivityFeed(req, res)

    expect(activityManager.getActivityFeed).toHaveBeenCalledWith('user1', 20, 0)
  })
})

// ---------------------------------------------------------------------------
// likeActivity - Requirement 9.6
// ---------------------------------------------------------------------------
describe('likeActivity', () => {
  it('should add like when activity is not already liked', async () => {
    const mockActivity = {
      _id: 'activity1',
      likes: [] as string[],
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(Activity.findById).toHaveBeenCalledWith('activity1')
    expect(mockActivity.likes).toHaveLength(1)
    expect(mockActivity.likes[0]).toBe('user1')
    expect(mockActivity.save).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ liked: true, likesCount: 1 })
  })

  it('should remove like when activity is already liked', async () => {
    const mockActivity = {
      _id: 'activity1',
      likes: ['user1', 'user2'] as string[],
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(mockActivity.likes).toHaveLength(1)
    expect(mockActivity.likes[0]).toBe('user2')
    expect(mockActivity.save).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ liked: false, likesCount: 1 })
  })

  it('should return 400 when activity ID is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, {})
    const res = makeRes()

    await likeActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Activity ID required' })
    expect(Activity.findById).not.toHaveBeenCalled()
  })

  it('should return 404 when activity does not exist', async () => {
    ;(Activity.findById as jest.Mock).mockResolvedValue(null)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'nonexistent' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Activity not found' })
  })

  it('should handle multiple likes from different users', async () => {
    const mockActivity = {
      _id: 'activity1',
      likes: ['user2', 'user3'] as string[],
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(mockActivity.likes).toHaveLength(3)
    expect(mockActivity.likes).toContain('user1')
    expect(res.json).toHaveBeenCalledWith({ liked: true, likesCount: 3 })
  })

  it('should handle toggling like multiple times', async () => {
    const mockActivity = {
      _id: 'activity1',
      likes: ['user1'] as string[],
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    // First call - unlike
    await likeActivity(req, res)
    expect(mockActivity.likes).toHaveLength(0)
    expect(res.json).toHaveBeenCalledWith({ liked: false, likesCount: 0 })

    // Second call - like again
    jest.clearAllMocks()
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)
    await likeActivity(req, res)
    expect(mockActivity.likes).toHaveLength(1)
    expect(res.json).toHaveBeenCalledWith({ liked: true, likesCount: 1 })
  })

  it('should handle database errors gracefully', async () => {
    ;(Activity.findById as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('should handle save errors gracefully', async () => {
    const mockActivity = {
      _id: 'activity1',
      likes: [] as string[],
      save: jest.fn().mockRejectedValue(new Error('Save error'))
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' })
    const res = makeRes()

    await likeActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})

// ---------------------------------------------------------------------------
// commentActivity - Requirement 9.6
// ---------------------------------------------------------------------------
describe('commentActivity', () => {
  it('should add comment to activity', async () => {
    const mockActivity = {
      _id: 'activity1',
      comments: [] as Array<{ userId: string; text: string; timestamp: Date }>,
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: 'Great job!' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(Activity.findById).toHaveBeenCalledWith('activity1')
    expect(mockActivity.comments).toHaveLength(1)
    expect(mockActivity.comments[0].userId).toBe('user1')
    expect(mockActivity.comments[0].text).toBe('Great job!')
    expect(mockActivity.comments[0].timestamp).toBeInstanceOf(Date)
    expect(mockActivity.save).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      comment: expect.objectContaining({
        userId: 'user1',
        text: 'Great job!',
        timestamp: expect.any(Date)
      }),
      commentsCount: 1
    })
  })

  it('should return 400 when activity ID is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, {}, { text: 'Comment' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Activity ID required' })
    expect(Activity.findById).not.toHaveBeenCalled()
  })

  it('should return 400 when comment text is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, {})
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Comment text required' })
    expect(Activity.findById).not.toHaveBeenCalled()
  })

  it('should return 400 when comment text is empty', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: '' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Comment text required' })
    expect(Activity.findById).not.toHaveBeenCalled()
  })

  it('should return 400 when comment text is only whitespace', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: '   ' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Comment text required' })
    expect(Activity.findById).not.toHaveBeenCalled()
  })

  it('should return 404 when activity does not exist', async () => {
    ;(Activity.findById as jest.Mock).mockResolvedValue(null)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'nonexistent' }, { text: 'Comment' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Activity not found' })
  })

  it('should trim whitespace from comment text', async () => {
    const mockActivity = {
      _id: 'activity1',
      comments: [] as Array<{ userId: string; text: string; timestamp: Date }>,
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: '  Great job!  ' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(mockActivity.comments[0].text).toBe('Great job!')
  })

  it('should handle multiple comments on same activity', async () => {
    const existingComment = {
      userId: 'user2',
      text: 'Nice!',
      timestamp: new Date('2024-01-01')
    }
    const mockActivity = {
      _id: 'activity1',
      comments: [existingComment] as Array<{ userId: string; text: string; timestamp: Date }>,
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: 'Great job!' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(mockActivity.comments).toHaveLength(2)
    expect(mockActivity.comments[0]).toBe(existingComment)
    expect(mockActivity.comments[1].userId).toBe('user1')
    expect(res.json).toHaveBeenCalledWith({
      comment: expect.objectContaining({
        userId: 'user1',
        text: 'Great job!'
      }),
      commentsCount: 2
    })
  })

  it('should handle database errors gracefully', async () => {
    ;(Activity.findById as jest.Mock).mockRejectedValue(new Error('DB error'))

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: 'Comment' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('should handle save errors gracefully', async () => {
    const mockActivity = {
      _id: 'activity1',
      comments: [] as Array<{ userId: string; text: string; timestamp: Date }>,
      save: jest.fn().mockRejectedValue(new Error('Save error'))
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: 'Comment' })
    const res = makeRes()

    await commentActivity(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('should preserve timestamp for each comment', async () => {
    const mockActivity = {
      _id: 'activity1',
      comments: [] as Array<{ userId: string; text: string; timestamp: Date }>,
      save: jest.fn().mockResolvedValue(true)
    }
    ;(Activity.findById as jest.Mock).mockResolvedValue(mockActivity)

    const beforeTime = new Date()
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'activity1' }, { text: 'Comment' })
    const res = makeRes()

    await commentActivity(req, res)
    const afterTime = new Date()

    const commentTimestamp = mockActivity.comments[0].timestamp
    expect(commentTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    expect(commentTimestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime())
  })
})

// ---------------------------------------------------------------------------
// getChallengeLeaderboard - Requirements 10.4, 10.5
// ---------------------------------------------------------------------------
import { getChallengeLeaderboard } from '../controllers/socialController'
import * as challengeManager from '../services/social/challengeManager'

jest.mock('../services/social/challengeManager')

describe('getChallengeLeaderboard', () => {
  it('should return leaderboard for a challenge', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: [
        { 
          userId: { _id: 'user1', name: 'Alice', email: 'alice@test.com' }, 
          progress: 15, 
          rank: 1 
        },
        { 
          userId: { _id: 'user2', name: 'Bob', email: 'bob@test.com' }, 
          progress: 10, 
          rank: 2 
        }
      ]
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    expect(challengeManager.getChallengeLeaderboard).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(mockChallenge.leaderboard)
  })
  
  it('should return 400 when challenge ID is missing', async () => {
    const req = makeAuthReq({ id: 'user1' }, {}, {})
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Challenge ID required' })
    expect(challengeManager.getChallengeLeaderboard).not.toHaveBeenCalled()
  })
  
  it('should return 404 when challenge not found', async () => {
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockRejectedValue(
      new Error('Challenge not found')
    )
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'nonexistent' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Challenge not found' })
  })
  
  it('should return empty leaderboard for challenge with no accepted participants', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: []
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    expect(res.json).toHaveBeenCalledWith([])
  })
  
  it('should return leaderboard sorted by rank', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: [
        { 
          userId: { _id: 'user1', name: 'Alice', email: 'alice@test.com' }, 
          progress: 20, 
          rank: 1 
        },
        { 
          userId: { _id: 'user2', name: 'Bob', email: 'bob@test.com' }, 
          progress: 15, 
          rank: 2 
        },
        { 
          userId: { _id: 'user3', name: 'Charlie', email: 'charlie@test.com' }, 
          progress: 10, 
          rank: 3 
        }
      ]
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    const leaderboard = (res.json as jest.Mock).mock.calls[0][0]
    expect(leaderboard).toHaveLength(3)
    expect(leaderboard[0].rank).toBe(1)
    expect(leaderboard[1].rank).toBe(2)
    expect(leaderboard[2].rank).toBe(3)
  })
  
  it('should include user information in leaderboard entries', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: [
        { 
          userId: { _id: 'user1', name: 'Alice', email: 'alice@test.com' }, 
          progress: 15, 
          rank: 1 
        }
      ]
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    const leaderboard = (res.json as jest.Mock).mock.calls[0][0]
    expect(leaderboard[0].userId).toHaveProperty('_id')
    expect(leaderboard[0].userId).toHaveProperty('name')
    expect(leaderboard[0].userId).toHaveProperty('email')
  })
  
  it('should handle database errors gracefully', async () => {
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockRejectedValue(
      new Error('Database error')
    )
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
  
  it('should handle single participant leaderboard', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: [
        { 
          userId: { _id: 'user1', name: 'Alice', email: 'alice@test.com' }, 
          progress: 5, 
          rank: 1 
        }
      ]
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    const leaderboard = (res.json as jest.Mock).mock.calls[0][0]
    expect(leaderboard).toHaveLength(1)
    expect(leaderboard[0].rank).toBe(1)
  })
  
  it('should handle leaderboard with participants at same progress level', async () => {
    const mockChallenge = {
      _id: 'challenge1',
      leaderboard: [
        { 
          userId: { _id: 'user1', name: 'Alice', email: 'alice@test.com' }, 
          progress: 10, 
          rank: 1 
        },
        { 
          userId: { _id: 'user2', name: 'Bob', email: 'bob@test.com' }, 
          progress: 10, 
          rank: 2 
        }
      ]
    }
    
    ;(challengeManager.getChallengeLeaderboard as jest.Mock).mockResolvedValue(mockChallenge)
    
    const req = makeAuthReq({ id: 'user1' }, {}, { id: 'challenge1' })
    const res = makeRes()
    
    await getChallengeLeaderboard(req, res)
    
    const leaderboard = (res.json as jest.Mock).mock.calls[0][0]
    expect(leaderboard).toHaveLength(2)
    expect(leaderboard[0].progress).toBe(10)
    expect(leaderboard[1].progress).toBe(10)
  })
})
