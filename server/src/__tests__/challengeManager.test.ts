import mongoose, { Types } from 'mongoose'
import Challenge from '../models/Challenge'
import User from '../models/User'
import {
  createChallenge,
  respondToInvitation,
  leaveChallenge,
  getUserChallenges,
  updateChallengeProgress,
  completeChallenge,
  getChallengeLeaderboard
} from '../services/social/challengeManager'

// Mock mongoose models
jest.mock('../models/Challenge')
jest.mock('../models/User')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Challenge Manager', () => {
  describe('createChallenge', () => {
    it('should create a challenge with valid inputs', async () => {
      const creatorId = new Types.ObjectId()
      const p1Id = new Types.ObjectId()
      const p2Id = new Types.ObjectId()
      
      const mockUsers = [
        { _id: p1Id, name: 'P1', email: 'p1@test.com' },
        { _id: p2Id, name: 'P2', email: 'p2@test.com' }
      ]
      ;(User.find as jest.Mock).mockResolvedValue(mockUsers)
      
      const mockChallenge = {
        _id: new Types.ObjectId(),
        creatorId,
        name: 'Read 10 Books',
        description: 'Summer reading challenge',
        goalType: 'books',
        goalValue: 10,
        duration: 30,
        status: 'pending',
        participants: [
          { userId: p1Id, status: 'invited', progress: 0 },
          { userId: p2Id, status: 'invited', progress: 0 }
        ],
        leaderboard: []
      }
      ;(Challenge.create as jest.Mock).mockResolvedValue(mockChallenge)
      
      const challenge = await createChallenge(
        creatorId,
        'Read 10 Books',
        'Summer reading challenge',
        'books',
        10,
        30,
        [p1Id, p2Id]
      )
      
      expect(challenge).toBeDefined()
      expect(challenge.name).toBe('Read 10 Books')
      expect(challenge.description).toBe('Summer reading challenge')
      expect(challenge.goalType).toBe('books')
      expect(challenge.goalValue).toBe(10)
      expect(challenge.duration).toBe(30)
      expect(challenge.status).toBe('pending')
      expect(challenge.participants).toHaveLength(2)
    })
    
    it('should throw error if name is empty', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, '', 'desc', 'books', 10, 30, [participantId])
      ).rejects.toThrow('Challenge name is required')
    })
    
    it('should throw error if goal value is less than 1', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 0, 30, [participantId])
      ).rejects.toThrow('Goal value must be at least 1')
    })
    
    it('should throw error if duration is less than 1', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 0, [participantId])
      ).rejects.toThrow('Duration must be at least 1 day')
    })
    
    it('should throw error if no participants provided', async () => {
      const creatorId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 30, [])
      ).rejects.toThrow('At least one participant is required')
    })
    
    it('should throw error if participant does not exist', async () => {
      const creatorId = new Types.ObjectId()
      const nonExistentId = new Types.ObjectId()
      
      ;(User.find as jest.Mock).mockResolvedValue([])
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 30, [nonExistentId])
      ).rejects.toThrow('One or more participants not found')
    })
    
    it('should trim whitespace from name and description', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockUsers = [{ _id: participantId, name: 'P', email: 'p@test.com' }]
      ;(User.find as jest.Mock).mockResolvedValue(mockUsers)
      
      const mockChallenge = {
        _id: new Types.ObjectId(),
        creatorId,
        name: 'Test Challenge',
        description: 'Test Description',
        goalType: 'books',
        goalValue: 10,
        duration: 30,
        status: 'pending',
        participants: [{ userId: participantId, status: 'invited', progress: 0 }],
        leaderboard: []
      }
      ;(Challenge.create as jest.Mock).mockResolvedValue(mockChallenge)
      
      const challenge = await createChallenge(
        creatorId,
        '  Test Challenge  ',
        '  Test Description  ',
        'books',
        10,
        30,
        [participantId]
      )
      
      expect(challenge.name).toBe('Test Challenge')
      expect(challenge.description).toBe('Test Description')
    })
  })
  
  describe('respondToInvitation', () => {
    it('should accept an invitation', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0, joinedAt: new Date() }
        ],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const updated = await respondToInvitation(challengeId, participantId, true)
      
      expect(updated.participants[0].status).toBe('accepted')
      expect(updated.status).toBe('active')
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should decline an invitation', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0, joinedAt: new Date() }
        ],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const updated = await respondToInvitation(challengeId, participantId, false)
      
      expect(updated.participants[0].status).toBe('declined')
      expect(updated.status).toBe('pending')
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not found', async () => {
      const nonExistentId = new Types.ObjectId()
      const userId = new Types.ObjectId()
      
      ;(Challenge.findById as jest.Mock).mockResolvedValue(null)
      
      await expect(
        respondToInvitation(nonExistentId, userId, true)
      ).rejects.toThrow('Challenge not found')
    })
    
    it('should throw error if user not invited', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      const randomUserId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        respondToInvitation(challengeId, randomUserId, true)
      ).rejects.toThrow('User is not invited to this challenge')
    })
    
    it('should throw error if already responded', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'accepted', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        respondToInvitation(challengeId, participantId, true)
      ).rejects.toThrow('Invitation already responded to')
    })
  })
  
  describe('leaveChallenge', () => {
    it('should allow user to leave an accepted challenge', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'accepted', progress: 5 }
        ],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const updated = await leaveChallenge(challengeId, participantId)
      
      expect(updated.participants[0].status).toBe('left')
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not found', async () => {
      const nonExistentId = new Types.ObjectId()
      const userId = new Types.ObjectId()
      
      ;(Challenge.findById as jest.Mock).mockResolvedValue(null)
      
      await expect(
        leaveChallenge(nonExistentId, userId)
      ).rejects.toThrow('Challenge not found')
    })
    
    it('should throw error if user not a participant', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      const randomUserId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'accepted', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        leaveChallenge(challengeId, randomUserId)
      ).rejects.toThrow('User is not a participant in this challenge')
    })
    
    it('should throw error if already left', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'left', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        leaveChallenge(challengeId, participantId)
      ).rejects.toThrow('User has already left this challenge')
    })
    
    it('should throw error if trying to leave without accepting', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        leaveChallenge(challengeId, participantId)
      ).rejects.toThrow('Cannot leave a challenge you have not accepted')
    })
  })
  
  describe('getUserChallenges', () => {
    it('should return challenges created by user', async () => {
      const creatorId = new Types.ObjectId()
      
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Test 1', creatorId },
        { _id: new Types.ObjectId(), name: 'Test 2', creatorId }
      ]
      
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockChallenges)
      })
      ;(Challenge.find as jest.Mock) = mockFind
      
      const challenges = await getUserChallenges(creatorId)
      
      expect(challenges).toHaveLength(2)
    })
    
    it('should filter by status', async () => {
      const userId = new Types.ObjectId()
      
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Active', status: 'active' }
      ]
      
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockChallenges)
      })
      ;(Challenge.find as jest.Mock) = mockFind
      
      const challenges = await getUserChallenges(userId, 'active')
      
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      )
    })
  })
  
  describe('updateChallengeProgress', () => {
    it('should update participant progress', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'accepted', progress: 0 }
        ],
        leaderboard: [],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const updated = await updateChallengeProgress(challengeId, participantId, 5)
      
      expect(updated.participants[0].progress).toBe(5)
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not active', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        updateChallengeProgress(challengeId, participantId, 5)
      ).rejects.toThrow('Challenge is not active')
    })
    
    it('should throw error if user has not accepted', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        updateChallengeProgress(challengeId, participantId, 5)
      ).rejects.toThrow('User has not accepted this challenge')
    })
  })
  
  describe('completeChallenge', () => {
    it('should complete challenge and determine winners', async () => {
      const challengeId = new Types.ObjectId()
      const p1Id = new Types.ObjectId()
      const p2Id = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        goalValue: 10,
        participants: [
          { userId: p1Id, status: 'accepted', progress: 12 },
          { userId: p2Id, status: 'accepted', progress: 8 }
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const completed = await completeChallenge(challengeId)
      
      expect(completed.status).toBe('completed')
      expect(completed.winners).toHaveLength(1)
      expect(completed.winners![0].toString()).toBe(p1Id.toString())
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not active', async () => {
      const challengeId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: []
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        completeChallenge(challengeId)
      ).rejects.toThrow('Challenge is not active')
    })
  })
})


