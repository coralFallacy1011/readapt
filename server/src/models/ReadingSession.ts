import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IReadingSession extends Document {
  userId: Types.ObjectId
  bookId: Types.ObjectId
  lastWordIndex: number
  currentWPM: number
  timeSpent: number
  date: Date
  
  // AI/ML tracking fields
  pauseEvents: Array<{
    wordIndex: number
    duration: number  // milliseconds
  }>
  speedChanges: Array<{
    wordIndex: number
    oldWPM: number
    newWPM: number
    timestamp: Date
  }>
  averageWordLength: number
  complexityScore: number
  readingVelocity: number
  sessionCompleted: boolean
  bookCompleted: boolean
}

const ReadingSessionSchema = new Schema<IReadingSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  lastWordIndex: { type: Number, required: true, default: 0 },
  currentWPM: { type: Number, required: true, default: 300 },
  timeSpent: { type: Number, required: true, default: 0 },
  date: { type: Date, default: Date.now },
  
  // AI/ML tracking fields
  pauseEvents: [{
    wordIndex: { type: Number, required: true },
    duration: { type: Number, required: true }
  }],
  speedChanges: [{
    wordIndex: { type: Number, required: true },
    oldWPM: { type: Number, required: true },
    newWPM: { type: Number, required: true },
    timestamp: { type: Date, required: true }
  }],
  averageWordLength: { type: Number, default: 0 },
  complexityScore: { type: Number, default: 0 },
  readingVelocity: { type: Number, default: 0 },
  sessionCompleted: { type: Boolean, default: false },
  bookCompleted: { type: Boolean, default: false }
})

export default mongoose.model<IReadingSession>('ReadingSession', ReadingSessionSchema)
