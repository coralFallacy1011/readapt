import { updateGoalProgress, calculateDailyPace } from '../services/gamification/goalTracker'
import Goal, { IGoal } from '../models/Goal'
import Activity from '../models/Activity'
import { Types } from 'mongoose'
import { IReadingSession } from '../models/ReadingSession'

// Mock the models
jest.mock('../models/Goal')
jest.mock('../models/Activity')

describe('goalTracker', () => {
  const mockUserId = new Types.ObjectId()
  const mockBookId = new Types.ObjectId()
  
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  describe('updateGoalProgress', () => {
    describe('words goal tracking', () => {
      it('should increment words goal by session.lastWordIndex', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 250,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(750)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should mark words goal as achieved at 100% completion', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 900,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 150,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(1050)
        expect(mockGoal.status).toBe('achieved')
        expect(mockGoal.achievedAt).toBeInstanceOf(Date)
        expect(Activity.create).toHaveBeenCalledWith({
          userId: mockUserId,
          type: 'goal_achieved',
          goalId: mockGoal._id,
          timestamp: expect.any(Date),
          visibility: 'followers'
        })
      })
    })
    
    describe('time goal tracking', () => {
      it('should increment time goal by session.timeSpent in minutes', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'time',
          period: 'daily',
          targetValue: 60,
          currentValue: 30,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 250,
          timeSpent: 600, // 10 minutes in seconds
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(40)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should mark time goal as achieved at 100% completion', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'time',
          period: 'weekly',
          targetValue: 120,
          currentValue: 110,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 250,
          timeSpent: 900, // 15 minutes in seconds
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(125)
        expect(mockGoal.status).toBe('achieved')
        expect(mockGoal.achievedAt).toBeInstanceOf(Date)
      })
    })
    
    describe('books goal tracking', () => {
      it('should increment books goal by 1 when bookCompleted is true', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'books',
          period: 'monthly',
          targetValue: 5,
          currentValue: 2,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 5000,
          timeSpent: 1800,
          bookCompleted: true
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(3)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should NOT increment books goal when bookCompleted is false', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'books',
          period: 'monthly',
          targetValue: 5,
          currentValue: 2,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 500,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(2)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should mark books goal as achieved at 100% completion', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'books',
          period: 'monthly',
          targetValue: 3,
          currentValue: 2,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 5000,
          timeSpent: 1800,
          bookCompleted: true
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(3)
        expect(mockGoal.status).toBe('achieved')
        expect(mockGoal.achievedAt).toBeInstanceOf(Date)
      })
    })
    
    describe('90% notification', () => {
      it('should set notified flag at 90% completion when notifyAt90Percent is true', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 850,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 50,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(900)
        expect(mockGoal.notified).toBe(true)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should NOT set notified flag when already notified', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 900,
          status: 'active',
          notifyAt90Percent: true,
          notified: true,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 50,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(950)
        expect(mockGoal.notified).toBe(true)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should NOT set notified flag when notifyAt90Percent is false', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 850,
          status: 'active',
          notifyAt90Percent: false,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 50,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(900)
        expect(mockGoal.notified).toBe(false)
        expect(mockGoal.save).toHaveBeenCalled()
      })
      
      it('should set notified flag exactly at 90% threshold', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 800,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 100,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(900)
        expect(mockGoal.notified).toBe(true)
      })
    })
    
    describe('multiple goals', () => {
      it('should update multiple active goals simultaneously', async () => {
        const mockWordsGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        const mockTimeGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'time',
          period: 'daily',
          targetValue: 60,
          currentValue: 30,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockWordsGoal, mockTimeGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 250,
          timeSpent: 600, // 10 minutes
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockWordsGoal.currentValue).toBe(750)
        expect(mockTimeGoal.currentValue).toBe(40)
        expect(mockWordsGoal.save).toHaveBeenCalled()
        expect(mockTimeGoal.save).toHaveBeenCalled()
      })
      
      it('should handle no active goals gracefully', async () => {
        ;(Goal.find as jest.Mock).mockResolvedValue([])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 250,
          timeSpent: 600,
          bookCompleted: false
        } as IReadingSession
        
        await expect(updateGoalProgress(mockUserId, session)).resolves.not.toThrow()
      })
    })
    
    describe('goal periods', () => {
      it('should handle daily goals', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 500,
          currentValue: 400,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 150,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(550)
        expect(mockGoal.status).toBe('achieved')
      })
      
      it('should handle weekly goals', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'weekly',
          targetValue: 5000,
          currentValue: 4500,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 600,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(5100)
        expect(mockGoal.status).toBe('achieved')
      })
      
      it('should handle monthly goals', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'books',
          period: 'monthly',
          targetValue: 10,
          currentValue: 9,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 5000,
          timeSpent: 1800,
          bookCompleted: true
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(10)
        expect(mockGoal.status).toBe('achieved')
      })
    })
    
    describe('edge cases', () => {
      it('should handle goal exceeding target value', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 950,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          achievedAt: undefined as Date | undefined,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        ;(Activity.create as jest.Mock).mockResolvedValue({})
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 200,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(1150)
        expect(mockGoal.status).toBe('achieved')
      })
      
      it('should NOT change status of already achieved goals', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 1000,
          status: 'achieved',
          achievedAt: new Date('2024-01-01'),
          notifyAt90Percent: true,
          notified: true,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 100,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        // Goal should not be updated since it's not active
        expect(mockGoal.save).not.toHaveBeenCalled()
      })
      
      it('should handle zero increment for books goal when book not completed', async () => {
        const mockGoal = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          type: 'books',
          period: 'monthly',
          targetValue: 5,
          currentValue: 3,
          status: 'active',
          notifyAt90Percent: true,
          notified: false,
          save: jest.fn().mockResolvedValue(true)
        }
        
        ;(Goal.find as jest.Mock).mockResolvedValue([mockGoal])
        
        const session = {
          userId: mockUserId,
          bookId: mockBookId,
          lastWordIndex: 500,
          timeSpent: 300,
          bookCompleted: false
        } as IReadingSession
        
        await updateGoalProgress(mockUserId, session)
        
        expect(mockGoal.currentValue).toBe(3)
        expect(mockGoal.status).toBe('active')
      })
    })
  })
  
  describe('calculateDailyPace', () => {
    describe('basic pace calculation', () => {
      it('should calculate daily pace for words goal with days remaining', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 10) // 10 days from now
        
        const mockGoal = {
          type: 'words',
          period: 'monthly',
          targetValue: 10000,
          currentValue: 5000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (10000 - 5000) / 10 = 500
        expect(pace).toBe(500)
      })
      
      it('should calculate daily pace for time goal with days remaining', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 7) // 7 days from now
        
        const mockGoal = {
          type: 'time',
          period: 'weekly',
          targetValue: 420, // 7 hours in minutes
          currentValue: 180, // 3 hours
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (420 - 180) / 7 = 240 / 7 ≈ 34.29
        expect(pace).toBeCloseTo(34.29, 2)
      })
      
      it('should calculate daily pace for books goal with days remaining', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 30) // 30 days from now
        
        const mockGoal = {
          type: 'books',
          period: 'monthly',
          targetValue: 12,
          currentValue: 3,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (12 - 3) / 30 = 9 / 30 = 0.3
        expect(pace).toBe(0.3)
      })
    })
    
    describe('edge cases - goal already achieved', () => {
      it('should return 0 when goal is already achieved (currentValue >= targetValue)', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 1000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBe(0)
      })
      
      it('should return 0 when currentValue exceeds targetValue', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 1200,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBe(0)
      })
    })
    
    describe('edge cases - negative days remaining', () => {
      it('should return null when endDate is in the past', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() - 5) // 5 days ago
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBeNull()
      })
      
      it('should return null when endDate is yesterday', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() - 1) // yesterday
        
        const mockGoal = {
          type: 'time',
          period: 'daily',
          targetValue: 60,
          currentValue: 30,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBeNull()
      })
    })
    
    describe('edge cases - zero days remaining', () => {
      it('should return remaining value when endDate is today', () => {
        const today = new Date()
        const endDate = new Date(today) // same day
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 700,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // Should return full remaining value: 1000 - 700 = 300
        expect(pace).toBe(300)
      })
      
      it('should return remaining value for time goal when endDate is today', () => {
        const today = new Date()
        const endDate = new Date(today)
        
        const mockGoal = {
          type: 'time',
          period: 'daily',
          targetValue: 120,
          currentValue: 90,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBe(30)
      })
    })
    
    describe('edge cases - goal status', () => {
      it('should return null for achieved goals', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'achieved',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBeNull()
      })
      
      it('should return null for failed goals', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'failed',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBeNull()
      })
      
      it('should return null for cancelled goals', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 500,
          status: 'cancelled',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        expect(pace).toBeNull()
      })
    })
    
    describe('all goal types', () => {
      it('should calculate pace for words goal', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 20)
        
        const mockGoal = {
          type: 'words',
          period: 'monthly',
          targetValue: 50000,
          currentValue: 10000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (50000 - 10000) / 20 = 2000
        expect(pace).toBe(2000)
      })
      
      it('should calculate pace for time goal', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 14)
        
        const mockGoal = {
          type: 'time',
          period: 'weekly',
          targetValue: 840, // 14 hours
          currentValue: 420, // 7 hours
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (840 - 420) / 14 = 30
        expect(pace).toBe(30)
      })
      
      it('should calculate pace for books goal', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 365)
        
        const mockGoal = {
          type: 'books',
          period: 'yearly',
          targetValue: 52,
          currentValue: 12,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (52 - 12) / 365 ≈ 0.1096
        expect(pace).toBeCloseTo(0.1096, 4)
      })
    })
    
    describe('fractional results', () => {
      it('should return fractional pace when division is not exact', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 7)
        
        const mockGoal = {
          type: 'words',
          period: 'weekly',
          targetValue: 5000,
          currentValue: 1000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (5000 - 1000) / 7 = 4000 / 7 ≈ 571.43
        expect(pace).toBeCloseTo(571.43, 2)
      })
      
      it('should handle very small fractional pace for books goal', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 100)
        
        const mockGoal = {
          type: 'books',
          period: 'yearly',
          targetValue: 10,
          currentValue: 9,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (10 - 9) / 100 = 0.01
        expect(pace).toBe(0.01)
      })
    })
    
    describe('date boundary handling', () => {
      it('should handle goals ending at different times of day', () => {
        const today = new Date()
        today.setHours(14, 30, 0, 0) // 2:30 PM
        
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 5)
        endDate.setHours(23, 59, 59, 999) // End of day
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 5000,
          currentValue: 2000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // Should still calculate as 5 days: (5000 - 2000) / 5 = 600
        expect(pace).toBe(600)
      })
      
      it('should handle goals with 1 day remaining', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 1) // tomorrow
        
        const mockGoal = {
          type: 'words',
          period: 'daily',
          targetValue: 1000,
          currentValue: 400,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (1000 - 400) / 1 = 600
        expect(pace).toBe(600)
      })
    })
    
    describe('realistic scenarios', () => {
      it('should calculate pace for monthly reading goal mid-month', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 15) // 15 days remaining
        
        const mockGoal = {
          type: 'words',
          period: 'monthly',
          targetValue: 100000,
          currentValue: 45000,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (100000 - 45000) / 15 = 3666.67 words per day
        expect(pace).toBeCloseTo(3666.67, 2)
      })
      
      it('should calculate pace for weekly time goal with 3 days left', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 3)
        
        const mockGoal = {
          type: 'time',
          period: 'weekly',
          targetValue: 300, // 5 hours
          currentValue: 180, // 3 hours
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (300 - 180) / 3 = 40 minutes per day
        expect(pace).toBe(40)
      })
      
      it('should calculate pace for yearly books goal', () => {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 200) // 200 days remaining
        
        const mockGoal = {
          type: 'books',
          period: 'yearly',
          targetValue: 50,
          currentValue: 20,
          status: 'active',
          startDate: new Date(),
          endDate: endDate
        } as IGoal
        
        const pace = calculateDailyPace(mockGoal)
        
        // (50 - 20) / 200 = 0.15 books per day
        expect(pace).toBe(0.15)
      })
    })
  })
})
