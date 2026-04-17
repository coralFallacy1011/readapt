import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import Book from '../models/Book'
import ReadingSession from '../models/ReadingSession'

export async function cacheBook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findOne({ _id: req.params.bookId, userId: req.user!.id })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    book.isAvailableOffline = true
    book.offlineCacheSize = book.fileSize || 0
    await book.save()

    res.json({ book })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function removeCachedBook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findOne({ _id: req.params.bookId, userId: req.user!.id })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    book.isAvailableOffline = false
    book.offlineCacheSize = undefined
    await book.save()

    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getCachedBooks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const books = await Book.find({ userId: req.user!.id, isAvailableOffline: true })
    res.json({ books })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

interface OfflineSession {
  bookId: string
  lastWordIndex: number
  timeSpent: number
  currentWPM: number
  date?: string
}

export async function syncOfflineSessions(req: AuthRequest, res: Response): Promise<void> {
  const { sessions } = req.body as { sessions: OfflineSession[] }

  if (!Array.isArray(sessions)) {
    res.status(400).json({ error: 'sessions must be an array' })
    return
  }

  try {
    const docs = sessions.map((s) => ({
      userId: req.user!.id,
      bookId: s.bookId,
      lastWordIndex: s.lastWordIndex ?? 0,
      timeSpent: s.timeSpent ?? 0,
      currentWPM: s.currentWPM ?? 300,
      date: s.date ? new Date(s.date) : new Date(),
      pauseEvents: [],
      speedChanges: [],
      averageWordLength: 0,
      complexityScore: 0,
      readingVelocity: 0,
      sessionCompleted: false,
      bookCompleted: false,
    }))

    await ReadingSession.insertMany(docs)
    res.json({ synced: docs.length })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
