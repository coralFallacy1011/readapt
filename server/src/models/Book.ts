import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBook extends Document {
  userId: Types.ObjectId
  title: string
  totalWords: number
  words: string[]
  pdfData?: Buffer
  pageWordCounts?: number[]  // words per page, index 0 = page 1
  isPublic: boolean
  createdAt: Date
}

const BookSchema = new Schema<IBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    totalWords: { type: Number, required: true },
    words: { type: [String], required: true },
    pdfData: { type: Buffer },
    pageWordCounts: { type: [Number] },
    isPublic: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default mongoose.model<IBook>('Book', BookSchema)
