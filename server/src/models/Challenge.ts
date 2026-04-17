import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IChallenge extends Document {
  creatorId: Types.ObjectId
  name: string
  description: string
  
  // Goal
  goalType: 'words' | 'books' | 'time'
  goalValue: number
  
  // Timing
  startDate: Date
  endDate: Date
  duration: number
  
  // Participants
  participants: Array<{
    userId: Types.ObjectId
    status: 'invited' | 'accepted' | 'declined' | 'left'
    progress: number
    joinedAt: Date
  }>
  
  // Results
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  winners?: Types.ObjectId[]
  leaderboard: Array<{
    userId: Types.ObjectId
    progress: number
    rank: number
  }>
}

const ChallengeSchema = new Schema<IChallenge>({
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  
  // Goal
  goalType: { 
    type: String, 
    enum: ['words', 'books', 'time'],
    required: true 
  },
  goalValue: { type: Number, required: true, min: 1 },
  
  // Timing
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: { type: Number, required: true },
  
  // Participants
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { 
      type: String, 
      enum: ['invited', 'accepted', 'declined', 'left'],
      default: 'invited'
    },
    progress: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
  }],
  
  // Results
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  winners: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  leaderboard: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    progress: { type: Number, required: true },
    rank: { type: Number, required: true }
  }]
})

// Indexes for efficient queries
ChallengeSchema.index({ creatorId: 1, status: 1 })
ChallengeSchema.index({ 'participants.userId': 1, status: 1 })
ChallengeSchema.index({ status: 1, endDate: 1 })

export default mongoose.model<IChallenge>('Challenge', ChallengeSchema)
