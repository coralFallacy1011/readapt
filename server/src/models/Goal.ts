import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IGoal extends Document {
  userId: Types.ObjectId
  type: 'words' | 'books' | 'time'
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  targetValue: number
  
  // Progress
  currentValue: number
  startDate: Date
  endDate: Date
  
  // Status
  status: 'active' | 'achieved' | 'failed' | 'cancelled'
  achievedAt?: Date
  
  // Notifications
  notifyAt90Percent: boolean
  notified: boolean
}

const GoalSchema = new Schema<IGoal>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['words', 'books', 'time'],
    required: true 
  },
  period: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true 
  },
  targetValue: { type: Number, required: true, min: 1 },
  
  // Progress
  currentValue: { type: Number, required: true, default: 0, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'achieved', 'failed', 'cancelled'],
    default: 'active'
  },
  achievedAt: { type: Date, required: false },
  
  // Notifications
  notifyAt90Percent: { type: Boolean, default: true },
  notified: { type: Boolean, default: false }
})

// Indexes for efficient queries
GoalSchema.index({ userId: 1, status: 1 })
GoalSchema.index({ userId: 1, period: 1, status: 1 })
GoalSchema.index({ status: 1, endDate: 1 })

export default mongoose.model<IGoal>('Goal', GoalSchema)
