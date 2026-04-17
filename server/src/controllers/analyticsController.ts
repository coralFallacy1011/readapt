import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../middleware/auth'
import ReadingSession from '../models/ReadingSession'
import DailyActivity from '../models/DailyActivity'
import Book from '../models/Book'

// ── helpers ──────────────────────────────────────────────────────────────────

function periodStart(period: string): Date {
  const d = new Date()
  if (period === 'month') d.setDate(d.getDate() - 30)
  else d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d
}

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

// ── Requirement 13.1 / 13.2 — WPM & velocity trends ─────────────────────────
export async function getTrends(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const period = req.query.period === 'month' ? 'month' : 'week'
    const since = periodStart(period)

    const sessions = await ReadingSession.find({
      userId: userObjectId,
      date: { $gte: since }
    })
      .select('date currentWPM readingVelocity')
      .sort({ date: 1 })
      .lean()

    const trends = sessions.map((s) => ({
      date: s.date,
      wpm: s.currentWPM,
      velocity: s.readingVelocity ?? 0
    }))

    res.json({ period, trends })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Requirement 13.3 — productive reading times ───────────────────────────────
export async function getProductiveTimes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    const sessions = await ReadingSession.find({ userId: userObjectId })
      .select('date currentWPM')
      .lean()

    // Aggregate average WPM by hour-of-day and day-of-week
    const byHour: Record<number, { totalWPM: number; count: number }> = {}
    const byDay: Record<number, { totalWPM: number; count: number }> = {}

    for (const s of sessions) {
      const d = new Date(s.date)
      const hour = d.getHours()
      const day = d.getDay() // 0=Sun … 6=Sat

      if (!byHour[hour]) byHour[hour] = { totalWPM: 0, count: 0 }
      byHour[hour].totalWPM += s.currentWPM
      byHour[hour].count += 1

      if (!byDay[day]) byDay[day] = { totalWPM: 0, count: 0 }
      byDay[day].totalWPM += s.currentWPM
      byDay[day].count += 1
    }

    const hourlyAvg = Object.entries(byHour).map(([h, v]) => ({
      hour: Number(h),
      avgWPM: Math.round(v.totalWPM / v.count)
    }))

    const dailyAvg = Object.entries(byDay).map(([d, v]) => ({
      day: Number(d),
      avgWPM: Math.round(v.totalWPM / v.count)
    }))

    res.json({ hourlyAvg, dailyAvg })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Requirement 13.4 — session stats ─────────────────────────────────────────
export async function getSessionStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    const agg = await ReadingSession.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalTime: { $sum: '$timeSpent' },
          avgTime: { $avg: '$timeSpent' },
          sessionCount: { $sum: 1 }
        }
      }
    ])

    const stats = agg[0] ?? { totalTime: 0, avgTime: 0, sessionCount: 0 }

    res.json({
      totalReadingTime: Math.round(stats.totalTime),       // seconds
      avgSessionDuration: Math.round(stats.avgTime ?? 0),  // seconds
      sessionCount: stats.sessionCount
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Requirement 13.6 — words read by genre ────────────────────────────────────
export async function getGenreStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)

    const sessions = await ReadingSession.find({ userId: userObjectId })
      .select('bookId lastWordIndex')
      .lean()

    // Group words by bookId first
    const wordsByBook: Record<string, number> = {}
    for (const s of sessions) {
      const key = s.bookId.toString()
      wordsByBook[key] = (wordsByBook[key] ?? 0) + s.lastWordIndex
    }

    const bookIds = Object.keys(wordsByBook).map((id) => new mongoose.Types.ObjectId(id))
    const books = await Book.find({ _id: { $in: bookIds } })
      .select('_id genre')
      .lean()

    const genreMap: Record<string, number> = {}
    for (const book of books) {
      const genre = book.genre ?? 'Unknown'
      const words = wordsByBook[book._id.toString()] ?? 0
      genreMap[genre] = (genreMap[genre] ?? 0) + words
    }

    const genres = Object.entries(genreMap).map(([genre, wordsRead]) => ({ genre, wordsRead }))

    res.json({ genres })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Requirement 13.7 — calendar heatmap ──────────────────────────────────────
export async function getHeatmap(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const since = new Date()
    since.setDate(since.getDate() - 364)
    const sinceStr = since.toISOString().slice(0, 10)

    const activityDocs = await DailyActivity.find({
      userId,
      date: { $gte: sinceStr }
    })
      .select('date wordsRead')
      .lean()

    const heatmap: Record<string, number> = {}
    for (const doc of activityDocs) {
      heatmap[doc.date] = doc.wordsRead
    }

    res.json({ heatmap })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Requirement 13.2 — period-over-period comparison ─────────────────────────
export async function getComparison(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const period = req.query.period === 'month' ? 'month' : 'week'
    const days = period === 'month' ? 30 : 7

    const now = new Date()
    const currentStart = new Date(now)
    currentStart.setDate(currentStart.getDate() - days)
    currentStart.setHours(0, 0, 0, 0)

    const previousStart = new Date(currentStart)
    previousStart.setDate(previousStart.getDate() - days)

    const aggregate = async (from: Date, to: Date) => {
      const agg = await ReadingSession.aggregate([
        { $match: { userId: userObjectId, date: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: null,
            totalWords: { $sum: '$lastWordIndex' },
            avgWPM: { $avg: '$currentWPM' },
            totalTime: { $sum: '$timeSpent' },
            sessions: { $sum: 1 }
          }
        }
      ])
      return agg[0] ?? { totalWords: 0, avgWPM: 0, totalTime: 0, sessions: 0 }
    }

    const [current, previous] = await Promise.all([
      aggregate(currentStart, now),
      aggregate(previousStart, currentStart)
    ])

    const pct = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)

    res.json({
      period,
      current: {
        totalWords: current.totalWords,
        avgWPM: Math.round(current.avgWPM ?? 0),
        totalTime: Math.round(current.totalTime),
        sessions: current.sessions
      },
      previous: {
        totalWords: previous.totalWords,
        avgWPM: Math.round(previous.avgWPM ?? 0),
        totalTime: Math.round(previous.totalTime),
        sessions: previous.sessions
      },
      changes: {
        totalWordsPct: pct(current.totalWords, previous.totalWords),
        avgWPMPct: pct(current.avgWPM ?? 0, previous.avgWPM ?? 0),
        totalTimePct: pct(current.totalTime, previous.totalTime),
        sessionsPct: pct(current.sessions, previous.sessions)
      }
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
