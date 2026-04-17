import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IActivity extends Document {
  userId: Types.ObjectId
  type: 'book_completed' | 'streak_milestone' | 'book_uploaded' | 'goal_achieved' | 'challenge_won'
  timestamp: Date
  
  // Activity-specific data
  bookId?: Types.ObjectId
  bookTitle?: string
  streakCount?: number
  goalId?: Types.ObjectId
  challengeId?: Types.ObjectId
  
  // Social engagement
  likes: Types.ObjectId[]
  comments: Array<{
    userId: Types.ObjectId
    text: string
    timestamp: Date
  }>
  
  // Visibility
  visibility: 'public' | 'followers' | 'private'
}

const ActivitySchema = new Schema<IActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['book_completed', 'streak_milestone', 'book_uploaded', 'goal_achieved', 'challenge_won'],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  
  // Activity-specific data
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: false },
  bookTitle: { type: String, required: false },
  streakCount: { type: Number, required: false },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: false },
  challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: false },
  
  // Social engagement
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Visibility
  visibility: { 
    type: String, 
    enum: ['public', 'followers', 'private'],
    default: 'followers'
  }
})

// Index for efficient feed queries
ActivitySchema.index({ userId: 1, timestamp: -1 })
ActivitySchema.index({ timestamp: -1 })

export default mongoose.model<IActivity>('Activity', ActivitySchema)
