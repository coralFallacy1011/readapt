import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBook extends Document {
  userId: Types.ObjectId
  title: string
  totalWords: number
  words: string[]
  createdAt: Date
}

const BookSchema = new Schema<IBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    totalWords: { type: Number, required: true },
    words: { type: [String], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default mongoose.model<IBook>('Book', BookSchema)
