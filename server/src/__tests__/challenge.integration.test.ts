/**
 * Integration tests: Challenge complete flow
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.6
 *
 * Tests the complete flow:
 * challenge creation → invitations → acceptance → progress tracking
 * → leaderboard → completion → winner badges
 */

import { Types } from 'mongoose'
import {
  createChallenge,
  respondToInvitation,
  updateChallengeProgress,
  completeChallenge,
} from '../services/social/challengeManager'

jest.mock('../models/Challenge')
jest.mock('../models/User')
jest.mock('../utils/websocket')

import Challenge from '../models/Challenge'
import User from '../models/User'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeObjectId() {
  return new Types.ObjectId()
}

/** Build a minimal in-memory challenge document */
function makeChallenge(overrides: Record<string, unknown> = {}) {
  const challengeId = makeObjectId()
  const creatorId = makeObjectId()
  const participant1 = makeObjectId()
  const participant2 = makeObjectId()

  const challenge: any = {
    _id: challengeId,
    creatorId,
    name: 'Test Challenge',
    description: 'A test challenge',
    goalType: 'words',
    goalValue: 1000,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    duration: 7,
    status: 'pending',
    participants: [
      { userId: participant1, status: 'invited', progress: 0, joinedAt: new Date() },
      { userId: participant2, status: 'invited', progress: 0, joinedAt: new Date() },
    ],
    winners: [],
    leaderboard: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  }

  return { challenge, challengeId, creatorId, participant1, participant2 }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Challenge Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─── Flow 1: createChallenge ──────────────────────────────────────────────

  describe('Flow 1: createChallenge creates challenge with pending status and invited participants (Requirements 10.1, 10.2)', () => {
    it('creates a challenge with status "pending" and all participants as "invited"', async () => {
      const creatorId = makeObjectId()
      const p1 = makeObjectId()
      const p2 = makeObjectId()

      ;(User.find as jest.Mock).mockResolvedValue([{ _id: p1 }, { _id: p2 }])

      const createdChallenge = {
        _id: makeObjectId(),
        creatorId,
        name: 'Reading Sprint',
        status: 'pending',
        participants: [
          { userId: p1, status: 'invited', progress: 0 },
          { userId: p2, status: 'invited', progress: 0 },
        ],
        leaderboard: [],
      }
      ;(Challenge.create as jest.Mock).mockResolvedValue(createdChallenge)

      const result = await createChallenge(creatorId, 'Reading Sprint', 'Sprint!', 'words', 1000, 7, [p1, p2])

      expect(Challenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId,
          name: 'Reading Sprint',
          status: 'pending',
          participants: expect.arrayContaining([
            expect.objectContaining({ userId: p1, status: 'invited' }),
            expect.objectContaining({ userId: p2, status: 'invited' }),
          ]),
        })
      )
      expect(result.status).toBe('pending')
    })

    it('throws when name is empty', async () => {
      await expect(
        createChallenge(makeObjectId(), '', 'desc', 'words', 1000, 7, [makeObjectId()])
      ).rejects.toThrow('Challenge name is required')
    })

    it('throws when goalValue < 1', async () => {
      await expect(
        createChallenge(makeObjectId(), 'Name', 'desc', 'words', 0, 7, [makeObjectId()])
      ).rejects.toThrow('Goal value must be at least 1')
    })

    it('throws when no participants provided', async () => {
      await expect(
        createChallenge(makeObjectId(), 'Name', 'desc', 'words', 1000, 7, [])
      ).rejects.toThrow('At least one participant is required')
    })

    it('throws when a participant does not exist', async () => {
      ;(User.find as jest.Mock).mockResolvedValue([]) // no users found

      await expect(
        createChallenge(makeObjectId(), 'Name', 'desc', 'words', 1000, 7, [makeObjectId()])
      ).rejects.toThrow('One or more participants not found')
    })
  })

  // ─── Flow 2: respondToInvitation — accept ────────────────────────────────

  describe('Flow 2: respondToInvitation — accept sets participant to "accepted" and challenge to "active" (Requirement 10.2)', () => {
    it('sets participant status to "accepted" and challenge status to "active" on first acceptance', async () => {
      const { challenge, challengeId, participant1 } = makeChallenge()

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      const result = await respondToInvitation(challengeId, participant1, true)

      const p = result.participants.find(
        (p: any) => p.userId.toString() === participant1.toString()
      )!
      expect(p.status).toBe('accepted')
      expect(result.status).toBe('active')
      expect(challenge.save).toHaveBeenCalled()
    })

    it('throws when challenge is not found', async () => {
      ;(Challenge.findById as jest.Mock).mockResolvedValue(null)

      await expect(
        respondToInvitation(makeObjectId(), makeObjectId(), true)
      ).rejects.toThrow('Challenge not found')
    })

    it('throws when user is not invited to the challenge', async () => {
      const { challenge, challengeId } = makeChallenge()
      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      await expect(
        respondToInvitation(challengeId, makeObjectId(), true)
      ).rejects.toThrow('User is not invited to this challenge')
    })
  })

  // ─── Flow 3: respondToInvitation — decline ───────────────────────────────

  describe('Flow 3: respondToInvitation — decline sets participant to "declined"', () => {
    it('sets participant status to "declined" when user declines', async () => {
      const { challenge, challengeId, participant1 } = makeChallenge()

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      const result = await respondToInvitation(challengeId, participant1, false)

      const p = result.participants.find(
        (p: any) => p.userId.toString() === participant1.toString()
      )!
      expect(p.status).toBe('declined')
      expect(challenge.save).toHaveBeenCalled()
    })

    it('does not activate challenge when participant declines', async () => {
      const { challenge, challengeId, participant1 } = makeChallenge()

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      const result = await respondToInvitation(challengeId, participant1, false)

      expect(result.status).toBe('pending')
    })
  })

  // ─── Flow 4: updateChallengeProgress ─────────────────────────────────────

  describe('Flow 4: updateChallengeProgress updates participant progress and rebuilds leaderboard (Requirement 10.4)', () => {
    it('updates participant progress to the new value', async () => {
      const { challenge, challengeId, participant1 } = makeChallenge({
        status: 'active',
        participants: [
          { userId: makeObjectId(), status: 'accepted', progress: 0, joinedAt: new Date() },
        ],
      })

      // Use a fresh participant id that matches the challenge
      const p1Id = challenge.participants[0].userId
      challenge.participants[0].status = 'accepted'

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      const result = await updateChallengeProgress(challengeId, p1Id, 500)

      const p = result.participants.find(
        (p: any) => p.userId.toString() === p1Id.toString()
      )!
      expect(p.progress).toBe(500)
      expect(challenge.save).toHaveBeenCalled()
    })

    it('throws when challenge is not active', async () => {
      const { challenge, challengeId, participant1 } = makeChallenge({ status: 'pending' })

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      await expect(
        updateChallengeProgress(challengeId, participant1, 100)
      ).rejects.toThrow('Challenge is not active')
    })
  })

  // ─── Flow 5: Leaderboard sorted by progress descending ───────────────────

  describe('Flow 5: Leaderboard is sorted by progress descending with consecutive ranks (Requirement 10.5)', () => {
    it('rebuilds leaderboard sorted by progress descending after progress update', async () => {
      const p1 = makeObjectId()
      const p2 = makeObjectId()
      const p3 = makeObjectId()
      const challengeId = makeObjectId()

      const challenge: any = {
        _id: challengeId,
        status: 'active',
        goalValue: 1000,
        participants: [
          { userId: p1, status: 'accepted', progress: 300, joinedAt: new Date() },
          { userId: p2, status: 'accepted', progress: 700, joinedAt: new Date() },
          { userId: p3, status: 'accepted', progress: 500, joinedAt: new Date() },
        ],
        leaderboard: [],
        save: jest.fn().mockResolvedValue(true),
      }

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      // Update p1 to 800 — should become rank 1
      const result = await updateChallengeProgress(challengeId, p1, 800)

      // Leaderboard should be sorted: p1(800) > p2(700) > p3(500)
      expect(result.leaderboard[0].userId.toString()).toBe(p1.toString())
      expect(result.leaderboard[0].rank).toBe(1)
      expect(result.leaderboard[1].rank).toBe(2)
      expect(result.leaderboard[2].rank).toBe(3)

      // Verify descending order
      const progresses = result.leaderboard.map((e: any) => e.progress)
      for (let i = 0; i < progresses.length - 1; i++) {
        expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i + 1])
      }
    })
  })

  // ─── Flow 6: completeChallenge ────────────────────────────────────────────

  describe('Flow 6: completeChallenge sets status to "completed", determines top 3 winners, awards badges (Requirement 10.6)', () => {
    it('sets challenge status to "completed"', async () => {
      const p1 = makeObjectId()
      const challengeId = makeObjectId()

      const challenge: any = {
        _id: challengeId,
        status: 'active',
        goalValue: 1000,
        participants: [
          { userId: p1, status: 'accepted', progress: 1200, joinedAt: new Date() },
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true),
      }

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)
      ;(User.updateOne as jest.Mock).mockResolvedValue({})

      const result = await completeChallenge(challengeId)

      expect(result.status).toBe('completed')
      expect(challenge.save).toHaveBeenCalled()
    })

    it('only includes participants who reached goalValue as winners', async () => {
      const p1 = makeObjectId()
      const p2 = makeObjectId()
      const p3 = makeObjectId()
      const challengeId = makeObjectId()

      const challenge: any = {
        _id: challengeId,
        status: 'active',
        goalValue: 1000,
        participants: [
          { userId: p1, status: 'accepted', progress: 1500, joinedAt: new Date() },
          { userId: p2, status: 'accepted', progress: 1200, joinedAt: new Date() },
          { userId: p3, status: 'accepted', progress: 400, joinedAt: new Date() }, // did not reach goal
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true),
      }

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)
      ;(User.updateOne as jest.Mock).mockResolvedValue({})

      const result = await completeChallenge(challengeId)

      // p3 did not reach goalValue, so only p1 and p2 are winners
      expect(result.winners).toHaveLength(2)
      const winnerStrings = result.winners!.map((w: Types.ObjectId) => w.toString())
      expect(winnerStrings).toContain(p1.toString())
      expect(winnerStrings).toContain(p2.toString())
      expect(winnerStrings).not.toContain(p3.toString())
    })

    it('awards challenge_winner_1st badge to the top participant', async () => {
      const p1 = makeObjectId()
      const p2 = makeObjectId()
      const challengeId = makeObjectId()

      const challenge: any = {
        _id: challengeId,
        status: 'active',
        goalValue: 1000,
        participants: [
          { userId: p1, status: 'accepted', progress: 1500, joinedAt: new Date() },
          { userId: p2, status: 'accepted', progress: 1200, joinedAt: new Date() },
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true),
      }

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)
      ;(User.updateOne as jest.Mock).mockResolvedValue({})

      await completeChallenge(challengeId)

      // First winner gets challenge_winner_1st badge
      expect(User.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ badges: { $ne: 'challenge_winner_1st' } }),
        { $push: { badges: 'challenge_winner_1st' } }
      )
    })

    it('awards up to 3 winner badges (1st, 2nd, 3rd)', async () => {
      const p1 = makeObjectId()
      const p2 = makeObjectId()
      const p3 = makeObjectId()
      const p4 = makeObjectId()
      const challengeId = makeObjectId()

      const challenge: any = {
        _id: challengeId,
        status: 'active',
        goalValue: 1000,
        participants: [
          { userId: p1, status: 'accepted', progress: 2000, joinedAt: new Date() },
          { userId: p2, status: 'accepted', progress: 1800, joinedAt: new Date() },
          { userId: p3, status: 'accepted', progress: 1500, joinedAt: new Date() },
          { userId: p4, status: 'accepted', progress: 1200, joinedAt: new Date() },
        ],
        leaderboard: [],
        winners: [],
        save: jest.fn().mockResolvedValue(true),
      }

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)
      ;(User.updateOne as jest.Mock).mockResolvedValue({})

      await completeChallenge(challengeId)

      // Only top 3 get badges
      expect(User.updateOne).toHaveBeenCalledTimes(3)

      const badgeArgs = (User.updateOne as jest.Mock).mock.calls.map(
        (call: any[]) => call[1].$push.badges
      )
      expect(badgeArgs).toContain('challenge_winner_1st')
      expect(badgeArgs).toContain('challenge_winner_2nd')
      expect(badgeArgs).toContain('challenge_winner_3rd')
    })

    it('throws when challenge is not active', async () => {
      const { challenge, challengeId } = makeChallenge({ status: 'completed' })

      ;(Challenge.findById as jest.Mock).mockResolvedValue(challenge)

      await expect(completeChallenge(challengeId)).rejects.toThrow('Challenge is not active')
    })
  })
})
