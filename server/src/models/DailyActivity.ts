import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IDailyActivity extends Document {
  userId: Types.ObjectId
  date: string        // YYYY-MM-DD — one doc per user per day
  wordsRead: number
}

const DailyActivitySchema = new Schema<IDailyActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },   // e.g. "2026-04-03"
  wordsRead: { type: Number, default: 0 }
})

// Unique index — one document per user per day
DailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true })

export default mongoose.model<IDailyActivity>('DailyActivity', DailyActivitySchema)
