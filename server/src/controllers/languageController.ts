import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import Book from '../models/Book'

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar']

// Simple heuristic word lists for common languages
const LANGUAGE_HINTS: Record<string, string[]> = {
  es: ['el', 'la', 'los', 'las', 'de', 'en', 'que', 'es', 'un', 'una', 'con', 'por', 'para', 'como', 'pero'],
  fr: ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est', 'en', 'que', 'qui', 'dans', 'pour'],
  de: ['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'in', 'von', 'mit', 'auf', 'für', 'nicht', 'sich'],
  it: ['il', 'la', 'i', 'le', 'di', 'un', 'una', 'e', 'è', 'in', 'che', 'per', 'con', 'del', 'della'],
}

export async function detectLanguage(req: AuthRequest, res: Response): Promise<void> {
  const { text } = req.body as { text?: string }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const words = text.toLowerCase().split(/\s+/)
  const scores: Record<string, number> = {}

  for (const [lang, hints] of Object.entries(LANGUAGE_HINTS)) {
    const matches = words.filter(w => hints.includes(w)).length
    scores[lang] = matches / words.length
  }

  const bestLang = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  const detected = bestLang && bestLang[1] > 0.05 ? bestLang[0] : 'en'
  const confidence = bestLang && bestLang[1] > 0.05 ? Math.min(0.5 + bestLang[1] * 2, 0.99) : 0.8

  res.json({ languageCode: detected, confidence: Math.round(confidence * 100) / 100 })
}

export async function updateBookLanguage(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { language } = req.body as { language?: string }

  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    res.status(400).json({ error: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` })
    return
  }

  const book = await Book.findOne({ _id: id, userId: req.user!.id })
  if (!book) {
    res.status(404).json({ error: 'Book not found' })
    return
  }

  book.language = language
  await book.save()

  res.json(book)
}
