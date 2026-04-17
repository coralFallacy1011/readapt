/**
 * Integration tests: Gamification complete flow
 * Requirements: 6.1, 6.2, 6.6
 *
 * Tests the complete flow: reading session → streak update → milestone badge → activity creation
 */

import { updateStreak, checkStreakMilestones } from '../services/gamification/streakManager'
import { updateGoalProgress } from '../services/gamification/goalTracker'
import User from '../models/User'
import Activity from '../models/Activity'
import Goal from '../models/Goal'
import { Types } from 'mongoose'
import { IReadingSession } from '../models/ReadingSession'

jest.mock('../models/User')
jest.mock('../models/Activity')
jest.mock('../models/Goal')

describe('Gamification Integration', () => {
  const userId = new Types.ObjectId()
  const bookId = new Types.ObjectId()

  let mockUser: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockUser = {
      _id: userId,
      timezone: 'UTC',
      currentStreak: 0,
      longestStreak: 0,
      lastReadDate: '',
      badges: [],
      activitySharingEnabled: false,
      save: jest.fn().mockResolvedValue(true),
    }

    ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
    ;(Activity.create as jest.Mock).mockResolvedValue({})
  })

  // ─── Streak flows ────────────────────────────────────────────────────────────

  describe('Flow 1: first reading session → streak becomes 1', () => {
    it('initialises streak to 1 on first ever session', async () => {
      mockUser.lastReadDate = ''

      await updateStreak(userId, new Date('2024-03-01T12:00:00Z'))

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(1)
      expect(mockUser.lastReadDate).toBe('2024-03-01')
      expect(mockUser.save).toHaveBeenCalled()
    })
  })

  describe('Flow 2: consecutive day reading → streak increments', () => {
    it('increments streak when reading on the next calendar day', async () => {
      mockUser.currentStreak = 3
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-03-01'

      await updateStreak(userId, new Date('2024-03-02T12:00:00Z'))

      expect(mockUser.currentStreak).toBe(4)
      expect(mockUser.lastReadDate).toBe('2024-03-02')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('updates longestStreak when current streak surpasses it', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-03-01'

      await updateStreak(userId, new Date('2024-03-02T12:00:00Z'))

      expect(mockUser.currentStreak).toBe(6)
      expect(mockUser.longestStreak).toBe(6)
    })

    it('does not change streak when reading again on the same day', async () => {
      mockUser.currentStreak = 4
      mockUser.lastReadDate = '2024-03-01'

      await updateStreak(userId, new Date('2024-03-01T20:00:00Z'))

      expect(mockUser.currentStreak).toBe(4)
      expect(mockUser.save).not.toHaveBeenCalled()
    })
  })

  describe('Flow 3: missed day → streak resets to 1', () => {
    it('resets streak to 1 when one day is skipped', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-03-01'

      await updateStreak(userId, new Date('2024-03-03T12:00:00Z'))

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(10) // preserved
      expect(mockUser.lastReadDate).toBe('2024-03-03')
    })

    it('resets streak to 1 when multiple days are skipped', async () => {
      mockUser.currentStreak = 10
      mockUser.lastReadDate = '2024-03-01'

      await updateStreak(userId, new Date('2024-03-10T12:00:00Z'))

      expect(mockUser.currentStreak).toBe(1)
    })
  })

  describe('Flow 4: streak reaches 7 → badge awarded + activity created', () => {
    it('awards streak_7 badge and creates activity when streak hits 7', async () => {
      await checkStreakMilestones(userId, 7)

      expect(mockUser.badges).toContain('streak_7')
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 7,
        timestamp: expect.any(Date),
        visibility: 'private',
      })
    })

    it('does not award badge again if already earned', async () => {
      mockUser.badges = ['streak_7']

      await checkStreakMilestones(userId, 7)

      expect(mockUser.badges).toEqual(['streak_7'])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('awards activity with followers visibility when sharing is enabled', async () => {
      mockUser.activitySharingEnabled = true

      await checkStreakMilestones(userId, 7)

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'followers' })
      )
    })

    it('does not award badge for non-milestone streaks', async () => {
      await checkStreakMilestones(userId, 6)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
    })
  })

  // ─── Goal progress flows ─────────────────────────────────────────────────────

  describe('Flow 5: goal progress updates correctly', () => {
    function makeGoal(type: 'words' | 'time' | 'books', overrides: Record<string, unknown> = {}) {
      return {
        _id: new Types.ObjectId(),
        userId,
        type,
        period: 'daily',
        targetValue: 1000,
        currentValue: 0,
        status: 'active' as string,
        notifyAt90Percent: false,
        notified: false,
        achievedAt: undefined as Date | undefined,
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
      }
    }

    function makeSession(overrides: Partial<IReadingSession> = {}): IReadingSession {
      return {
        userId,
        bookId,
        lastWordIndex: 200,
        timeSpent: 600,
        bookCompleted: false,
        ...overrides,
      } as IReadingSession
    }

    it('increments words goal by session.lastWordIndex', async () => {
      const goal = makeGoal('words', { currentValue: 500 })
      ;(Goal.find as jest.Mock).mockResolvedValue([goal])

      await updateGoalProgress(userId, makeSession({ lastWordIndex: 300 }))

      expect(goal.currentValue).toBe(800)
      expect(goal.save).toHaveBeenCalled()
    })

    it('increments time goal by session.timeSpent in minutes', async () => {
      const goal = makeGoal('time', { targetValue: 60, currentValue: 30 })
      ;(Goal.find as jest.Mock).mockResolvedValue([goal])

      await updateGoalProgress(userId, makeSession({ timeSpent: 600 })) // 10 min

      expect(goal.currentValue).toBe(40)
    })

    it('increments books goal by 1 only when bookCompleted is true', async () => {
      const goal = makeGoal('books', { targetValue: 5, currentValue: 2 })
      ;(Goal.find as jest.Mock).mockResolvedValue([goal])

      await updateGoalProgress(userId, makeSession({ bookCompleted: true }))

      expect(goal.currentValue).toBe(3)
    })

    it('does not increment books goal when bookCompleted is false', async () => {
      const goal = makeGoal('books', { targetValue: 5, currentValue: 2 })
      ;(Goal.find as jest.Mock).mockResolvedValue([goal])

      await updateGoalProgress(userId, makeSession({ bookCompleted: false }))

      expect(goal.currentValue).toBe(2)
    })

    it('marks goal as achieved and creates activity when target is reached', async () => {
      const goal = makeGoal('words', { currentValue: 900, achievedAt: undefined })
      ;(Goal.find as jest.Mock).mockResolvedValue([goal])

      await updateGoalProgress(userId, makeSession({ lastWordIndex: 150 }))

      expect(goal.status).toBe('achieved')
      expect(goal.achievedAt).toBeInstanceOf(Date)
      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'goal_achieved', userId })
      )
    })
  })
})
