import Challenge, { IChallenge } from '../../models/Challenge'
import User from '../../models/User'
import { Types } from 'mongoose'
import { emitToUsers } from '../../utils/websocket'

/**
 * Create a new reading challenge
 * Requirements: 10.1, 10.2
 */
export async function createChallenge(
  creatorId: Types.ObjectId,
  name: string,
  description: string,
  goalType: 'words' | 'books' | 'time',
  goalValue: number,
  duration: number,
  participantIds: Types.ObjectId[]
): Promise<IChallenge> {
  // Validate inputs
  if (!name || !name.trim()) {
    throw new Error('Challenge name is required')
  }
  
  if (goalValue < 1) {
    throw new Error('Goal value must be at least 1')
  }
  
  if (duration < 1) {
    throw new Error('Duration must be at least 1 day')
  }
  
  if (!participantIds || participantIds.length === 0) {
    throw new Error('At least one participant is required')
  }
  
  // Verify all participants exist
  const users = await User.find({ _id: { $in: participantIds } })
  if (users.length !== participantIds.length) {
    throw new Error('One or more participants not found')
  }
  
  // Create challenge with pending status
  const now = new Date()
  const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)
  
  const challenge = await Challenge.create({
    creatorId,
    name: name.trim(),
    description: description?.trim() || '',
    goalType,
    goalValue,
    startDate: now,
    endDate,
    duration,
    participants: participantIds.map(userId => ({
      userId,
      status: 'invited',
      progress: 0,
      joinedAt: now
    })),
    status: 'pending',
    leaderboard: []
  })
  
  return challenge
}

/**
 * Respond to a challenge invitation (accept or decline)
 * Requirements: 10.3
 */
export async function respondToInvitation(
  challengeId: Types.ObjectId,
  userId: Types.ObjectId,
  accept: boolean
): Promise<IChallenge> {
  const challenge = await Challenge.findById(challengeId)
  
  if (!challenge) {
    throw new Error('Challenge not found')
  }
  
  // Find participant
  const participant = challenge.participants.find(
    p => p.userId.toString() === userId.toString()
  )
  
  if (!participant) {
    throw new Error('User is not invited to this challenge')
  }
  
  if (participant.status !== 'invited') {
    throw new Error('Invitation already responded to')
  }
  
  // Update participant status
  participant.status = accept ? 'accepted' : 'declined'
  participant.joinedAt = new Date()
  
  // If first acceptance, activate the challenge
  if (accept && challenge.status === 'pending') {
    const hasAccepted = challenge.participants.some(
      p => p.status === 'accepted'
    )
    
    if (hasAccepted) {
      challenge.status = 'active'
      challenge.startDate = new Date()
      challenge.endDate = new Date(
        challenge.startDate.getTime() + challenge.duration * 24 * 60 * 60 * 1000
      )
    }
  }
  
  await challenge.save()
  return challenge
}

/**
 * Leave a challenge
 * Requirements: 10.7
 */
