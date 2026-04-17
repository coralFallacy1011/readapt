import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ISpeedRecommendation extends Document {
  userId: Types.ObjectId
  sessionId: Types.ObjectId
  timestamp: Date
  
  // Recommendation
  currentWPM: number
  recommendedWPM: number
  rationale: string
  confidence: number
  
  // Context
  textComplexity: 'low' | 'medium' | 'high'
  pauseRate: number
  sessionDuration: number
  
  // User response
  accepted: boolean
  userAction?: 'accepted' | 'rejected' | 'modified' | 'ignored'
  userFinalWPM?: number
  
  // Outcome tracking
  subsequentVelocity?: number
}

const SpeedRecommendationSchema = new Schema<ISpeedRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'ReadingSession', required: true },
  timestamp: { type: Date, default: Date.now },
  
  // Recommendation
  currentWPM: { type: Number, required: true },
  recommendedWPM: { type: Number, required: true },
  rationale: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  
  // Context
  textComplexity: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    required: true 
  },
  pauseRate: { type: Number, required: true },
  sessionDuration: { type: Number, required: true },
  
  // User response
  accepted: { type: Boolean, default: false },
  userAction: { 
    type: String, 
    enum: ['accepted', 'rejected', 'modified', 'ignored'],
    required: false 
  },
  userFinalWPM: { type: Number, required: false },
  
  // Outcome tracking
  subsequentVelocity: { type: Number, required: false }
})

export default mongoose.model<ISpeedRecommendation>('SpeedRecommendation', SpeedRecommendationSchema)
