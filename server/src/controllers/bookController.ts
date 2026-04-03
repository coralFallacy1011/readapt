import { Response } from 'express'
import multer from 'multer'
import { AuthRequest } from '../middleware/auth'
import { extractTextFromPDF } from '../utils/pdfExtractor'
import { cleanText } from '../utils/textCleaner'
import Book from '../models/Book'

// Multer: memory storage, PDF only
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are accepted'))
    }
  }
})

export async function uploadBook(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Only PDF files are accepted' })
    return
  }

  try {
    const rawText = await extractTextFromPDF(req.file.buffer)
    const words = cleanText(rawText)

    const title = req.file.originalname.replace(/\.pdf$/i, '')
    const book = await Book.create({
      userId: req.user!.id,
      title,
      totalWords: words.length,
      words
    })

    res.status(201).json({ book })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (message === 'Could not extract text from PDF') {
      res.status(422).json({ error: message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export async function getAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    const books = await Book.find({ userId: req.user!.id }).select('-words')
    res.json({ books })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id)
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.json({ book })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
