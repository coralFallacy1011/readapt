import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth'
import ReadingSession from '../models/ReadingSession'
import Book from '../models/Book'

export async function getAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    // Sum of lastWordIndex across all sessions for this user
    const wordAgg = await ReadingSession.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$lastWordIndex' } } }
    ])
    const totalWordsRead: number = wordAgg[0]?.total ?? 0

    // Count of books uploaded by this user
    const booksUploaded = await Book.countDocuments({ userId })

    // Most recent session by date
    const lastSessionDoc = await ReadingSession.findOne({ userId })
      .sort({ date: -1 })
      .lean()

    const lastSession = lastSessionDoc
      ? { date: lastSessionDoc.date, currentWPM: lastSessionDoc.currentWPM }
      : null

    res.json({ totalWordsRead, booksUploaded, lastSession })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
