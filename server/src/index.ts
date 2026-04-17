import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { connectDB } from './config/db'
import authRouter from './routes/auth'
import booksRouter from './routes/books'
import sessionRouter from './routes/session'
import analyticsRouter from './routes/analytics'
import socialRouter from './routes/social'
import publicRouter from './routes/public'
import mlRouter from './routes/ml'
import gamificationRouter from './routes/gamification'
import bookmarksRouter from './routes/bookmarks'
import quizRouter from './routes/quiz'
import offlineRouter from './routes/offline'
import ttsRouter from './routes/tts'
import languageRouter from './routes/language'
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/socketAuth'
import { initializeWebSocket } from './utils/websocket'

dotenv.config()

const app = express()
const httpServer = createServer(app)

// CORS — allow the frontend origin (set CLIENT_URL in production env)
const allowedOrigins = [
  process.env.CLIENT_URL ?? 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
]

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server / curl (no origin) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// Initialize Socket.IO with CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})

// Initialize WebSocket utility
initializeWebSocket(io)

// Apply authentication middleware to all socket connections
io.use(socketAuthMiddleware)

// WebSocket connection handler
io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`User connected: ${socket.user?.id}`)

  // Join user-specific room for targeted updates
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`)
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user?.id}`)
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.user?.id}:`, error)
  })
})

// Export io instance for use in other modules
export { io }

app.use(express.json({ limit: '10mb' }))

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

const mlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ML requests, please try again later.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
})

// Health check — used by Render / Railway to verify the server is up
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/books', generalLimiter, booksRouter)
app.use('/api/session', generalLimiter, sessionRouter)
app.use('/api/analytics', generalLimiter, analyticsRouter)
app.use('/api/social', generalLimiter, socialRouter)
app.use('/api/public', generalLimiter, publicRouter)
app.use('/api/ml', mlLimiter, mlRouter)
app.use('/api/gamification', generalLimiter, gamificationRouter)
app.use('/api/bookmarks', generalLimiter, bookmarksRouter)
app.use('/api/quizzes', generalLimiter, quizRouter)
app.use('/api/offline', generalLimiter, offlineRouter)
app.use('/api/tts', generalLimiter, ttsRouter)
app.use('/api/language', generalLimiter, languageRouter)

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

const PORT = process.env.PORT || 5000

connectDB()
  .then(() => {
    httpServer.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    )

    // Graceful shutdown on SIGTERM (Render / Railway send this on deploy)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received — shutting down gracefully')
      io.close(() => {
        httpServer.close(() => process.exit(0))
      })
    })
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err)
    process.exit(1)
  })

export default app
