import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import Bookmark from '../models/Bookmark'

export async function getBookmarks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { bookId } = req.params
    const bookmarks = await Bookmark.find({ userId: req.user!.id, bookId }).sort({ wordIndex: 1 })
    res.json(bookmarks)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createBookmark(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { bookId, type, wordIndex, endWordIndex, note, color, contextText } = req.body

    if (!bookId || !type || wordIndex === undefined || !contextText) {
      res.status(400).json({ error: 'Missing required fields: bookId, type, wordIndex, contextText' })
      return
    }

    if (!['bookmark', 'highlight'].includes(type)) {
      res.status(400).json({ error: 'type must be bookmark or highlight' })
      return
    }

    const bookmark = await Bookmark.create({
      userId: req.user!.id,
      bookId,
      type,
      wordIndex,
      endWordIndex,
      note,
      color,
      contextText,
    })

    res.status(201).json(bookmark)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function deleteBookmark(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const result = await Bookmark.deleteOne({ _id: id, userId: req.user!.id })

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Bookmark not found' })
      return
    }

    res.json({ message: 'Deleted' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
