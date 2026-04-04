import { Request, Response } from 'express'
import Book from '../models/Book'

export async function getPublicBooks(_req: Request, res: Response): Promise<void> {
  try {
    const books = await Book.find({ isPublic: true })
      .select('-words -pdfData')
      .sort({ createdAt: -1 })
      .limit(50)
      .populate<{ userId: { _id: unknown; name: string } }>('userId', '_id name')
    const result = books.map(b => ({
      _id: b._id,
      title: b.title,
      totalWords: b.totalWords,
      createdAt: b.createdAt,
      owner: b.userId
    }))
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
