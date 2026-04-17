import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import User from '../models/User'
import Goal from '../models/Goal'
import { Types } from 'mongoose'
import { calculateDailyPace } from '../services/gamification/goalTracker'

/**
 * GET /api/gamification/streak
 * Get the current streak information for the authenticated user
 * 
 * Requirements: 6.4, 6.5
 */
export async function getStreak(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const user = await User.findById(userId).lean()
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      current: user.currentStreak,
      longest: user.longestStreak,
      lastReadDate: user.lastReadDate
    })
  } catch (error) {
    console.error('Error fetching streak:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/gamification/goals
 * Get all goals for the authenticated user
 * 
 * Requirements: 7.1
 */
export async function getGoals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const goals = await Goal.find({ userId }).sort({ createdAt: -1 }).lean()

    // Add daily pace calculation to each goal
    const goalsWithPace = goals.map(goal => ({
      ...goal,
      dailyPace: calculateDailyPace(goal as any)
    }))

    res.json({ goals: goalsWithPace })
  } catch (error) {
    console.error('Error fetching goals:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * POST /api/gamification/goals
 * Create a new goal for the authenticated user
 * 
 * Requirements: 7.1
 */
export async function createGoal(req: AuthRequest, res: Response): Promise<void> {
  const { type, period, targetValue } = req.body

  // Validate required fields
  if (!type || !['words', 'books', 'time'].includes(type)) {
    res.status(400).json({ error: 'type must be one of: words, books, time' })
    return
  }

  if (!period || !['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
    res.status(400).json({ error: 'period must be one of: daily, weekly, monthly, yearly' })
    return
  }

  if (!targetValue || typeof targetValue !== 'number' || targetValue <= 0) {
    res.status(400).json({ error: 'targetValue must be a positive number' })
    return
  }

  try {
    const userId = req.user!.id

    // Calculate start and end dates based on period
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(startDate)
    
    switch (period) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1)
        break
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7)
        break
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1)
        break
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1)
        break
    }

    // Create the goal
    const goal = await Goal.create({
      userId: new Types.ObjectId(userId),
      type,
      period,
      targetValue,
      currentValue: 0,
      startDate,
      endDate,
      status: 'active',
      notifyAt90Percent: true,
      notified: false
    })

    res.status(201).json({ goal })
  } catch (error) {
    console.error('Error creating goal:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * PUT /api/gamification/goals/:id
 * Update a goal's target value
 * 
 * Requirements: 7.5
 */
export async function updateGoal(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { targetValue } = req.body

  if (!targetValue || typeof targetValue !== 'number' || targetValue <= 0) {
    res.status(400).json({ error: 'targetValue must be a positive number' })
    return
  }

  try {
    const userId = req.user!.id

    // Find the goal and verify ownership
    const goal = await Goal.findOne({
      _id: id,
      userId: new Types.ObjectId(userId)
    })

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' })
      return
    }

    // Only allow updating active goals
    if (goal.status !== 'active') {
      res.status(400).json({ error: 'Cannot update non-active goals' })
      return
    }

    // Update target value
    goal.targetValue = targetValue

    // Reset notification flag if goal was already at 90%
    if (goal.notified && goal.currentValue / targetValue < 0.9) {
      goal.notified = false
    }

    // Check if goal is now achieved
    if (goal.currentValue >= targetValue) {
      goal.status = 'achieved'
      goal.achievedAt = new Date()
    }

    await goal.save()

    res.json({ goal })
  } catch (error) {
    console.error('Error updating goal:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * DELETE /api/gamification/goals/:id
 * Delete (cancel) a goal
 * 
 * Requirements: 7.5
 */
export async function deleteGoal(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params

  try {
    const userId = req.user!.id

    // Find the goal and verify ownership
    const goal = await Goal.findOne({
      _id: id,
      userId: new Types.ObjectId(userId)
    })

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' })
      return
    }

    // Mark as cancelled instead of deleting
    goal.status = 'cancelled'
    await goal.save()

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting goal:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/gamification/badges
 * Get all badges earned by the authenticated user
 * 
 * Requirements: 6.5
 */
export async function getBadges(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const user = await User.findById(userId).lean()
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ badges: user.badges })
  } catch (error) {
    console.error('Error fetching badges:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
