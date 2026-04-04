import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth'
import ReadingSession from '../models/ReadingSession'
import DailyActivity from '../models/DailyActivity'
import Book from '../models/Book'

export async function getAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    const wordAgg = await ReadingSession.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$lastWordIndex' } } }
    ])
    const totalWordsRead: number = wordAgg[0]?.total ?? 0

    const booksUploaded = await Book.countDocuments({ userId })

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

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    // Last 365 days of activity for the heatmap
    const since = new Date()
    since.setDate(since.getDate() - 364)
    const sinceStr = since.toISOString().slice(0, 10)

    const activityDocs = await DailyActivity.find({
      userId,
      date: { $gte: sinceStr }
    }).lean()

    // Map date -> wordsRead
    const heatmap: Record<string, number> = {}
    for (const doc of activityDocs) {
      heatmap[doc.date] = doc.wordsRead
    }

    // Streak calculation — consecutive days up to today with activity
    const today = new Date().toISOString().slice(0, 10)
    let streak = 0
    const cursor = new Date()
    while (true) {
      const d = cursor.toISOString().slice(0, 10)
      if (heatmap[d] && heatmap[d] > 0) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else if (d === today) {
        // Haven't read today yet — check yesterday before breaking
        cursor.setDate(cursor.getDate() - 1)
        const yesterday = cursor.toISOString().slice(0, 10)
        if (heatmap[yesterday] && heatmap[yesterday] > 0) {
          // streak continues from yesterday
          continue
        }
        break
      } else {
        break
      }
    }

    // Total words read (all time)
    const wordAgg = await ReadingSession.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$lastWordIndex' } } }
    ])
    const totalWordsRead: number = wordAgg[0]?.total ?? 0

    const booksUploaded = await Book.countDocuments({ userId })

    res.json({ heatmap, streak, totalWordsRead, booksUploaded })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
