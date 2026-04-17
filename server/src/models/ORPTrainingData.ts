import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IORPTrainingData extends Document {
  userId: Types.ObjectId
  sessionId: Types.ObjectId
  timestamp: Date
  
  // Word context
  word: string
  wordLength: number
  standardORPIndex: number
  testORPIndex: number
  isTestWord: boolean
  
  // Performance
  timeToNextWord: number
  pausedAfter: boolean
  speedAdjustedAfter: boolean
  
  // Session context
  sessionWPM: number
  textComplexity: number
}

const ORPTrainingDataSchema = new Schema<IORPTrainingData>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'ReadingSession', required: true },
  timestamp: { type: Date, default: Date.now },
  
  // Word context
  word: { type: String, required: true },
  wordLength: { type: Number, required: true, min: 1 },
  standardORPIndex: { type: Number, required: true, min: 0 },
  testORPIndex: { type: Number, required: true, min: 0 },
  isTestWord: { type: Boolean, required: true },
  
  // Performance
  timeToNextWord: { type: Number, required: true, min: 0 },
  pausedAfter: { type: Boolean, required: true },
  speedAdjustedAfter: { type: Boolean, required: true },
  
  // Session context
  sessionWPM: { type: Number, required: true, min: 0 },
  textComplexity: { type: Number, required: true, min: 0, max: 1 }
})

// Index for efficient querying by user and session
ORPTrainingDataSchema.index({ userId: 1, sessionId: 1 })
ORPTrainingDataSchema.index({ userId: 1, timestamp: -1 })

export default mongoose.model<IORPTrainingData>('ORPTrainingData', ORPTrainingDataSchema)
