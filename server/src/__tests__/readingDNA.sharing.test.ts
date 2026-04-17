import mongoose from 'mongoose'
import User from '../models/User'
import ReadingDNA from '../models/ReadingDNA'
import Follow from '../models/Follow'
import { generateShareableURL, getSharedProfile } from '../services/ml/readingDNA'

// Mock the models
jest.mock('../models/User')
jest.mock('../models/ReadingDNA')
jest.mock('../models/Follow')

describe('Reading DNA Profile Sharing - Task 6.6', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString()
  const mockViewerId = new mongoose.Types.ObjectId().toString()
  const mockFollowerId = new mongoose.Types.ObjectId().toString()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateShareableURL', () => {
    it('should generate a shareable URL for a user with Reading DNA profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        profileVisibility: 'public'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300,
        medianWPM: 295
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const url = await generateShareableURL(mockUserId)

      expect(url).toMatch(/^\/api\/ml\/reading-dna\/shared\/[A-Za-z0-9_-]+$/)
      expect(User.findById).toHaveBeenCalledWith(mockUserId)
      expect(ReadingDNA.findOne).toHaveBeenCalledWith({ userId: mockUserId })
    })

    it('should throw error if user does not exist', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      await expect(generateShareableURL(mockUserId)).rejects.toThrow('User not found')
    })

    it('should throw error if Reading DNA profile does not exist', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Test User',
        email: 'test@example.com'
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      await expect(generateShareableURL(mockUserId)).rejects.toThrow(
        'Reading DNA profile not found'
      )
    })

    it('should generate unique tokens for multiple calls', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Test User',
        email: 'test@example.com'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const url1 = await generateShareableURL(mockUserId)
      const url2 = await generateShareableURL(mockUserId)

      expect(url1).not.toBe(url2)
    })
  })

  describe('getSharedProfile - Public Visibility', () => {
    it('should allow anyone to view a public profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Public User',
        email: 'public@example.com',
        profileVisibility: 'public'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300,
        medianWPM: 295
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      // Anonymous viewer (no viewerId)
      const result = await getSharedProfile(token, null, false)

      expect(result.profile.userId.toString()).toBe(mockUserId)
      expect(result.profile.averageWPM).toBe(300)
      expect(result.user.name).toBe('Public User')
      expect(result.user.profileVisibility).toBe('public')
    })

    it('should anonymize username when requested for public profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Public User',
        email: 'public@example.com',
        profileVisibility: 'public'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      const result = await getSharedProfile(token, null, true)

      expect(result.user.name).toBe('Anonymous Reader')
    })
  })

  describe('getSharedProfile - Private Visibility', () => {
    it('should allow owner to view their own private profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Private User',
        email: 'private@example.com',
        profileVisibility: 'private'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      const result = await getSharedProfile(token, mockUserId, false)

      expect(result.profile.userId.toString()).toBe(mockUserId)
      expect(result.user.name).toBe('Private User')
    })

    it('should deny anonymous access to private profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Private User',
        email: 'private@example.com',
        profileVisibility: 'private'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      await expect(getSharedProfile(token, null, false)).rejects.toThrow(
        'This profile is private'
      )
    })

    it('should deny other users access to private profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Private User',
        email: 'private@example.com',
        profileVisibility: 'private'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      await expect(
        getSharedProfile(token, mockViewerId, false)
      ).rejects.toThrow('This profile is private')
    })
  })

  describe('getSharedProfile - Followers-Only Visibility', () => {
    it('should allow owner to view their own followers-only profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Followers Only User',
        email: 'followers@example.com',
        profileVisibility: 'followers-only'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      const result = await getSharedProfile(token, mockUserId, false)

      expect(result.profile.userId.toString()).toBe(mockUserId)
      expect(result.user.name).toBe('Followers Only User')
    })

    it('should allow followers to view followers-only profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Profile Owner',
        email: 'owner@example.com',
        profileVisibility: 'followers-only'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      const mockFollow = {
        followerId: mockFollowerId,
        followingId: mockUserId
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      });

      (Follow.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFollow)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      const result = await getSharedProfile(token, mockFollowerId, false)

      expect(result.profile.userId.toString()).toBe(mockUserId)
      expect(result.user.name).toBe('Profile Owner')
      expect(Follow.findOne).toHaveBeenCalledWith({
        followerId: mockFollowerId,
        followingId: mockUserId
      })
    })

    it('should deny anonymous access to followers-only profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Followers Only User',
        email: 'followers@example.com',
        profileVisibility: 'followers-only'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      await expect(getSharedProfile(token, null, false)).rejects.toThrow(
        'This profile is only visible to followers'
      )
    })

    it('should deny non-followers access to followers-only profile', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Profile Owner',
        email: 'owner@example.com',
        profileVisibility: 'followers-only'
      };

      const mockDNA = {
        userId: mockUserId,
        averageWPM: 300
      };

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDNA)
      });

      (Follow.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      const shareUrl = await generateShareableURL(mockUserId)
      const token = shareUrl.split('/').pop()!

      await expect(
        getSharedProfile(token, mockViewerId, false)
      ).rejects.toThrow('This profile is only visible to followers')
    })
  })

  describe('getSharedProfile - Error Handling', () => {
    it('should throw error for invalid share token', async () => {
      await expect(getSharedProfile('invalid-token', null, false)).rejects.toThrow(
        'Invalid share token'
      )
    })

    it('should throw error if user in token does not exist', async () => {
      const fakeToken = Buffer.from(
        JSON.stringify({ userId: mockUserId, token: 'abc', timestamp: Date.now() })
      ).toString('base64url');

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      await expect(getSharedProfile(fakeToken, null, false)).rejects.toThrow('User not found')
    })

    it('should throw error if Reading DNA profile does not exist', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Test User',
        profileVisibility: 'public'
      };

      const token = Buffer.from(
        JSON.stringify({ userId: mockUserId, token: 'abc', timestamp: Date.now() })
      ).toString('base64url');

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      })

      await expect(getSharedProfile(token, null, false)).rejects.toThrow(
        'Reading DNA profile not found'
      )
    })
  })

  describe('Privacy Control Integration', () => {
    it('should respect all three privacy levels correctly', async () => {
      const publicUserId = new mongoose.Types.ObjectId().toString()
      const privateUserId = new mongoose.Types.ObjectId().toString()
      const followersUserId = new mongoose.Types.ObjectId().toString()
      const viewerId = new mongoose.Types.ObjectId().toString()

      const mockPublicUser = {
        _id: publicUserId,
        name: 'Public User',
        profileVisibility: 'public'
      };

      const mockPrivateUser = {
        _id: privateUserId,
        name: 'Private User',
        profileVisibility: 'private'
      };

      const mockFollowersUser = {
        _id: followersUserId,
        name: 'Followers User',
        profileVisibility: 'followers-only'
      };

      const mockDNA = {
        averageWPM: 300
      };

      // Test public profile
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPublicUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockDNA, userId: publicUserId })
      })

      const publicUrl = await generateShareableURL(publicUserId)
      const publicToken = publicUrl.split('/').pop()!

      const publicResult = await getSharedProfile(publicToken, viewerId, false)
      expect(publicResult.user.name).toBe('Public User');

      // Test private profile
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockPrivateUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockDNA, userId: privateUserId })
      })

      const privateUrl = await generateShareableURL(privateUserId)
      const privateToken = privateUrl.split('/').pop()!

      await expect(
        getSharedProfile(privateToken, viewerId, false)
      ).rejects.toThrow('This profile is private');

      // Test followers-only profile with follower
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFollowersUser)
      });

      (ReadingDNA.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockDNA, userId: followersUserId })
      });

      (Follow.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ followerId: viewerId, followingId: followersUserId })
      })

      const followersUrl = await generateShareableURL(followersUserId)
      const followersToken = followersUrl.split('/').pop()!

      const followersResult = await getSharedProfile(followersToken, viewerId, false)
      expect(followersResult.user.name).toBe('Followers User')
    })
  })
})
