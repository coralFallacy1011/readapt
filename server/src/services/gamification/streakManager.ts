import User from '../../models/User'
import Activity from '../../models/Activity'
import { Types } from 'mongoose'

/**
 * Format a date to YYYY-MM-DD string in the user's timezone
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    // Use Intl.DateTimeFormat to get the date in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    return formatter.format(date) // Returns YYYY-MM-DD format
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    console.error(`Invalid timezone: ${timezone}, falling back to UTC`)
    return formatDateInTimezone(date, 'UTC')
  }
}

/**
 * Calculate the difference in days between two YYYY-MM-DD date strings
 */
export function daysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00Z')
  const d2 = new Date(date2 + 'T00:00:00Z')
  const diffMs = d2.getTime() - d1.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Update user's reading streak based on session date
 * 
 * @param userId - The user's ID
 * @param sessionDate - The date of the reading session
 * 
 * Requirements:
 * - 6.1: Use user's timezone for day boundaries
 * - 6.2: Increment streak on consecutive days
 * - 6.3: Reset streak on missed days
 * - 6.7: Update lastReadDate to session date
 */
export async function updateStreak(
  userId: Types.ObjectId | string,
  sessionDate: Date
): Promise<void> {
  const user = await User.findById(userId)
  
  if (!user) {
    throw new Error('User not found')
  }
  
  // Get today's date in user's timezone
  const today = formatDateInTimezone(sessionDate, user.timezone)
  const lastRead = user.lastReadDate
  
  // If already read today, no change needed
  if (lastRead === today) {
    return
  }
  
  // If this is the first reading session ever
  if (!lastRead || lastRead === '') {
    user.currentStreak = 1
    user.longestStreak = 1
    user.lastReadDate = today
    await user.save()
    return
  }
  
  // Calculate days since last read
  const daysSinceLastRead = daysDifference(lastRead, today)
  
  if (daysSinceLastRead === 1) {
    // Consecutive day - increment streak
    user.currentStreak += 1
    user.longestStreak = Math.max(user.longestStreak, user.currentStreak)
  } else if (daysSinceLastRead === 0) {
    // Same day (already handled above, but defensive check)
    return
  } else {
    // Missed day(s) - reset streak to 1
    user.currentStreak = 1
  }
  
  user.lastReadDate = today
  await user.save()
}

/**
 * Check and award streak milestone badges
 * 
 * Validates: Requirements 6.6
 * 
 * @param userId - The user's ID
 * @param streak - The current streak count
 * 
 * Requirements:
 * - Award badges at 7, 30, 100, 365 days
 * - Only award if not already earned (prevent duplicates)
 * - Create Activity entries for milestone achievements
 */
export async function checkStreakMilestones(
  userId: Types.ObjectId | string,
  streak: number
): Promise<void> {
  const milestones = [7, 30, 100, 365]
  const user = await User.findById(userId)
  
  if (!user) {
    throw new Error('User not found')
  }
  
  for (const milestone of milestones) {
    if (streak === milestone) {
      const badgeId = `streak_${milestone}`
      
      // Only award if not already earned
      if (!user.badges.includes(badgeId)) {
        user.badges.push(badgeId)
        await user.save()
        
        // Create activity entry
        await Activity.create({
          userId,
          type: 'streak_milestone',
          streakCount: milestone,
          timestamp: new Date(),
          visibility: user.activitySharingEnabled ? 'followers' : 'private'
        })
      }
    }
  }
}
