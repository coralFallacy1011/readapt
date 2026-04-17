import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IORPModel extends Document {
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  
  // Model status
  status: 'training' | 'active' | 'inactive' | 'failed'
  trainingDataCount: number
  validationScore: number
  
  // Model parameters
  offsetsByLength: Map<number, number>
  
  // Performance tracking
  baselineVelocity: number
  personalizedVelocity: number
  improvementPercentage: number
  
  // A/B testing data
  testWordsCount: number
  controlWordsCount: number
}

const ORPModelSchema = new Schema<IORPModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Model status
  status: { 
    type: String, 
    enum: ['training', 'active', 'inactive', 'failed'], 
    required: true,
    default: 'training'
  },
  trainingDataCount: { type: Number, required: true, default: 0, min: 0 },
  validationScore: { type: Number, required: true, default: 0 },
  
  // Model parameters (word length -> ORP offset)
  offsetsByLength: { 
    type: Map, 
    of: Number,
    default: new Map()
  },
  
  // Performance tracking
  baselineVelocity: { type: Number, required: true, default: 0 },
  personalizedVelocity: { type: Number, required: true, default: 0 },
  improvementPercentage: { type: Number, required: true, default: 0 },
  
  // A/B testing data
  testWordsCount: { type: Number, required: true, default: 0, min: 0 },
  controlWordsCount: { type: Number, required: true, default: 0, min: 0 }
})

// Update the updatedAt timestamp on save
ORPModelSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

export default mongoose.model<IORPModel>('ORPModel', ORPModelSchema)
