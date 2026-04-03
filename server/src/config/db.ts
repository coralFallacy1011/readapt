import mongoose from 'mongoose'

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('MONGO_URI is not defined')

  await mongoose.connect(uri, {
    // Atlas-recommended settings
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })

  console.log(`MongoDB connected: ${mongoose.connection.host}`)

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected')
  })
}
