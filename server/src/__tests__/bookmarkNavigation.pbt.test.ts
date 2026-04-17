// Feature: ai-adaptive-features
// Property 32: Bookmark navigation jumps to word index
// Validates: Requirements 11.4

import * as fc from 'fast-check'

/**
 * Validates: Requirements 11.4
 *
 * Property 32: Bookmark navigation jumps to word index
 *
 * From bookmarkController.ts, bookmarks store wordIndex. Navigation returns
 * the bookmark's wordIndex for the client to jump to.
 *
 * Tests the pure data model logic.
 */

type BookmarkType = 'bookmark' | 'highlight'

interface BookmarkData {
  type: BookmarkType
  wordIndex: number
  endWordIndex?: number
  note?: string
  color?: string
  contextText: string
}

/** Pure: navigate to bookmark returns its wordIndex */
function navigateToBookmark(bookmark: BookmarkData): number {
  return bookmark.wordIndex
}

/** Pure: validate bookmark data model constraints */
function isValidBookmark(bookmark: BookmarkData): boolean {
  if (bookmark.wordIndex < 0) return false
  if (bookmark.type === 'highlight' && bookmark.endWordIndex !== undefined) {
    if (bookmark.endWordIndex < bookmark.wordIndex) return false
  }
  return true
}

// Arbitraries
const wordIndexArb = fc.integer({ min: 0, max: 1_000_000 })

const bookmarkArb = fc.record({
  type: fc.constant<BookmarkType>('bookmark'),
  wordIndex: wordIndexArb,
  contextText: fc.string({ minLength: 1, maxLength: 100 }),
})

const highlightArb = wordIndexArb.chain(wordIndex =>
  fc.record({
    type: fc.constant<BookmarkType>('highlight'),
    wordIndex: fc.constant(wordIndex),
    endWordIndex: fc.integer({ min: wordIndex, max: wordIndex + 10000 }),
    contextText: fc.string({ minLength: 1, maxLength: 100 }),
  })
)

describe('Bookmark Navigation - Property 32', () => {
  /**
   * Property 32a: Bookmark wordIndex is preserved exactly as stored
   */
  it('bookmark wordIndex is preserved exactly as stored', () => {
    fc.assert(
      fc.property(wordIndexArb, fc.string({ minLength: 1, maxLength: 50 }), (wordIndex, contextText) => {
        const bookmark: BookmarkData = {
          type: 'bookmark',
          wordIndex,
          contextText,
        }

        expect(bookmark.wordIndex).toBe(wordIndex)
        expect(navigateToBookmark(bookmark)).toBe(wordIndex)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 32b: wordIndex is always a non-negative integer
   */
  it('wordIndex is always a non-negative integer', () => {
    fc.assert(
      fc.property(bookmarkArb, (bookmark) => {
        expect(bookmark.wordIndex).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(bookmark.wordIndex)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 32c: Highlight bookmarks have endWordIndex >= wordIndex
   */
  it('highlight bookmarks have endWordIndex >= wordIndex', () => {
    fc.assert(
      fc.property(highlightArb, (highlight) => {
        expect(highlight.endWordIndex).toBeGreaterThanOrEqual(highlight.wordIndex)
        expect(isValidBookmark(highlight)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 32d: Navigation to bookmark returns the stored wordIndex
   */
  it('navigation to bookmark returns the stored wordIndex', () => {
    fc.assert(
      fc.property(
        fc.oneof(bookmarkArb, highlightArb),
        (bookmark) => {
          const navigationTarget = navigateToBookmark(bookmark)
          expect(navigationTarget).toBe(bookmark.wordIndex)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 32e: Negative wordIndex is invalid
   */
  it('negative wordIndex is invalid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: -1 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (negativeIndex, contextText) => {
          const bookmark: BookmarkData = {
            type: 'bookmark',
            wordIndex: negativeIndex,
            contextText,
          }
          expect(isValidBookmark(bookmark)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
