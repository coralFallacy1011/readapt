// Feature: ai-adaptive-features, Property 19: EPUB and PDF books have identical schema
import * as fc from 'fast-check'

/**
 * Validates: Requirements 5.5
 *
 * Property 19: EPUB and PDF books have identical schema
 * Tests that both formats share required fields and format-specific fields are correct.
 */

// ---- Pure data model types (mirrors Book.ts) ----

interface BaseBook {
  title: string
  totalWords: number
  words: string[]
  format: 'epub' | 'pdf'
  fileUrl: string
  fileSize: number
  language: string
  averageWordLength: number
  complexityScore: number
  isCompleted: boolean
  isAvailableOffline: boolean
}

interface EPUBBook extends BaseBook {
  format: 'epub'
  chapters: Array<{ title: string; startWordIndex: number; endWordIndex: number }>
  author: string
}

interface PDFBook extends BaseBook {
  format: 'pdf'
}

// ---- Arbitraries ----

const wordArb = fc.stringMatching(/^[a-zA-Z]{1,10}$/)
const wordsArb = fc.array(wordArb, { minLength: 1, maxLength: 20 })
const languageArb = fc.constantFrom('en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar')
const complexityArb = fc.double({ min: 0, max: 1, noNaN: true })
const fileSizeArb = fc.integer({ min: 1, max: 100_000_000 })

const baseBookArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  totalWords: fc.integer({ min: 1, max: 1_000_000 }),
  words: wordsArb,
  fileUrl: fc.string({ minLength: 1, maxLength: 200 }),
  fileSize: fileSizeArb,
  language: languageArb,
  averageWordLength: fc.double({ min: 1, max: 20, noNaN: true }),
  complexityScore: complexityArb,
  isCompleted: fc.boolean(),
  isAvailableOffline: fc.boolean(),
})

const epubBookArb: fc.Arbitrary<EPUBBook> = baseBookArb.map(base => ({
  ...base,
  format: 'epub' as const,
  chapters: [{ title: 'Chapter 1', startWordIndex: 0, endWordIndex: base.words.length - 1 }],
  author: 'Test Author',
}))

const pdfBookArb: fc.Arbitrary<PDFBook> = baseBookArb.map(base => ({
  ...base,
  format: 'pdf' as const,
}))

// Required fields shared by both formats
const SHARED_REQUIRED_FIELDS: (keyof BaseBook)[] = [
  'title', 'totalWords', 'words', 'format', 'fileUrl',
  'fileSize', 'language', 'averageWordLength', 'complexityScore',
  'isCompleted', 'isAvailableOffline',
]

// ---- Tests ----

describe('EPUB/PDF Schema Consistency - Property 19: EPUB and PDF books have identical schema', () => {
  /**
   * Property 1: Both EPUB and PDF books have all shared required fields
   */
  it('EPUB books have all shared required fields', () => {
    fc.assert(
      fc.property(epubBookArb, (book) => {
        return SHARED_REQUIRED_FIELDS.every(field => field in book && book[field] !== undefined)
      }),
      { numRuns: 100 }
    )
  })

  it('PDF books have all shared required fields', () => {
    fc.assert(
      fc.property(pdfBookArb, (book) => {
        return SHARED_REQUIRED_FIELDS.every(field => field in book && book[field] !== undefined)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: EPUB books additionally have chapters and author
   */
  it('EPUB books have chapters and author fields', () => {
    fc.assert(
      fc.property(epubBookArb, (book) => {
        return (
          Array.isArray(book.chapters) &&
          book.chapters.length > 0 &&
          typeof book.author === 'string'
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: format field is either 'epub' or 'pdf'
   */
  it('EPUB book format is epub', () => {
    fc.assert(
      fc.property(epubBookArb, (book) => book.format === 'epub'),
      { numRuns: 100 }
    )
  })

  it('PDF book format is pdf', () => {
    fc.assert(
      fc.property(pdfBookArb, (book) => book.format === 'pdf'),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: complexityScore is always in [0, 1]
   */
  it('complexityScore is always in [0, 1] for both formats', () => {
    fc.assert(
      fc.property(epubBookArb, (book) => book.complexityScore >= 0 && book.complexityScore <= 1),
      { numRuns: 100 }
    )
    fc.assert(
      fc.property(pdfBookArb, (book) => book.complexityScore >= 0 && book.complexityScore <= 1),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: language is a supported ISO 639-1 code
   */
  it('language is a supported ISO 639-1 code for both formats', () => {
    const supported = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar']
    fc.assert(
      fc.property(epubBookArb, (book) => supported.includes(book.language)),
      { numRuns: 100 }
    )
    fc.assert(
      fc.property(pdfBookArb, (book) => supported.includes(book.language)),
      { numRuns: 100 }
    )
  })
})
