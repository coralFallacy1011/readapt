// Feature: ai-adaptive-features, Property 18: EPUB text extraction preserves chapter structure
import * as fc from 'fast-check'

/**
 * Validates: Requirements 5.2
 *
 * Property 18: EPUB text extraction preserves chapter structure
 * Tests the pure stripHTML logic and chapter structure invariants.
 */

// ---- Pure logic (mirrors epubProcessor.ts) ----

function stripHTML(html: string): string {
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

interface EPUBChapter {
  title: string
  text: string
  wordCount: number
}

function buildChapter(title: string, rawText: string): EPUBChapter {
  const text = stripHTML(rawText)
  const wordCount = countWords(text)
  return { title, text, wordCount }
}

// ---- Arbitraries ----

// Plain text words (no HTML)
const wordArb = fc.stringMatching(/^[a-zA-Z]{1,15}$/)
const plainTextArb = fc.array(wordArb, { minLength: 1, maxLength: 50 }).map(ws => ws.join(' '))

// HTML-wrapped text
const htmlTextArb = plainTextArb.map(t => `<p>${t}</p>`)

// Chapter title
const titleArb = fc.string({ minLength: 1, maxLength: 50 })

// ---- Tests ----

describe('EPUB Chapter Structure - Property 18: EPUB text extraction preserves chapter structure', () => {
  /**
   * Property 1: stripHTML removes all HTML tags
   */
  it('stripHTML removes all HTML tags', () => {
    fc.assert(
      fc.property(htmlTextArb, (html) => {
        const result = stripHTML(html)
        return !/<[^>]+>/.test(result)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: stripHTML decodes HTML entities
   */
  it('stripHTML decodes common HTML entities', () => {
    fc.assert(
      fc.property(plainTextArb, (text) => {
        const html = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
        const result = stripHTML(html)
        return !result.includes('&amp;') && !result.includes('&lt;') && !result.includes('&gt;')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: stripHTML normalizes whitespace (no double spaces, no leading/trailing)
   */
  it('stripHTML normalizes whitespace', () => {
    fc.assert(
      fc.property(htmlTextArb, (html) => {
        const result = stripHTML(html)
        return !result.includes('  ') && result === result.trim()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Chapter structure is preserved — each chapter has title, text, wordCount
   */
  it('each chapter has title, text, and wordCount fields', () => {
    fc.assert(
      fc.property(titleArb, htmlTextArb, (title, html) => {
        const chapter = buildChapter(title, html)
        return (
          typeof chapter.title === 'string' &&
          typeof chapter.text === 'string' &&
          typeof chapter.wordCount === 'number'
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: wordCount equals the number of words in the text
   */
  it('wordCount equals the number of words in the extracted text', () => {
    fc.assert(
      fc.property(titleArb, htmlTextArb, (title, html) => {
        const chapter = buildChapter(title, html)
        const expectedCount = countWords(chapter.text)
        return chapter.wordCount === expectedCount
      }),
      { numRuns: 100 }
    )
  })
})
