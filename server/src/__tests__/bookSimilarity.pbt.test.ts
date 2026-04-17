import * as fc from 'fast-check'
import { calculateBookSimilarity } from '../services/ml/recommendationEngine'
import { IBook } from '../models/Book'
import { Types } from 'mongoose'

/**
 * Property-Based Tests for Book Similarity Calculation
 * Feature: ai-adaptive-features
 */

describe('Book Similarity Property-Based Tests', () => {
  /**
   * Property 10: Book similarity calculation formula
   * **Validates: Requirements 3.2**
   *
   * The book similarity formula must correctly weight:
   * - Genre match: 40% weight
   * - Word count similarity (within ±30%): 30% weight
   * - Complexity similarity (within ±20%): 30% weight
   *
   * This property verifies that the formula components are correctly calculated
   * and combined according to the specification.
   */
  describe('Property 10: Book similarity calculation formula', () => {
    // Helper to create a mock book
    const createMockBook = (overrides: Partial<IBook> = {}): IBook => {
      return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        title: 'Test Book',
        totalWords: 50000,
        words: [],
        format: 'pdf',
        fileUrl: 'https://example.com/book.pdf',
        fileSize: 1000000,
        language: 'en',
        averageWordLength: 5,
        complexityScore: 0.5,
        isCompleted: false,
        isAvailableOffline: false,
        isPublic: false,
        createdAt: new Date(),
        genre: 'fiction',
        ...overrides
      } as IBook
    }

    it('should return at least 0.4 when genres match', () => {
      // Generators for book properties
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance')
      const wordCountGen = fc.integer({ min: 10000, max: 200000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(genreGen, wordCountGen, wordCountGen, complexityGen, complexityGen, 
          (genre, wordCount1, wordCount2, complexity1, complexity2) => {
            const book1 = createMockBook({
              genre,
              totalWords: wordCount1,
              complexityScore: complexity1
            })
            const book2 = createMockBook({
              genre,
              totalWords: wordCount2,
              complexityScore: complexity2
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // Genre match contributes 0.4, other components add more
            // Minimum should be 0.4 when genres match
            return similarity >= 0.4
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should calculate word count similarity component correctly (30% weight)', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science')
      const baseWordCountGen = fc.integer({ min: 30000, max: 100000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(genreGen, baseWordCountGen, complexityGen, complexityGen,
          (genre, baseWordCount, complexity1, complexity2) => {
            // Ensure complexities are different to isolate word count effect
            fc.pre(Math.abs(complexity1 - complexity2) > 0.3)

            // Create books with identical word counts
            const book1 = createMockBook({
              genre,
              totalWords: baseWordCount,
              complexityScore: complexity1
            })
            const book2 = createMockBook({
              genre,
              totalWords: baseWordCount,
              complexityScore: complexity2
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // Genre (0.4) + Word count perfect match (0.3) + complexity diff
            // Should be at least 0.7 (genre + word count)
            return similarity >= 0.7
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should calculate complexity similarity component correctly (30% weight)', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science')
      const wordCountGen = fc.integer({ min: 30000, max: 100000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(genreGen, wordCountGen, wordCountGen, complexityGen,
          (genre, wordCount1, wordCount2, complexity) => {
            // Ensure word counts are different to isolate complexity effect
            fc.pre(Math.abs(wordCount1 - wordCount2) > 0.3 * Math.max(wordCount1, wordCount2))

            // Create books with identical complexity
            const book1 = createMockBook({
              genre,
              totalWords: wordCount1,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre,
              totalWords: wordCount2,
              complexityScore: complexity
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // Genre (0.4) + complexity perfect match (0.3) + word count diff
            // Should be at least 0.7 (genre + complexity)
            return similarity >= 0.7
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 1.0 for identical books (all components match)', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance')
      const wordCountGen = fc.integer({ min: 10000, max: 200000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(genreGen, wordCountGen, complexityGen,
          (genre, wordCount, complexity) => {
            const book1 = createMockBook({
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // All components match: 0.4 + 0.3 + 0.3 = 1.0
            return Math.abs(similarity - 1.0) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be symmetric (order-independent)', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance')
      const wordCountGen = fc.integer({ min: 10000, max: 200000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(
          genreGen, genreGen, wordCountGen, wordCountGen, complexityGen, complexityGen,
          (genre1, genre2, wordCount1, wordCount2, complexity1, complexity2) => {
            const book1 = createMockBook({
              genre: genre1,
              totalWords: wordCount1,
              complexityScore: complexity1
            })
            const book2 = createMockBook({
              genre: genre2,
              totalWords: wordCount2,
              complexityScore: complexity2
            })

            const similarity1 = calculateBookSimilarity(book1, book2)
            const similarity2 = calculateBookSimilarity(book2, book1)

            // Similarity should be symmetric
            return Math.abs(similarity1 - similarity2) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always return a value between 0 and 1', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance', undefined)
      const wordCountGen = fc.integer({ min: 1, max: 1000000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(
          genreGen, genreGen, wordCountGen, wordCountGen, complexityGen, complexityGen,
          (genre1, genre2, wordCount1, wordCount2, complexity1, complexity2) => {
            const book1 = createMockBook({
              genre: genre1,
              totalWords: wordCount1,
              complexityScore: complexity1
            })
            const book2 = createMockBook({
              genre: genre2,
              totalWords: wordCount2,
              complexityScore: complexity2
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // Similarity must be in [0, 1]
            return similarity >= 0 && similarity <= 1
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should weight genre match at 40% of total score', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance')
      const wordCountGen = fc.integer({ min: 50000, max: 100000 })
      const complexityGen = fc.double({ min: 0.4, max: 0.6, noNaN: true })

      fc.assert(
        fc.property(genreGen, wordCountGen, complexityGen,
          (genre, wordCount, complexity) => {
            // Create two books with same genre but different other properties
            const book1 = createMockBook({
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre, // Same genre
              totalWords: wordCount * 2, // Very different word count
              complexityScore: complexity + 0.3 // Different complexity
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // With same genre, minimum contribution is 0.4
            // Other components will add some value
            return similarity >= 0.4
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle edge case with zero word count gracefully', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science')
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(genreGen, complexityGen,
          (genre, complexity) => {
            const book1 = createMockBook({
              genre,
              totalWords: 0,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre,
              totalWords: 50000,
              complexityScore: complexity
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // Should not throw and should return a valid number
            return !isNaN(similarity) && similarity >= 0 && similarity <= 1
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly combine all three components (40% + 30% + 30%)', () => {
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery')
      const wordCountGen = fc.integer({ min: 40000, max: 60000 })
      const complexityGen = fc.double({ min: 0.4, max: 0.6, noNaN: true })

      fc.assert(
        fc.property(genreGen, wordCountGen, complexityGen,
          (genre, wordCount, complexity) => {
            // Create very similar books (all components should contribute)
            const book1 = createMockBook({
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre, // Same genre: +0.4
              totalWords: Math.round(wordCount * 1.05), // Very similar word count: ~0.3
              complexityScore: complexity + 0.05 // Very similar complexity: ~0.3
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // All components contribute positively, should be close to 1.0
            return similarity >= 0.9 && similarity <= 1.0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle books with no genre (undefined) consistently', () => {
      const wordCountGen = fc.integer({ min: 30000, max: 100000 })
      const complexityGen = fc.double({ min: 0.0, max: 1.0, noNaN: true })

      fc.assert(
        fc.property(wordCountGen, complexityGen,
          (wordCount, complexity) => {
            const book1 = createMockBook({
              genre: undefined,
              totalWords: wordCount,
              complexityScore: complexity
            })
            const book2 = createMockBook({
              genre: undefined,
              totalWords: wordCount,
              complexityScore: complexity
            })

            const similarity = calculateBookSimilarity(book1, book2)

            // undefined === undefined should be treated as a match
            // Should return 1.0 for identical books
            return Math.abs(similarity - 1.0) < 0.001
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
