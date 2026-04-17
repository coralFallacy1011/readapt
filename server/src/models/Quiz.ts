import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IQuiz extends Document {
  userId: Types.ObjectId
  bookId: Types.ObjectId
  chapterIndex?: number
  timestamp: Date
  
  // Questions
  questions: Array<{
    question: string
    options: string[]
    correctIndex: number
    category: 'main_idea' | 'detail' | 'inference'
    explanation: string
  }>
  
  // User responses
  userAnswers: number[]
  score: number
  timeTaken: number
  
  // Context
  textComplexity: number
  sessionWPM: number
}

const QuizSchema = new Schema<IQuiz>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  chapterIndex: { type: Number, required: false },
  timestamp: { type: Date, default: Date.now },
  
  // Questions
  questions: [{
    question: { type: String, required: true },
    options: { type: [String], required: true, validate: [arrayLimit, 'Must have exactly 4 options'] },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    category: { 
      type: String, 
      enum: ['main_idea', 'detail', 'inference'],
      required: true 
    },
    explanation: { type: String, required: true }
  }],
  
  // User responses
  userAnswers: { type: [Number], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  timeTaken: { type: Number, required: true, min: 0 },
  
  // Context
  textComplexity: { type: Number, required: true, min: 0, max: 1 },
  sessionWPM: { type: Number, required: true, min: 0 }
})

// Validator function for options array
function arrayLimit(val: string[]) {
  return val.length === 4
}

// Indexes for efficient queries
QuizSchema.index({ userId: 1, bookId: 1 })
QuizSchema.index({ userId: 1, timestamp: -1 })

export default mongoose.model<IQuiz>('Quiz', QuizSchema)
