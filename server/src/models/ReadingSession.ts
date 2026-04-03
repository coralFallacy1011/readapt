import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IReadingSession extends Document {
  userId: Types.ObjectId
  bookId: Types.ObjectId
  lastWordIndex: number
  currentWPM: number
  timeSpent: number
  date: Date
}

const ReadingSessionSchema = new Schema<IReadingSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  lastWordIndex: { type: Number, required: true, default: 0 },
  currentWPM: { type: Number, required: true, default: 300 },
  timeSpent: { type: Number, required: true, default: 0 },
  date: { type: Date, default: Date.now }
})

export default mongoose.model<IReadingSession>('ReadingSession', ReadingSessionSchema)
