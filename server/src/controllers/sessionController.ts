import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import ReadingSession from '../models/ReadingSession'

export async function updateSession(req: AuthRequest, res: Response): Promise<void> {
  const { bookId, lastWordIndex, currentWPM, timeSpent } = req.body

  if (!bookId) { res.status(400).json({ error: 'bookId is required' }); return }
  if (lastWordIndex === undefined) { res.status(400).json({ error: 'lastWordIndex is required' }); return }
  if (!currentWPM) { res.status(400).json({ error: 'currentWPM is required' }); return }
  if (timeSpent === undefined) { res.status(400).json({ error: 'timeSpent is required' }); return }

  try {
    const session = await ReadingSession.findOneAndUpdate(
      { userId: req.user!.id, bookId },
      { lastWordIndex, currentWPM, timeSpent, date: new Date() },
      { upsert: true, new: true }
    )
    res.json({ session })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getSessionByBook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const session = await ReadingSession.findOne({
      userId: req.user!.id,
      bookId: req.params.bookId
    })
    res.json({ session: session ?? null })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