describe('Challenge Manager', () => {
  describe('createChallenge', () => {
    it('should create a challenge with valid inputs', async () => {
      // Create test users
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant1 = await User.create({
        name: 'Participant 1',
        email: 'p1@test.com',
        passwordHash: 'hash'
      })
      
      const participant2 = await User.create({
        name: 'Participant 2',
        email: 'p2@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Read 10 Books',
        'Summer reading challenge',
        'books',
        10,
        30,
        [participant1._id as Types.ObjectId, participant2._id as Types.ObjectId]
      )
      
      expect(challenge).toBeDefined()
      expect(challenge.name).toBe('Read 10 Books')
      expect(challenge.description).toBe('Summer reading challenge')
      expect(challenge.goalType).toBe('books')
      expect(challenge.goalValue).toBe(10)
      expect(challenge.duration).toBe(30)
      expect(challenge.status).toBe('pending')
      expect(challenge.participants).toHaveLength(2)
      expect(challenge.participants[0].status).toBe('invited')
      expect(challenge.participants[1].status).toBe('invited')
    })
    
    it('should throw error if name is empty', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, '', 'desc', 'books', 10, 30, [participantId])
      ).rejects.toThrow('Challenge name is required')
    })
    
    it('should throw error if goal value is less than 1', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 0, 30, [participantId])
      ).rejects.toThrow('Goal value must be at least 1')
    })
    
    it('should throw error if duration is less than 1', async () => {
      const creatorId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 0, [participantId])
      ).rejects.toThrow('Duration must be at least 1 day')
    })
    
    it('should throw error if no participants provided', async () => {
      const creatorId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 30, [])
      ).rejects.toThrow('At least one participant is required')
    })
    
    it('should throw error if participant does not exist', async () => {
      const creatorId = new Types.ObjectId()
      const nonExistentId = new Types.ObjectId()
      
      await expect(
        createChallenge(creatorId, 'Test', 'desc', 'books', 10, 30, [nonExistentId])
      ).rejects.toThrow('One or more participants not found')
    })
    
    it('should trim whitespace from name and description', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        '  Test Challenge  ',
        '  Test Description  ',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      expect(challenge.name).toBe('Test Challenge')
      expect(challenge.description).toBe('Test Description')
    })
  })
  
  describe('respondToInvitation', () => {
    it('should accept an invitation', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      const updated = await respondToInvitation(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId,
        true
      )
      
      expect(updated.participants[0].status).toBe('accepted')
      expect(updated.status).toBe('active')
    })
    
    it('should decline an invitation', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      const updated = await respondToInvitation(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId,
        false
      )
      
      expect(updated.participants[0].status).toBe('declined')
      expect(updated.status).toBe('pending')
    })
    
    it('should activate challenge on first acceptance', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const p1 = await User.create({
        name: 'P1',
        email: 'p1@test.com',
        passwordHash: 'hash'
      })
      
      const p2 = await User.create({
        name: 'P2',
        email: 'p2@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [p1._id as Types.ObjectId, p2._id as Types.ObjectId]
      )
      
      expect(challenge.status).toBe('pending')
      
      const updated = await respondToInvitation(
        challenge._id as Types.ObjectId,
        p1._id as Types.ObjectId,
        true
      )
      
      expect(updated.status).toBe('active')
    })
    
    it('should throw error if challenge not found', async () => {
      const nonExistentId = new Types.ObjectId()
      const userId = new Types.ObjectId()
      
      await expect(
        respondToInvitation(nonExistentId, userId, true)
      ).rejects.toThrow('Challenge not found')
    })
    
    it('should throw error if user not invited', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      const randomUserId = new Types.ObjectId()
      
      await expect(
        respondToInvitation(challenge._id as Types.ObjectId, randomUserId, true)
      ).rejects.toThrow('User is not invited to this challenge')
    })
    
    it('should throw error if already responded', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      await respondToInvitation(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId,
        true
      )
      
      await expect(
        respondToInvitation(
          challenge._id as Types.ObjectId,
          participant._id as Types.ObjectId,
          true
        )
      ).rejects.toThrow('Invitation already responded to')
    })
  })
  
  describe('leaveChallenge', () => {
    it('should allow user to leave an accepted challenge', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      await respondToInvitation(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId,
        true
      )
      
      const updated = await leaveChallenge(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId
      )
      
      expect(updated.participants[0].status).toBe('left')
    })
    
    it('should throw error if challenge not found', async () => {
      const nonExistentId = new Types.ObjectId()
      const userId = new Types.ObjectId()
      
      await expect(
        leaveChallenge(nonExistentId, userId)
      ).rejects.toThrow('Challenge not found')
    })
    
    it('should throw error if user not a participant', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      const randomUserId = new Types.ObjectId()
      
      await expect(
        leaveChallenge(challenge._id as Types.ObjectId, randomUserId)
      ).rejects.toThrow('User is not a participant in this challenge')
    })
    
    it('should throw error if already left', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      await respondToInvitation(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId,
        true
      )
      
      await leaveChallenge(
        challenge._id as Types.ObjectId,
        participant._id as Types.ObjectId
      )
      
      await expect(
        leaveChallenge(challenge._id as Types.ObjectId, participant._id as Types.ObjectId)
      ).rejects.toThrow('User has already left this challenge')
    })
    
    it('should throw error if trying to leave without accepting', async () => {
      const creator = await User.create({
        name: 'Creator',
        email: 'creator@test.com',
        passwordHash: 'hash'
      })
      
      const participant = await User.create({
        name: 'Participant',
        email: 'p@test.com',
        passwordHash: 'hash'
      })
      
      const challenge = await createChallenge(
        creator._id as Types.ObjectId,
        'Test',
        'desc',
        'books',
        10,
        30,
        [participant._id as Types.ObjectId]
      )
      
      await expect(
        leaveChallenge(challenge._id as Types.ObjectId, participant._id as Types.ObjectId)
      ).rejects.toThrow('Cannot leave a challenge you have not accepted')
    })
  })
  
  describe('getUserChallenges', () => {
    it('should return challenges created by user', async () => {
      const creatorId = new Types.ObjectId()
      
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Test 1', creatorId },
        { _id: new Types.ObjectId(), name: 'Test 2', creatorId }
      ]
      
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockChallenges)
      })
      ;(Challenge.find as jest.Mock) = mockFind
      
      const challenges = await getUserChallenges(creatorId)
      
      expect(challenges).toHaveLength(2)
    })
    
    it('should filter by status', async () => {
      const userId = new Types.ObjectId()
      
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Active', status: 'active' }
      ]
      
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockChallenges)
      })
      ;(Challenge.find as jest.Mock) = mockFind
      
      const challenges = await getUserChallenges(userId, 'active')
      
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      )
    })
  })
  
  describe('updateChallengeProgress', () => {
    it('should update participant progress', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'accepted', progress: 0 }
        ],
        leaderboard: [],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const updated = await updateChallengeProgress(challengeId, participantId, 5)
      
      expect(updated.participants[0].progress).toBe(5)
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not active', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        updateChallengeProgress(challengeId, participantId, 5)
      ).rejects.toThrow('Challenge is not active')
    })
    
    it('should throw error if user has not accepted', async () => {
      const challengeId = new Types.ObjectId()
      const participantId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        participants: [
          { userId: participantId, status: 'invited', progress: 0 }
        ]
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        updateChallengeProgress(challengeId, participantId, 5)
      ).rejects.toThrow('User has not accepted this challenge')
    })
  })
  
  describe('completeChallenge', () => {
    it('should complete challenge and determine winners', async () => {
      const challengeId = new Types.ObjectId()
      const p1Id = new Types.ObjectId()
      const p2Id = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'active',
        goalValue: 10,
        participants: [
          { userId: p1Id, status: 'accepted', progress: 12 },
          { userId: p2Id, status: 'accepted', progress: 8 }
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true)
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      const completed = await completeChallenge(challengeId)
      
      expect(completed.status).toBe('completed')
      expect(completed.winners).toHaveLength(1)
      expect(completed.winners![0].toString()).toBe(p1Id.toString())
      expect(mockChallenge.save).toHaveBeenCalled()
    })
    
    it('should throw error if challenge not active', async () => {
      const challengeId = new Types.ObjectId()
      
      const mockChallenge = {
        _id: challengeId,
        status: 'pending',
        participants: []
      }
      ;(Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge)
      
      await expect(
        completeChallenge(challengeId)
      ).rejects.toThrow('Challenge is not active')
    })
  })
})

