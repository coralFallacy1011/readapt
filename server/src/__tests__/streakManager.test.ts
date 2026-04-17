import {
  formatDateInTimezone,
  daysDifference,
  updateStreak,
  checkStreakMilestones
} from '../services/gamification/streakManager'
import User, { IUser } from '../models/User'
import Activity from '../models/Activity'
import { Types } from 'mongoose'

// Mock the User model
jest.mock('../models/User')
// Mock the Activity model
jest.mock('../models/Activity')

describe('Streak Manager Service', () => {
  describe('formatDateInTimezone', () => {
    it('should format date in UTC timezone', () => {
      const date = new Date('2024-01-15T14:30:00Z')
      const result = formatDateInTimezone(date, 'UTC')
      expect(result).toBe('2024-01-15')
    })

    it('should format date in America/New_York timezone', () => {
      // 2024-01-15 02:00 UTC = 2024-01-14 21:00 EST
      const date = new Date('2024-01-15T02:00:00Z')
      const result = formatDateInTimezone(date, 'America/New_York')
      expect(result).toBe('2024-01-14')
    })

    it('should format date in Asia/Tokyo timezone', () => {
      // 2024-01-15 14:00 UTC = 2024-01-15 23:00 JST
      const date = new Date('2024-01-15T14:00:00Z')
      const result = formatDateInTimezone(date, 'Asia/Tokyo')
      expect(result).toBe('2024-01-15')
    })

    it('should format date in Europe/London timezone', () => {
      const date = new Date('2024-01-15T23:30:00Z')
      const result = formatDateInTimezone(date, 'Europe/London')
      expect(result).toBe('2024-01-15')
    })

    it('should handle date crossing midnight in timezone', () => {
      // 2024-01-16 00:30 UTC = 2024-01-15 19:30 EST
      const date = new Date('2024-01-16T00:30:00Z')
      const result = formatDateInTimezone(date, 'America/New_York')
      expect(result).toBe('2024-01-15')
    })

    it('should fallback to UTC for invalid timezone', () => {
      const date = new Date('2024-01-15T14:30:00Z')
      const result = formatDateInTimezone(date, 'Invalid/Timezone')
      expect(result).toBe('2024-01-15')
    })

    it('should handle leap year dates', () => {
      const date = new Date('2024-02-29T12:00:00Z')
      const result = formatDateInTimezone(date, 'UTC')
      expect(result).toBe('2024-02-29')
    })
  })

  describe('daysDifference', () => {
    it('should return 0 for same date', () => {
      const result = daysDifference('2024-01-15', '2024-01-15')
      expect(result).toBe(0)
    })

    it('should return 1 for consecutive days', () => {
      const result = daysDifference('2024-01-15', '2024-01-16')
      expect(result).toBe(1)
    })

    it('should return negative for past dates', () => {
      const result = daysDifference('2024-01-16', '2024-01-15')
      expect(result).toBe(-1)
    })

    it('should handle month boundaries', () => {
      const result = daysDifference('2024-01-31', '2024-02-01')
      expect(result).toBe(1)
    })

    it('should handle year boundaries', () => {
      const result = daysDifference('2023-12-31', '2024-01-01')
      expect(result).toBe(1)
    })

    it('should handle leap year', () => {
      const result = daysDifference('2024-02-28', '2024-03-01')
      expect(result).toBe(2) // 2024 is a leap year
    })

    it('should handle non-leap year', () => {
      const result = daysDifference('2023-02-28', '2023-03-01')
      expect(result).toBe(1) // 2023 is not a leap year
    })

    it('should handle large gaps', () => {
      const result = daysDifference('2024-01-01', '2024-12-31')
      expect(result).toBe(365) // 2024 is a leap year
    })
  })

  describe('updateStreak', () => {
    const userId = new Types.ObjectId()
    let mockUser: any

    beforeEach(() => {
      jest.clearAllMocks()
      
      mockUser = {
        _id: userId,
        timezone: 'UTC',
        currentStreak: 0,
        longestStreak: 0,
        lastReadDate: '',
        save: jest.fn().mockResolvedValue(true)
      }
    })

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null)

      await expect(updateStreak(userId, new Date())).rejects.toThrow('User not found')
    })

    it('should initialize streak to 1 for first reading session', async () => {
      mockUser.lastReadDate = ''
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-15T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(1)
      expect(mockUser.lastReadDate).toBe('2024-01-15')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should not change streak if already read today', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-15T18:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(5)
      expect(mockUser.longestStreak).toBe(10)
      expect(mockUser.lastReadDate).toBe('2024-01-15')
      expect(mockUser.save).not.toHaveBeenCalled()
    })

    it('should increment streak on consecutive day', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-16T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(6)
      expect(mockUser.longestStreak).toBe(10) // Not updated since 6 < 10
      expect(mockUser.lastReadDate).toBe('2024-01-16')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should update longest streak when current exceeds it', async () => {
      mockUser.currentStreak = 10
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-16T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(11)
      expect(mockUser.longestStreak).toBe(11) // Updated
      expect(mockUser.lastReadDate).toBe('2024-01-16')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should reset streak to 1 when missing one day', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-17T12:00:00Z') // Skipped Jan 16
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(10) // Unchanged
      expect(mockUser.lastReadDate).toBe('2024-01-17')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should reset streak to 1 when missing multiple days', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-20T12:00:00Z') // Skipped 4 days
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(10)
      expect(mockUser.lastReadDate).toBe('2024-01-20')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle timezone-aware day boundaries (EST)', async () => {
      mockUser.timezone = 'America/New_York'
      mockUser.currentStreak = 3
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      // 2024-01-16 03:00 UTC = 2024-01-15 22:00 EST (still Jan 15 in EST)
      const sessionDate = new Date('2024-01-16T03:00:00Z')
      await updateStreak(userId, sessionDate)

      // Should not change since it's still Jan 15 in EST
      expect(mockUser.currentStreak).toBe(3)
      expect(mockUser.save).not.toHaveBeenCalled()
    })

    it('should handle timezone-aware consecutive days (EST)', async () => {
      mockUser.timezone = 'America/New_York'
      mockUser.currentStreak = 3
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      // 2024-01-16 06:00 UTC = 2024-01-16 01:00 EST (now Jan 16 in EST)
      const sessionDate = new Date('2024-01-16T06:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(4)
      expect(mockUser.lastReadDate).toBe('2024-01-16')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle timezone-aware day boundaries (Tokyo)', async () => {
      mockUser.timezone = 'Asia/Tokyo'
      mockUser.currentStreak = 2
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      // 2024-01-15 16:00 UTC = 2024-01-16 01:00 JST (already Jan 16 in Tokyo)
      const sessionDate = new Date('2024-01-15T16:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(3)
      expect(mockUser.lastReadDate).toBe('2024-01-16')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle month boundary correctly', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-01-31'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-02-01T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(6)
      expect(mockUser.lastReadDate).toBe('2024-02-01')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle year boundary correctly', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2023-12-31'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-01T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(6)
      expect(mockUser.lastReadDate).toBe('2024-01-01')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle leap year date correctly', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 10
      mockUser.lastReadDate = '2024-02-28'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-02-29T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(6)
      expect(mockUser.lastReadDate).toBe('2024-02-29')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should accept userId as string', async () => {
      mockUser.lastReadDate = ''
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-15T12:00:00Z')
      await updateStreak(userId.toString(), sessionDate)

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle edge case: reading at exact midnight UTC', async () => {
      mockUser.currentStreak = 3
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-16T00:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(4)
      expect(mockUser.lastReadDate).toBe('2024-01-16')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle edge case: reading at 23:59:59 UTC', async () => {
      mockUser.currentStreak = 3
      mockUser.longestStreak = 5
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-15T23:59:59Z')
      await updateStreak(userId, sessionDate)

      // Should not change since it's still Jan 15
      expect(mockUser.currentStreak).toBe(3)
      expect(mockUser.save).not.toHaveBeenCalled()
    })

    it('should maintain longest streak even after reset', async () => {
      mockUser.currentStreak = 5
      mockUser.longestStreak = 20
      mockUser.lastReadDate = '2024-01-15'
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)

      const sessionDate = new Date('2024-01-20T12:00:00Z')
      await updateStreak(userId, sessionDate)

      expect(mockUser.currentStreak).toBe(1)
      expect(mockUser.longestStreak).toBe(20) // Should remain unchanged
      expect(mockUser.save).toHaveBeenCalled()
    })
  })

  describe('checkStreakMilestones', () => {
    const userId = new Types.ObjectId()
    let mockUser: any

    beforeEach(() => {
      jest.clearAllMocks()
      
      mockUser = {
        _id: userId,
        badges: [],
        activitySharingEnabled: false,
        save: jest.fn().mockResolvedValue(true)
      }
    })

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null)

      await expect(checkStreakMilestones(userId, 7)).rejects.toThrow('User not found')
    })

    it('should award badge at 7-day milestone', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 7)

      expect(mockUser.badges).toContain('streak_7')
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 7,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should award badge at 30-day milestone', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 30)

      expect(mockUser.badges).toContain('streak_30')
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 30,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should award badge at 100-day milestone', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 100)

      expect(mockUser.badges).toContain('streak_100')
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 100,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should award badge at 365-day milestone', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 365)

      expect(mockUser.badges).toContain('streak_365')
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 365,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should not award badge if already earned', async () => {
      mockUser.badges = ['streak_7']
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 7)

      expect(mockUser.badges).toEqual(['streak_7']) // No duplicate
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should not award badge for non-milestone streak', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 15)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should create public activity when activitySharingEnabled is true', async () => {
      mockUser.activitySharingEnabled = true
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 7)

      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 7,
        timestamp: expect.any(Date),
        visibility: 'followers'
      })
    })

    it('should create private activity when activitySharingEnabled is false', async () => {
      mockUser.activitySharingEnabled = false
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 30)

      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 30,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should accept userId as string', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId.toString(), 7)

      expect(mockUser.badges).toContain('streak_7')
      expect(mockUser.save).toHaveBeenCalled()
    })

    it('should handle multiple existing badges correctly', async () => {
      mockUser.badges = ['streak_7', 'streak_30', 'other_badge']
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 100)

      expect(mockUser.badges).toEqual(['streak_7', 'streak_30', 'other_badge', 'streak_100'])
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledTimes(1)
    })

    it('should not award lower milestone if user already has higher milestone', async () => {
      mockUser.badges = ['streak_100']
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      // User reaches 30-day milestone (maybe after streak reset)
      await checkStreakMilestones(userId, 30)

      expect(mockUser.badges).toEqual(['streak_100', 'streak_30'])
      expect(mockUser.save).toHaveBeenCalled()
      expect(Activity.create).toHaveBeenCalledWith({
        userId,
        type: 'streak_milestone',
        streakCount: 30,
        timestamp: expect.any(Date),
        visibility: 'private'
      })
    })

    it('should handle streak of 1 (no milestone)', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 1)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should handle streak of 0 (no milestone)', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 0)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should handle very large streak (beyond 365)', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 500)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should handle negative streak gracefully', async () => {
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, -5)

      expect(mockUser.badges).toEqual([])
      expect(mockUser.save).not.toHaveBeenCalled()
      expect(Activity.create).not.toHaveBeenCalled()
    })

    it('should award all milestones independently', async () => {
      const milestones = [7, 30, 100, 365]
      
      for (const milestone of milestones) {
        jest.clearAllMocks()
        mockUser.badges = []
        ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
        ;(Activity.create as jest.Mock).mockResolvedValue({})

        await checkStreakMilestones(userId, milestone)

        expect(mockUser.badges).toContain(`streak_${milestone}`)
        expect(mockUser.save).toHaveBeenCalled()
        expect(Activity.create).toHaveBeenCalledWith({
          userId,
          type: 'streak_milestone',
          streakCount: milestone,
          timestamp: expect.any(Date),
          visibility: 'private'
        })
      }
    })

    it('should preserve existing badges when adding new milestone', async () => {
      mockUser.badges = ['achievement_1', 'achievement_2']
      ;(User.findById as jest.Mock).mockResolvedValue(mockUser)
      ;(Activity.create as jest.Mock).mockResolvedValue({})

      await checkStreakMilestones(userId, 7)

      expect(mockUser.badges).toEqual(['achievement_1', 'achievement_2', 'streak_7'])
      expect(mockUser.save).toHaveBeenCalled()
    })
  })
})
