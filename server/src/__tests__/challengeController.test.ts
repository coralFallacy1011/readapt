import { Types } from 'mongoose'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import {
  getChallenges,
  createChallenge,
  respondToChallenge,
  leaveChallenge
} from '../controllers/socialController'
import * as challengeManager from '../services/social/challengeManager'

// Mock challenge manager
jest.mock('../services/social/challengeManager')

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

describe('Challenge Controller', () => {
  describe('getChallenges', () => {
    it('should return user challenges', async () => {
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Test Challenge', status: 'pending' }
      ]
      
      ;(challengeManager.getUserChallenges as jest.Mock).mockResolvedValue(mockChallenges)
      
      const req = makeAuthReq({ id: 'user1' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenges)
    })
    
    it('should filter by status', async () => {
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Active Challenge', status: 'active' }
      ]
      
      ;(challengeManager.getUserChallenges as jest.Mock).mockResolvedValue(mockChallenges)
      
      const req = makeAuthReq({ id: 'user1' }, { status: 'active' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(challengeManager.getUserChallenges).toHaveBeenCalledWith(
        expect.anything(),
        'active'
      )
      expect(res.json).toHaveBeenCalledWith(mockChallenges)
    })
    
    it('should return 400 for invalid status', async () => {
      const req = makeAuthReq({ id: 'user1' }, { status: 'invalid' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status parameter' })
    })
  })
  
  describe('createChallenge', () => {
    it('should create a challenge', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        name: 'Summer Reading',
        goalType: 'books',
        goalValue: 10,
        status: 'pending'
      }
      
      ;(challengeManager.createChallenge as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Summer Reading',
          description: 'Read 10 books this summer',
          goalType: 'books',
          goalValue: 10,
          duration: 90,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing fields', async () => {
      const req = makeAuthReq({ id: 'user1' }, {}, {}, { name: 'Test' })
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
    })
    
    it('should return 400 for invalid goal type', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'invalid',
          goalValue: 10,
          duration: 30,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid goal type' })
    })
    
    it('should return 400 for invalid goal value', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'books',
          goalValue: 0,
          duration: 30,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Goal value must be at least 1' })
    })
    
    it('should return 400 for empty participant list', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'books',
          goalValue: 10,
          duration: 30,
          participantIds: []
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'At least one participant is required' })
    })
  })
  
  describe('respondToChallenge', () => {
    it('should accept an invitation', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'accepted' }],
        status: 'active'
      }
      
      ;(challengeManager.respondToInvitation as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        { id: mockChallenge._id.toString() },
        { accept: true }
      )
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should decline an invitation', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'declined' }]
      }
      
      ;(challengeManager.respondToInvitation as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        { id: mockChallenge._id.toString() },
        { accept: false }
      )
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing accept parameter', async () => {
      const challengeId = new Types.ObjectId()
      const req = makeAuthReq({ id: 'user1' }, {}, { id: challengeId.toString() }, {})
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Accept parameter must be a boolean' })
    })
  })
  
  describe('leaveChallenge', () => {
    it('should allow user to leave challenge', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'left' }]
      }
      
      ;(challengeManager.leaveChallenge as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq({ id: 'user1' }, {}, { id: mockChallenge._id.toString() })
      const res = makeRes()
      
      await leaveChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing challenge ID', async () => {
      const req = makeAuthReq({ id: 'user1' }, {}, {})
      const res = makeRes()
      
      await leaveChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Challenge ID required' })
    })
  })
})


describe('Challenge Controller', () => {
  describe('getChallenges', () => {
    it('should return user challenges', async () => {
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Test Challenge', status: 'pending' }
      ]
      
      ;(challengeManager.getUserChallenges as jest.Mock).mockResolvedValue(mockChallenges)
      
      const req = makeAuthReq({ id: 'user1' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenges)
    })
    
    it('should filter by status', async () => {
      const mockChallenges = [
        { _id: new Types.ObjectId(), name: 'Active Challenge', status: 'active' }
      ]
      
      ;(challengeManager.getUserChallenges as jest.Mock).mockResolvedValue(mockChallenges)
      
      const req = makeAuthReq({ id: 'user1' }, { status: 'active' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(challengeManager.getUserChallenges).toHaveBeenCalledWith(
        expect.anything(),
        'active'
      )
      expect(res.json).toHaveBeenCalledWith(mockChallenges)
    })
    
    it('should return 400 for invalid status', async () => {
      const req = makeAuthReq({ id: 'user1' }, { status: 'invalid' })
      const res = makeRes()
      
      await getChallenges(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status parameter' })
    })
  })
  
  describe('createChallenge', () => {
    it('should create a challenge', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        name: 'Summer Reading',
        goalType: 'books',
        goalValue: 10,
        status: 'pending'
      }
      
      ;(challengeManager.createChallenge as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Summer Reading',
          description: 'Read 10 books this summer',
          goalType: 'books',
          goalValue: 10,
          duration: 90,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing fields', async () => {
      const req = makeAuthReq({ id: 'user1' }, {}, {}, { name: 'Test' })
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' })
    })
    
    it('should return 400 for invalid goal type', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'invalid',
          goalValue: 10,
          duration: 30,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid goal type' })
    })
    
    it('should return 400 for invalid goal value', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'books',
          goalValue: 0,
          duration: 30,
          participantIds: ['user2']
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Goal value must be at least 1' })
    })
    
    it('should return 400 for empty participant list', async () => {
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        {},
        {
          name: 'Test',
          description: 'Test',
          goalType: 'books',
          goalValue: 10,
          duration: 30,
          participantIds: []
        }
      )
      const res = makeRes()
      
      await createChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'At least one participant is required' })
    })
  })
  
  describe('respondToChallenge', () => {
    it('should accept an invitation', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'accepted' }],
        status: 'active'
      }
      
      ;(challengeManager.respondToInvitation as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        { id: mockChallenge._id.toString() },
        { accept: true }
      )
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should decline an invitation', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'declined' }]
      }
      
      ;(challengeManager.respondToInvitation as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq(
        { id: 'user1' },
        {},
        { id: mockChallenge._id.toString() },
        { accept: false }
      )
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing accept parameter', async () => {
      const challengeId = new Types.ObjectId()
      const req = makeAuthReq({ id: 'user1' }, {}, { id: challengeId.toString() }, {})
      const res = makeRes()
      
      await respondToChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Accept parameter must be a boolean' })
    })
  })
  
  describe('leaveChallenge', () => {
    it('should allow user to leave challenge', async () => {
      const mockChallenge = {
        _id: new Types.ObjectId(),
        participants: [{ userId: 'user1', status: 'left' }]
      }
      
      ;(challengeManager.leaveChallenge as jest.Mock).mockResolvedValue(mockChallenge)
      
      const req = makeAuthReq({ id: 'user1' }, {}, { id: mockChallenge._id.toString() })
      const res = makeRes()
      
      await leaveChallenge(req, res)
      
      expect(res.json).toHaveBeenCalledWith(mockChallenge)
    })
    
    it('should return 400 for missing challenge ID', async () => {
      const req = makeAuthReq({ id: 'user1' }, {}, {})
      const res = makeRes()
      
      await leaveChallenge(req, res)
      
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Challenge ID required' })
    })
  })
})
