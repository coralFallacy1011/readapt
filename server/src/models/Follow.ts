import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IFollow extends Document {
  followerId: Types.ObjectId
  followingId: Types.ObjectId
  createdAt: Date
}

const FollowSchema = new Schema<IFollow>({
  followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  followingId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
})

FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true })

export default mongoose.model<IFollow>('Follow', FollowSchema)
