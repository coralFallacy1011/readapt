import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBookmark extends Document {
  userId: Types.ObjectId
  bookId: Types.ObjectId
  type: 'bookmark' | 'highlight'
  
  // Position
  wordIndex: number
  endWordIndex?: number
  
  // Metadata
  note?: string
  color?: string
  createdAt: Date
  
  // Preview
  contextText: string
}

const BookmarkSchema = new Schema<IBookmark>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  type: { 
    type: String, 
    enum: ['bookmark', 'highlight'],
    required: true 
  },
  
  // Position
  wordIndex: { type: Number, required: true, min: 0 },
  endWordIndex: { type: Number, required: false, min: 0 },
  
  // Metadata
  note: { type: String, required: false },
  color: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  
  // Preview
  contextText: { type: String, required: true }
})

// Indexes for efficient queries
BookmarkSchema.index({ userId: 1, bookId: 1 })
BookmarkSchema.index({ userId: 1, type: 1 })

export default mongoose.model<IBookmark>('Bookmark', BookmarkSchema)
