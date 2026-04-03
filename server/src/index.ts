import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db'
import authRouter from './routes/auth'
import booksRouter from './routes/books'
import sessionRouter from './routes/session'
import analyticsRouter from './routes/analytics'

dotenv.config()

const app = express()

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

app.use(express.json({ limit: '10mb' }))

// Health check — used by Render / Railway to verify the server is up
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/books', booksRouter)
app.use('/api/session', sessionRouter)
app.use('/api/analytics', analyticsRouter)

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

const PORT = process.env.PORT || 5000

connectDB()
  .then(() => {
    const server = app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    )

    // Graceful shutdown on SIGTERM (Render / Railway send this on deploy)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received — shutting down gracefully')
      server.close(() => process.exit(0))
    })
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err)
    process.exit(1)
  })

export default app