describe('getChallengeLeaderboard', () => {
  it('should return challenge with populated leaderboard', async () => {
    const challengeId = new Types.ObjectId()
    const p1Id = new Types.ObjectId()
    const p2Id = new Types.ObjectId()
    
    const mockChallenge = {
      _id: challengeId,
      status: 'active',
      leaderboard: [
        { userId: p1Id, progress: 10, rank: 1 },
        { userId: p2Id, progress: 5, rank: 2 }
      ]
    }
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockChallenge)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    const result = await getChallengeLeaderboard(challengeId)
    
    expect(result).toBeDefined()
    expect(result.leaderboard).toHaveLength(2)
    expect(mockFind).toHaveBeenCalledWith(challengeId)
  })
  
  it('should throw error if challenge not found', async () => {
    const nonExistentId = new Types.ObjectId()
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    await expect(
      getChallengeLeaderboard(nonExistentId)
    ).rejects.toThrow('Challenge not found')
  })
  
  it('should populate user information in leaderboard', async () => {
    const challengeId = new Types.ObjectId()
    const p1Id = new Types.ObjectId()
    
    const mockChallenge = {
      _id: challengeId,
      status: 'active',
      leaderboard: [
        { 
          userId: { _id: p1Id, name: 'User 1', email: 'user1@test.com' }, 
          progress: 10, 
          rank: 1 
        }
      ]
    }
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockChallenge)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    const result = await getChallengeLeaderboard(challengeId)
    
    expect(result.leaderboard[0].userId).toHaveProperty('name')
    expect(result.leaderboard[0].userId).toHaveProperty('email')
  })
  
  it('should return empty leaderboard if no participants accepted', async () => {
    const challengeId = new Types.ObjectId()
    
    const mockChallenge = {
      _id: challengeId,
      status: 'pending',
      leaderboard: []
    }
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockChallenge)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    const result = await getChallengeLeaderboard(challengeId)
    
    expect(result.leaderboard).toHaveLength(0)
  })
  
  it('should only include accepted participants in leaderboard', async () => {
    const challengeId = new Types.ObjectId()
    const p1Id = new Types.ObjectId()
    const p2Id = new Types.ObjectId()
    const p3Id = new Types.ObjectId()
    
    const mockChallenge = {
      _id: challengeId,
      status: 'active',
      participants: [
        { userId: p1Id, status: 'accepted', progress: 10 },
        { userId: p2Id, status: 'invited', progress: 0 },
        { userId: p3Id, status: 'declined', progress: 0 }
      ],
      leaderboard: [
        { userId: p1Id, progress: 10, rank: 1 }
      ]
    }
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockChallenge)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    const result = await getChallengeLeaderboard(challengeId)
    
    expect(result.leaderboard).toHaveLength(1)
    expect(result.leaderboard[0].userId.toString()).toBe(p1Id.toString())
  })
  
  it('should sort leaderboard by progress descending', async () => {
    const challengeId = new Types.ObjectId()
    const p1Id = new Types.ObjectId()
    const p2Id = new Types.ObjectId()
    const p3Id = new Types.ObjectId()
    
    const mockChallenge = {
      _id: challengeId,
      status: 'active',
      leaderboard: [
        { userId: p1Id, progress: 15, rank: 1 },
        { userId: p2Id, progress: 10, rank: 2 },
        { userId: p3Id, progress: 5, rank: 3 }
      ]
    }
    
    const mockFind = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockChallenge)
    })
    ;(Challenge.findById as jest.Mock) = mockFind
    
    const result = await getChallengeLeaderboard(challengeId)
    
    expect(result.leaderboard[0].progress).toBe(15)
    expect(result.leaderboard[0].rank).toBe(1)
    expect(result.leaderboard[1].progress).toBe(10)
    expect(result.leaderboard[1].rank).toBe(2)
    expect(result.leaderboard[2].progress).toBe(5)
    expect(result.leaderboard[2].rank).toBe(3)
  })
})
