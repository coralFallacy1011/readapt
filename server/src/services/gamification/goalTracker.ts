import Goal, { IGoal } from '../../models/Goal'
import Activity from '../../models/Activity'
import { Types } from 'mongoose'
import { IReadingSession } from '../../models/ReadingSession'

/**
 * Update goal progress based on a completed reading session
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
 * 
 * @param userId - The user's ID
 * @param session - The completed reading session
 * 
 * Requirements:
 * - 7.1: Track words, time, and books goals
 * - 7.2: Calculate progress based on goal type
 * - 7.3: Mark goal as achieved at 100% completion
 * - 7.4: Create Activity entry for goal achievements
 * - 7.6: Send notification at 90% completion (if enabled)
 */
export async function updateGoalProgress(
  userId: Types.ObjectId | string,
  session: IReadingSession
): Promise<void> {
  // Query all active goals for the user
  const goals = await Goal.find({ userId, status: 'active' })
  
  for (const goal of goals) {
    let increment = 0
    
    // Calculate increment based on goal type
    switch (goal.type) {
      case 'words':
        increment = session.lastWordIndex
        break
      case 'time':
        // Convert seconds to minutes
        increment = session.timeSpent / 60
        break
      case 'books':
        // Only increment if book was completed in this session
        if (session.bookCompleted) {
          increment = 1
        }
        break
    }
    
    // Update current value
    goal.currentValue += increment
    
    // Check for 90% completion notification
    const progressPercentage = goal.currentValue / goal.targetValue
    if (
      progressPercentage >= 0.9 &&
      !goal.notified &&
      goal.notifyAt90Percent
    ) {
      goal.notified = true
      // Note: In a real implementation, this would call a notification service
      // For now, we just set the flag
      console.log(`User ${userId} is 90% complete on ${goal.type} goal`)
    }
    
    // Check for 100% completion (achievement)
    if (goal.currentValue >= goal.targetValue && goal.status === 'active') {
      goal.status = 'achieved'
      goal.achievedAt = new Date()
      
      // Create activity entry for achievement
      await Activity.create({
        userId,
        type: 'goal_achieved',
        goalId: goal._id,
        timestamp: new Date(),
        visibility: 'followers'
      })
    }
    
    await goal.save()
  }
}

/**
 * Calculate the required daily reading pace to achieve a goal
 * 
 * Validates: Requirements 7.7
 * 
 * @param goal - The goal to calculate pace for
 * @returns The required daily pace, or null if goal is already achieved or has negative/zero days remaining
 * 
 * Requirements:
 * - 7.7: Calculate required pace: (targetValue - currentValue) / days_remaining
 * 
 * Edge cases:
 * - Goal already achieved (currentValue >= targetValue): returns 0
 * - Negative days remaining (endDate in the past): returns null
 * - Zero days remaining (endDate is today): returns remaining value
 * - Goal not active: returns null
 */
export function calculateDailyPace(goal: IGoal): number | null {
  // Only calculate pace for active goals
  if (goal.status !== 'active') {
    return null
  }
  
  // If goal is already achieved, pace is 0
  if (goal.currentValue >= goal.targetValue) {
    return 0
  }
  
  // Calculate days remaining
  const now = new Date()
  const endDate = new Date(goal.endDate)
  
  // Reset time components to compare dates only
  now.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  
  const msPerDay = 24 * 60 * 60 * 1000
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / msPerDay)
  
  // If endDate is in the past, return null
  if (daysRemaining < 0) {
    return null
  }
  
  // If endDate is today (0 days remaining), return the full remaining value
  if (daysRemaining === 0) {
    return goal.targetValue - goal.currentValue
  }
  
  // Calculate required daily pace
  const remainingValue = goal.targetValue - goal.currentValue
  const dailyPace = remainingValue / daysRemaining
  
  return dailyPace
}
