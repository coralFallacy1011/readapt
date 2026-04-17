import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IReadingDNA extends Document {
  userId: Types.ObjectId
  lastUpdated: Date
  
  // Speed metrics
  averageWPM: number
  medianWPM: number
  wpmStandardDeviation: number
  
  // Temporal patterns
  optimalTimeOfDay: string
  optimalDayOfWeek: string[]
  averageSessionDuration: number
  
  // Content preferences
  preferredBookLength: number
  genreAffinity: Array<{
    genre: string
    wordsRead: number
    percentage: number
  }>
  
  // Flow state
  flowStateWPMRange: {
    min: number
    max: number
  }
  flowStateDuration: number
  flowStateTimeOfDay: string
  flowStateFrequency: number
  
  // Endurance
  enduranceScore: number
  streakConsistencyBonus: number
  
  // Comprehension
  averageComprehensionScore: number
  comprehensionByGenre: Map<string, number>
  
  // Visualization data
  wpmHistory: Array<{
    date: string
    wpm: number
  }>
  activityHeatmap: number[][]
}

const ReadingDNASchema = new Schema<IReadingDNA>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  
  // Speed metrics
  averageWPM: { type: Number, required: true, default: 0 },
  medianWPM: { type: Number, required: true, default: 0 },
  wpmStandardDeviation: { type: Number, required: true, default: 0 },
  
  // Temporal patterns
  optimalTimeOfDay: { type: String, default: '' },
  optimalDayOfWeek: { type: [String], default: [] },
  averageSessionDuration: { type: Number, default: 0 },
  
  // Content preferences
  preferredBookLength: { type: Number, default: 0 },
  genreAffinity: [{
    genre: { type: String, required: true },
    wordsRead: { type: Number, required: true },
    percentage: { type: Number, required: true }
  }],
  
  // Flow state
  flowStateWPMRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  flowStateDuration: { type: Number, default: 0 },
  flowStateTimeOfDay: { type: String, default: '' },
  flowStateFrequency: { type: Number, default: 0 },
  
  // Endurance
  enduranceScore: { type: Number, default: 0, min: 0, max: 100 },
  streakConsistencyBonus: { type: Number, default: 0, min: 0, max: 1 },
  
  // Comprehension
  averageComprehensionScore: { type: Number, default: 0 },
  comprehensionByGenre: { type: Map, of: Number, default: new Map() },
  
  // Visualization data
  wpmHistory: [{
    date: { type: String, required: true },
    wpm: { type: Number, required: true }
  }],
  activityHeatmap: { type: [[Number]], default: [] }
})

export default mongoose.model<IReadingDNA>('ReadingDNA', ReadingDNASchema)