export async function leaveChallenge(
  challengeId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<IChallenge> {
  const challenge = await Challenge.findById(challengeId)
  
  if (!challenge) {
    throw new Error('Challenge not found')
  }
  
  // Find participant
  const participant = challenge.participants.find(
    p => p.userId.toString() === userId.toString()
  )
  
  if (!participant) {
    throw new Error('User is not a participant in this challenge')
  }
  
  if (participant.status === 'left') {
    throw new Error('User has already left this challenge')
  }
  
  if (participant.status === 'invited' || participant.status === 'declined') {
    throw new Error('Cannot leave a challenge you have not accepted')
  }
  
  // Update participant status to left
  participant.status = 'left'
  
  await challenge.save()
  return challenge
}

/**
 * Get challenges for a user (created or participating)
 */
export async function getUserChallenges(
  userId: Types.ObjectId,
  status?: 'pending' | 'active' | 'completed' | 'cancelled'
): Promise<IChallenge[]> {
  const query: any = {
    $or: [
      { creatorId: userId },
      { 'participants.userId': userId }
    ]
  }
  
  if (status) {
    query.status = status
  }
  
  const challenges = await Challenge.find(query)
    .populate('creatorId', '_id name email')
    .populate('participants.userId', '_id name email')
    .sort({ createdAt: -1 })
  
  return challenges
}

/**
 * Update challenge progress for a participant
 * Requirements: 10.4
 */
export async function updateChallengeProgress(
  challengeId: Types.ObjectId,
  userId: Types.ObjectId,
  progress: number
): Promise<IChallenge> {
  const challenge = await Challenge.findById(challengeId)
  
  if (!challenge) {
    throw new Error('Challenge not found')
  }
  
  if (challenge.status !== 'active') {
    throw new Error('Challenge is not active')
  }
  
  // Find participant
  const participant = challenge.participants.find(
    p => p.userId.toString() === userId.toString()
  )
  
  if (!participant) {
    throw new Error('User is not a participant in this challenge')
  }
  
  if (participant.status !== 'accepted') {
    throw new Error('User has not accepted this challenge')
  }
  
  // Update progress
  participant.progress = Math.max(0, progress)
  
  // Update leaderboard
  updateLeaderboard(challenge)
  
  await challenge.save()

  // Broadcast leaderboard update to all accepted participants (Requirement 10.5)
  try {
    const participantIds = challenge.participants
      .filter(p => p.status === 'accepted')
      .map(p => p.userId.toString())

    if (participantIds.length > 0) {
      emitToUsers(participantIds, 'challenge:leaderboard', {
        challengeId: challenge._id,
        leaderboard: challenge.leaderboard,
      })
    }
  } catch (err) {
    console.error('challenge leaderboard broadcast error:', err)
  }

  return challenge
}

/**
 * Update challenge leaderboard based on current progress
 * Requirements: 10.5
 */
function updateLeaderboard(challenge: IChallenge): void {
  // Get accepted participants with their progress
  const activeParticipants = challenge.participants
    .filter(p => p.status === 'accepted')
    .map(p => ({
      userId: p.userId,
      progress: p.progress
    }))
    .sort((a, b) => b.progress - a.progress)
  
  // Assign ranks
  challenge.leaderboard = activeParticipants.map((p, index) => ({
    userId: p.userId,
    progress: p.progress,
    rank: index + 1
  }))
}

/**
 * Complete a challenge and determine winners
 * Requirements: 10.6
 */
export async function completeChallenge(
  challengeId: Types.ObjectId
): Promise<IChallenge> {
  const challenge = await Challenge.findById(challengeId)
  
  if (!challenge) {
    throw new Error('Challenge not found')
  }
  
  if (challenge.status !== 'active') {
    throw new Error('Challenge is not active')
  }
  
  // Update status
  challenge.status = 'completed'
  
  // Update leaderboard one final time
  updateLeaderboard(challenge)
  
  // Determine winners (top 3 who reached goalValue)
  const topParticipants = challenge.leaderboard
    .filter(entry => entry.progress >= challenge.goalValue)
    .slice(0, 3)
    .map(entry => entry.userId)
  
  challenge.winners = topParticipants
  
  await challenge.save()
  
  // Award badges to winners (1st, 2nd, 3rd place)
  const rankNames = ['1st', '2nd', '3rd']
  await Promise.all(
    topParticipants.map(async (userId, index) => {
      const badge = `challenge_winner_${rankNames[index]}`
      await User.updateOne(
        { _id: userId, badges: { $ne: badge } },
        { $push: { badges: badge } }
      )
    })
  )
  
  return challenge
}

/**
 * Get challenge leaderboard with user information
 * Requirements: 10.4, 10.5
 */
export async function getChallengeLeaderboard(
  challengeId: Types.ObjectId
): Promise<IChallenge> {
  const challenge = await Challenge.findById(challengeId)
    .populate('leaderboard.userId', '_id name email')
  
  if (!challenge) {
    throw new Error('Challenge not found')
  }
  
  return challenge
}
