import { Response } from 'express'
import multer from 'multer'
import { AuthRequest } from '../middleware/auth'
import { extractTextWithPageCounts } from '../utils/pdfExtractor'
import { cleanText } from '../utils/textCleaner'
import Book from '../models/Book'
import { extractEPUB } from '../services/epub/epubProcessor'

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

// Multer: memory storage, EPUB only, max 50MB
export const uploadEpub = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/epub+zip' ||
      file.originalname.toLowerCase().endsWith('.epub')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Only EPUB files are accepted'))
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

    // Calculate average word length
    const totalLength = words.reduce((sum, word) => sum + word.length, 0)
    const averageWordLength = words.length > 0 ? totalLength / words.length : 0

    // Calculate complexity score (0.0-1.0) based on average word length
    const complexityScore = Math.min(1.0, averageWordLength / 10)

    const book = await Book.create({
      userId: req.user!.id,
      title,
      totalWords: words.length,
      words,
      pdfData: req.file.buffer,
      pageWordCounts,
      format: 'pdf',
      fileUrl: '',  // Will be populated when S3 integration is added
      fileSize: req.file.buffer.length,
      language: 'en',  // Default to English, will be auto-detected in future
      averageWordLength,
      complexityScore,
      isCompleted: false,
      isAvailableOffline: false
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

// POST /api/books/upload/epub — Requirement 5.1
export async function uploadEPUB(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Only EPUB files are accepted' })
    return
  }

  try {
    const epubData = await extractEPUB(req.file.buffer)

    // Flatten all chapter text into a word array
    const allText = epubData.chapters.map(c => c.text).join(' ')
    const words = cleanText(allText)

    // Calculate metadata
    const totalLength = words.reduce((sum, word) => sum + word.length, 0)
    const averageWordLength = words.length > 0 ? totalLength / words.length : 0
    const complexityScore = Math.min(1.0, averageWordLength / 10)

    // Build chapter word-index boundaries
    let wordOffset = 0
    const chapters = epubData.chapters.map(ch => {
      const chWords = cleanText(ch.text)
      const startWordIndex = wordOffset
      const endWordIndex = wordOffset + chWords.length - 1
      wordOffset += chWords.length
      return { title: ch.title, startWordIndex, endWordIndex }
    })

    // Mock S3 URL — replace with real S3 upload when storage service is wired
    const fileUrl = `https://s3.amazonaws.com/speedreader-books/${req.user!.id}/${Date.now()}-${req.file.originalname}`

    const book = await Book.create({
      userId: req.user!.id,
      title: epubData.title,
      author: epubData.author,
      totalWords: words.length,
      words,
      format: 'epub',
      fileUrl,
      fileSize: req.file.buffer.length,
      language: epubData.language,
      averageWordLength,
      complexityScore,
      chapters,
      isCompleted: false,
      isAvailableOffline: false,
    })

    res.status(201).json({
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        format: book.format,
        fileUrl: book.fileUrl,
        fileSize: book.fileSize,
        totalWords: book.totalWords,
        language: book.language,
        chapters: book.chapters,
        createdAt: book.createdAt,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    if (
      message.includes('corrupted') ||
      message.includes('Invalid EPUB') ||
      message.includes('no readable text')
    ) {
      res.status(422).json({ error: message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

// GET /api/books/:id/chapters — Requirement 5.1
export async function getChapters(req: AuthRequest, res: Response): Promise<void> {
  try {
    const book = await Book.findById(req.params.id).select('userId chapters format')
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (book.userId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    res.json({ chapters: book.chapters ?? [] })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
