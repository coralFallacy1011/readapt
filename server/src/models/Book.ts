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
  
  // Format support (Requirement 5.1, 5.5)
  format: 'pdf' | 'epub'
  fileUrl: string  // S3 URL
  fileSize: number  // bytes
  
  // EPUB-specific (Requirement 5.2)
  chapters?: Array<{
    title: string
    startWordIndex: number
    endWordIndex: number
  }>
  
  // Metadata (Requirements 3.3, 17.4)
  author?: string
  genre?: string
  language: string  // ISO 639-1 code (e.g., 'en', 'es')
  averageWordLength: number
  complexityScore: number  // 0.0-1.0
  
  // Reading progress (Requirement 5.6)
  isCompleted: boolean
  completedAt?: Date
  
  // Offline (Requirements 15.3)
  isAvailableOffline: boolean
  offlineCacheSize?: number
}

const BookSchema = new Schema<IBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    totalWords: { type: Number, required: true },
    words: { type: [String], required: true },
    pdfData: { type: Buffer },
    pageWordCounts: { type: [Number] },
    isPublic: { type: Boolean, default: false },
    
    // Format support
    format: { type: String, enum: ['pdf', 'epub'], required: true, default: 'pdf' },
    fileUrl: { type: String, required: true, default: '' },
    fileSize: { type: Number, required: true, default: 0 },
    
    // EPUB-specific
    chapters: [{
      title: { type: String, required: true },
      startWordIndex: { type: Number, required: true },
      endWordIndex: { type: Number, required: true }
    }],
    
    // Metadata
    author: { type: String },
    genre: { type: String },
    language: { type: String, required: true, default: 'en' },
    averageWordLength: { type: Number, required: true, default: 0 },
    complexityScore: { type: Number, required: true, default: 0, min: 0, max: 1 },
    
    // Reading progress
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    
    // Offline
    isAvailableOffline: { type: Boolean, default: false },
    offlineCacheSize: { type: Number }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default mongoose.model<IBook>('Book', BookSchema)
