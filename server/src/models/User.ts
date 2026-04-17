import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  createdAt: Date
  
  // Profile settings
  profileVisibility: 'private' | 'public' | 'followers-only'
  activitySharingEnabled: boolean
  timezone: string
  
  // AI/ML settings
  aiSpeedEnabled: boolean
  personalizedORPEnabled: boolean
  minWPM: number
  maxWPM: number
  
  // Gamification
  currentStreak: number
  longestStreak: number
  lastReadDate: string  // YYYY-MM-DD
  badges: string[]
  
  // Mobile
  pushNotificationsEnabled: boolean
  deviceTokens: string[]
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    
    // Profile settings
    profileVisibility: { type: String, enum: ['private', 'public', 'followers-only'], default: 'private' },
    activitySharingEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'UTC' },
    
    // AI/ML settings
    aiSpeedEnabled: { type: Boolean, default: true },
    personalizedORPEnabled: { type: Boolean, default: true },
    minWPM: { type: Number, default: 100, min: 50 },
    maxWPM: { type: Number, default: 1000, max: 2000 },
    
    // Gamification
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastReadDate: { type: String, default: '' },
    badges: { type: [String], default: [] },
    
    // Mobile
    pushNotificationsEnabled: { type: Boolean, default: false },
    deviceTokens: { type: [String], default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export default mongoose.model<IUser>('User', UserSchema)
