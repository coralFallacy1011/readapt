import { Response } from 'express'
import multer from 'multer'
import { AuthRequest } from '../middleware/auth'
import { extractTextWithPageCounts } from '../utils/pdfExtractor'
import { cleanText } from '../utils/textCleaner'
import Book from '../models/Book'

// Multer: memory storage, PDF only, max 20MB
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
    const { text: rawText, pageWordCounts } = await extractTextWithPageCounts(req.file.buffer)
    const words = cleanText(rawText)
    const title = req.file.originalname.replace(/\.pdf$/i, '')

    const book = await Book.create({
      userId: req.user!.id,
      title,
      totalWords: words.length,
      words,
      pdfData: req.file.buffer,
      pageWordCounts
    })

    // Return book without the heavy fields
    res.status(201).json({
      book: {
        _id: book._id,
        title: book.title,
        totalWords: book.totalWords,
        createdAt: book.createdAt,
      }
    })
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
    const books = await Book.find({ userId: req.user!.id }).select('-words -pdfData')
    res.json({ books })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function toggleVisibility(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('-words -pdfData')
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    book.isPublic = !book.isPublic
    await book.save()
    res.json({ book })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('-pdfData')
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    res.json({ book })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
// Serve the raw PDF bytes — used by the reader's PDF viewer
export async function getPDF(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('userId pdfData')
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    if (!book.pdfData) { res.status(404).json({ error: 'PDF not stored — re-upload the document' }); return }

    // Mongoose returns Buffer fields as Buffer (Node.js), send directly
    const pdfBuffer = Buffer.isBuffer(book.pdfData)
      ? book.pdfData
      : Buffer.from(book.pdfData as unknown as ArrayBuffer)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.end(pdfBuffer)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
