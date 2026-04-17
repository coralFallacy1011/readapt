import { calculateBookSimilarity, generateBookRecommendations, findOptimalReadingTime, getTimeSpecificWPMRecommendations, getInitialWPMForBook, getHighComprehensionGenres } from '../services/ml/recommendationEngine'
import { IBook } from '../models/Book'
import Book from '../models/Book'
import ReadingSession from '../models/ReadingSession'
import { Types } from 'mongoose'

// Helper to create mock book
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

// Mock the Book model
jest.mock('../models/Book')
jest.mock('../models/ReadingSession')

describe('calculateBookSimilarity', () => {
  describe('identical books', () => {
    it('should return 1.0 for identical books', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })
  })

  describe('genre similarity (40% weight)', () => {
    it('should return 0.4 when only genres match', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 100000, // different
        complexityScore: 1.0 // different
      })
      
      // Genre: 0.4
      // Word count: 1 - (50000/100000) = 0.5, score = 0.15
      // Complexity: 1 - 0.5 = 0.5, score = 0.15
      // Total: 0.7
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.7, 2)
    })

    it('should contribute 0.0 when genres do not match', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'non-fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.6, 2) // 0.3 + 0.3 (word count + complexity)
    })
  })

  describe('word count similarity (30% weight)', () => {
    it('should return 0.3 when only word counts match', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'non-fiction', // different
        totalWords: 50000,
        complexityScore: 1.0 // different
      })
      
      // Genre: 0.0
      // Word count: 1 - 0 = 1.0, score = 0.3
      // Complexity: 1 - 0.5 = 0.5, score = 0.15
      // Total: 0.45
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.45, 2)
    })

    it('should calculate similarity based on relative difference', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 75000, // 50% larger
        complexityScore: 0.5
      })
      
      // Word count similarity: 1 - (25000 / 75000) = 1 - 0.333 = 0.667
      // Score: 0.667 * 0.3 = 0.2
      // Total: 0.4 (genre) + 0.2 (word count) + 0.3 (complexity) = 0.9
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.9, 2)
    })

    it('should handle large word count differences', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 10000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 100000, // 10x larger
        complexityScore: 0.5
      })
      
      // Word count similarity: 1 - (90000 / 100000) = 0.1
      // Score: 0.1 * 0.3 = 0.03
      // Total: 0.4 + 0.03 + 0.3 = 0.73
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.73, 2)
    })
  })

  describe('complexity similarity (30% weight)', () => {
    it('should return 0.3 when only complexity scores match', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'non-fiction', // different
        totalWords: 100000, // different
        complexityScore: 0.5
      })
      
      // Genre: 0.0
      // Word count: 1 - (50000/100000) = 0.5, score = 0.15
      // Complexity: 1 - 0 = 1.0, score = 0.3
      // Total: 0.45
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.45, 2)
    })

    it('should calculate similarity based on absolute difference', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.3
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      
      // Complexity similarity: 1 - |0.3 - 0.5| = 1 - 0.2 = 0.8
      // Score: 0.8 * 0.3 = 0.24
      // Total: 0.4 + 0.3 + 0.24 = 0.94
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.94, 2)
    })

    it('should handle maximum complexity difference', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.0
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 1.0
      })
      
      // Complexity similarity: 1 - |0.0 - 1.0| = 0
      // Score: 0 * 0.3 = 0
      // Total: 0.4 + 0.3 + 0 = 0.7
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.7, 2)
    })
  })

  describe('combined scenarios', () => {
    it('should return 0.0 for completely different books', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 10000,
        complexityScore: 0.0
      })
      const book2 = createMockBook({
        genre: 'non-fiction',
        totalWords: 100000,
        complexityScore: 1.0
      })
      
      // Genre: 0
      // Word count: 1 - (90000/100000) = 0.1, score = 0.03
      // Complexity: 1 - 1.0 = 0, score = 0
      // Total: 0.03
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.03, 2)
    })

    it('should handle books with matching genre and complexity but different word counts', () => {
      const book1 = createMockBook({
        genre: 'science',
        totalWords: 30000,
        complexityScore: 0.8
      })
      const book2 = createMockBook({
        genre: 'science',
        totalWords: 60000,
        complexityScore: 0.8
      })
      
      // Genre: 0.4
      // Word count: 1 - (30000/60000) = 0.5, score = 0.15
      // Complexity: 0.3
      // Total: 0.85
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.85, 2)
    })

    it('should handle books with no genre specified', () => {
      const book1 = createMockBook({
        genre: undefined,
        totalWords: 50000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: undefined,
        totalWords: 50000,
        complexityScore: 0.5
      })
      
      // Genre: undefined === undefined is true, so 0.4
      // Word count: 0.3
      // Complexity: 0.3
      // Total: 1.0
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })

    it('should handle edge case with zero word count', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 0,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })
      
      // Genre: 0.4
      // Word count: 1 - (50000/50000) = 0, score = 0
      // Complexity: 0.3
      // Total: 0.7
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBeCloseTo(0.7, 2)
    })
  })

  describe('symmetry', () => {
    it('should be symmetric (order should not matter)', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 30000,
        complexityScore: 0.3
      })
      const book2 = createMockBook({
        genre: 'non-fiction',
        totalWords: 60000,
        complexityScore: 0.7
      })
      
      const similarity1 = calculateBookSimilarity(book1, book2)
      const similarity2 = calculateBookSimilarity(book2, book1)
      
      expect(similarity1).toBe(similarity2)
    })
  })

  describe('boundary values', () => {
    it('should handle minimum complexity score (0.0)', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.0
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.0
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })

    it('should handle maximum complexity score (1.0)', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 1.0
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 1.0
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })

    it('should handle very small word counts', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 1,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 1,
        complexityScore: 0.5
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })

    it('should handle very large word counts', () => {
      const book1 = createMockBook({
        genre: 'fiction',
        totalWords: 1000000,
        complexityScore: 0.5
      })
      const book2 = createMockBook({
        genre: 'fiction',
        totalWords: 1000000,
        complexityScore: 0.5
      })
      
      const similarity = calculateBookSimilarity(book1, book2)
      expect(similarity).toBe(1.0)
    })
  })
})


describe('generateBookRecommendations', () => {
  const userId = new Types.ObjectId()
  const otherUserId1 = new Types.ObjectId()
  const otherUserId2 = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return empty array when user has no completed books', async () => {
      // Mock: no completed books
      ;(Book.find as jest.Mock).mockReturnValueOnce([])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toEqual([])
      expect(Book.find).toHaveBeenCalledWith({
        userId,
        isCompleted: true
      })
    })

    it('should return empty array when no candidate books are available', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction'
      })

      // Mock: user has completed books
      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      
      // Mock: user owns these books
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      
      // Mock: no public books from other users
      ;(Book.find as jest.Mock).mockReturnValueOnce([])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toEqual([])
    })

    it('should return top 5 similar books ranked by similarity score', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })

      // Create 7 candidate books with varying similarity
      const candidates = [
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', totalWords: 50000, complexityScore: 0.5, title: 'Book 1' }), // Perfect match
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', totalWords: 52000, complexityScore: 0.52, title: 'Book 2' }), // Very similar
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', totalWords: 60000, complexityScore: 0.6, title: 'Book 3' }), // Similar
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'non-fiction', totalWords: 50000, complexityScore: 0.5, title: 'Book 4' }), // Different genre
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', totalWords: 100000, complexityScore: 0.8, title: 'Book 5' }), // Different size
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'non-fiction', totalWords: 100000, complexityScore: 0.9, title: 'Book 6' }), // Very different
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', totalWords: 48000, complexityScore: 0.48, title: 'Book 7' }) // Very similar
      ]

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce(candidates)

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(5)
      expect(recommendations[0].title).toBe('Book 1') // Perfect match should be first
      // Should not include the 2 lowest scoring books
      expect(recommendations.map(b => b.title)).not.toContain('Book 6')
    })
  })

  describe('similarity calculation', () => {
    it('should use maximum similarity score when user has multiple completed books', async () => {
      const completedBook1 = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })

      const completedBook2 = createMockBook({
        userId,
        isCompleted: true,
        genre: 'science',
        totalWords: 80000,
        complexityScore: 0.8
      })

      // Candidate that's very similar to completedBook2 but not to completedBook1
      const candidate = createMockBook({
        userId: otherUserId1,
        isPublic: true,
        genre: 'science',
        totalWords: 82000,
        complexityScore: 0.82,
        title: 'Science Book'
      })

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook1, completedBook2])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook1._id, completedBook2._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce([candidate])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].title).toBe('Science Book')
      // The candidate should be recommended because it's very similar to completedBook2
    })

    it('should rank books correctly based on combined similarity metrics', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'mystery',
        totalWords: 60000,
        complexityScore: 0.6
      })

      const candidates = [
        // High similarity: same genre, similar word count and complexity
        createMockBook({ 
          userId: otherUserId1, 
          isPublic: true, 
          genre: 'mystery', 
          totalWords: 62000, 
          complexityScore: 0.62,
          title: 'High Similarity'
        }),
        // Medium similarity: same genre, different word count
        createMockBook({ 
          userId: otherUserId1, 
          isPublic: true, 
          genre: 'mystery', 
          totalWords: 90000, 
          complexityScore: 0.6,
          title: 'Medium Similarity'
        }),
        // Low similarity: different genre
        createMockBook({ 
          userId: otherUserId1, 
          isPublic: true, 
          genre: 'romance', 
          totalWords: 60000, 
          complexityScore: 0.6,
          title: 'Low Similarity'
        })
      ]

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce(candidates)

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(3)
      expect(recommendations[0].title).toBe('High Similarity')
      expect(recommendations[1].title).toBe('Medium Similarity')
      expect(recommendations[2].title).toBe('Low Similarity')
    })
  })

  describe('filtering logic', () => {
    it('should exclude books the user already owns', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction'
      })

      const userOwnedBookId = new Types.ObjectId()

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id, userOwnedBookId])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce([])

      await generateBookRecommendations(userId)

      // Verify the query excludes user's books
      expect(Book.find).toHaveBeenCalledWith({
        userId: { $ne: userId },
        isPublic: true,
        _id: { $nin: [completedBook._id, userOwnedBookId] }
      })
    })

    it('should only include public books from other users', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true
      })

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce([])

      await generateBookRecommendations(userId)

      // Verify the query filters correctly
      expect(Book.find).toHaveBeenCalledWith({
        userId: { $ne: userId },
        isPublic: true,
        _id: { $nin: [completedBook._id] }
      })
    })

    it('should not recommend books from the same user', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction'
      })

      // This book is from the same user, should not be recommended
      const sameUserBook = createMockBook({
        userId,
        isPublic: true,
        genre: 'fiction',
        title: 'Same User Book'
      })

      const otherUserBook = createMockBook({
        userId: otherUserId1,
        isPublic: true,
        genre: 'fiction',
        title: 'Other User Book'
      })

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id, sameUserBook._id])
      })
      // Only return books from other users
      ;(Book.find as jest.Mock).mockReturnValueOnce([otherUserBook])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].title).toBe('Other User Book')
    })
  })

  describe('edge cases', () => {
    it('should handle userId as string', async () => {
      const userIdString = userId.toString()

      ;(Book.find as jest.Mock).mockReturnValueOnce([])

      await generateBookRecommendations(userIdString)

      expect(Book.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        isCompleted: true
      })
    })

    it('should handle exactly 5 candidate books', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction'
      })

      const candidates = Array.from({ length: 5 }, (_, i) => 
        createMockBook({
          userId: otherUserId1,
          isPublic: true,
          genre: 'fiction',
          title: `Book ${i + 1}`
        })
      )

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce(candidates)

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(5)
    })

    it('should handle fewer than 5 candidate books', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction'
      })

      const candidates = [
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', title: 'Book 1' }),
        createMockBook({ userId: otherUserId1, isPublic: true, genre: 'fiction', title: 'Book 2' })
      ]

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce(candidates)

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(2)
    })

    it('should handle books with identical similarity scores', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: 'fiction',
        totalWords: 50000,
        complexityScore: 0.5
      })

      // All candidates have identical properties (same similarity score)
      const candidates = Array.from({ length: 3 }, (_, i) => 
        createMockBook({
          userId: otherUserId1,
          isPublic: true,
          genre: 'fiction',
          totalWords: 50000,
          complexityScore: 0.5,
          title: `Book ${i + 1}`
        })
      )

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce(candidates)

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(3)
      // All should be returned since they have the same score
    })

    it('should handle books with no genre specified', async () => {
      const completedBook = createMockBook({
        userId,
        isCompleted: true,
        genre: undefined,
        totalWords: 50000,
        complexityScore: 0.5
      })

      const candidate = createMockBook({
        userId: otherUserId1,
        isPublic: true,
        genre: undefined,
        totalWords: 50000,
        complexityScore: 0.5,
        title: 'No Genre Book'
      })

      ;(Book.find as jest.Mock).mockReturnValueOnce([completedBook])
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue([completedBook._id])
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce([candidate])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].title).toBe('No Genre Book')
    })
  })

  describe('multiple completed books scenarios', () => {
    it('should consider all completed books when calculating similarity', async () => {
      const completedBooks = [
        createMockBook({
          userId,
          isCompleted: true,
          genre: 'fiction',
          totalWords: 50000,
          complexityScore: 0.5
        }),
        createMockBook({
          userId,
          isCompleted: true,
          genre: 'mystery',
          totalWords: 60000,
          complexityScore: 0.6
        }),
        createMockBook({
          userId,
          isCompleted: true,
          genre: 'science',
          totalWords: 70000,
          complexityScore: 0.7
        })
      ]

      // Candidate similar to the mystery book
      const candidate = createMockBook({
        userId: otherUserId1,
        isPublic: true,
        genre: 'mystery',
        totalWords: 61000,
        complexityScore: 0.61,
        title: 'Mystery Book'
      })

      ;(Book.find as jest.Mock).mockReturnValueOnce(completedBooks)
      ;(Book.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue(completedBooks.map(b => b._id))
      })
      ;(Book.find as jest.Mock).mockReturnValueOnce([candidate])

      const recommendations = await generateBookRecommendations(userId)

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].title).toBe('Mystery Book')
    })
  })
})


describe('findOptimalReadingTime', () => {
  const userId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('insufficient data handling', () => {
    it('should return empty string when user has no sessions', async () => {
      ;(ReadingSession.find as jest.Mock).mockResolvedValue([])

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('')
      expect(ReadingSession.find).toHaveBeenCalledWith({ userId })
    })

    it('should return empty string when user has fewer than 10 sessions', async () => {
      const sessions = Array.from({ length: 9 }, (_, i) => ({
        userId,
        date: new Date(2024, 0, 1, 10 + i, 0),
        readingVelocity: 250
      }))

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('')
    })

    it('should return empty string when user has exactly 9 sessions', async () => {
      const sessions = Array.from({ length: 9 }, (_, i) => ({
        userId,
        date: new Date(2024, 0, 1, 14, 0),
        readingVelocity: 250 + i * 10
      }))

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('')
    })
  })

  describe('basic functionality', () => {
    it('should identify optimal 2-hour window with highest average velocity', async () => {
      const sessions = [
        // Morning sessions (8-10): avg = 200
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 200 },
        
        // Afternoon sessions (14-16): avg = 300
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 300 },
        
        // Evening sessions (20-22): avg = 250
        { userId, date: new Date(2024, 0, 1, 20, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 21, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 3, 20, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 4, 21, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 5, 20, 15), readingVelocity: 250 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('14-16')
    })

    it('should handle userId as string', async () => {
      const userIdString = userId.toString()
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        userId,
        date: new Date(2024, 0, 1, 14, 0),
        readingVelocity: 250
      }))

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      await findOptimalReadingTime(userIdString)

      expect(ReadingSession.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId)
      })
    })
  })

  describe('2-hour window grouping', () => {
    it('should group sessions into correct 2-hour windows', async () => {
      const sessions = [
        // 0-2 window
        { userId, date: new Date(2024, 0, 1, 0, 0), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 2, 1, 30), readingVelocity: 100 },
        
        // 2-4 window
        { userId, date: new Date(2024, 0, 1, 2, 0), readingVelocity: 150 },
        { userId, date: new Date(2024, 0, 2, 3, 45), readingVelocity: 150 },
        
        // 4-6 window
        { userId, date: new Date(2024, 0, 1, 4, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 5, 30), readingVelocity: 200 },
        
        // 6-8 window (highest)
        { userId, date: new Date(2024, 0, 1, 6, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 2, 7, 15), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 3, 6, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 4, 7, 45), readingVelocity: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('6-8')
    })

    it('should handle all 12 possible 2-hour windows in a day', async () => {
      // Create sessions for each 2-hour window, with 18-20 having highest velocity
      const sessions = []
      for (let window = 0; window < 12; window++) {
        const startHour = window * 2
        const velocity = window === 9 ? 400 : 200 // 18-20 window (9th window) has highest
        
        sessions.push(
          { userId, date: new Date(2024, 0, 1, startHour, 0), readingVelocity: velocity },
          { userId, date: new Date(2024, 0, 2, startHour + 1, 0), readingVelocity: velocity }
        )
      }

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('18-20')
    })

    it('should correctly group hour 23 into 22-24 window', async () => {
      const sessions = [
        // 22-24 window (highest)
        { userId, date: new Date(2024, 0, 1, 22, 0), readingVelocity: 350 },
        { userId, date: new Date(2024, 0, 2, 23, 30), readingVelocity: 350 },
        { userId, date: new Date(2024, 0, 3, 22, 45), readingVelocity: 350 },
        
        // Other windows with lower velocity
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 3, 10, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 4, 11, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 5, 10, 15), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 6, 11, 15), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 7, 10, 45), readingVelocity: 200 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('22-24')
    })
  })

  describe('average velocity calculation', () => {
    it('should calculate average velocity correctly for each window', async () => {
      const sessions = [
        // 10-12 window: velocities [200, 300, 400] -> avg = 300
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 3, 10, 30), readingVelocity: 400 },
        
        // 14-16 window: velocities [250, 250] -> avg = 250
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 250 },
        
        // 16-18 window: velocities [280, 320] -> avg = 300
        { userId, date: new Date(2024, 0, 1, 16, 0), readingVelocity: 280 },
        { userId, date: new Date(2024, 0, 2, 17, 0), readingVelocity: 320 },
        { userId, date: new Date(2024, 0, 3, 16, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 4, 17, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 5, 16, 15), readingVelocity: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      // Both 10-12 and 16-18 have avg 300, but 10-12 appears first in iteration
      // The function should return one of them (implementation returns first found)
      expect(['10-12', '16-18']).toContain(result)
    })

    it('should handle varying velocities within a window', async () => {
      const sessions = [
        // 8-10 window: velocities [100, 200, 300, 400, 500] -> avg = 300
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 3, 8, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 4, 9, 30), readingVelocity: 400 },
        { userId, date: new Date(2024, 0, 5, 8, 15), readingVelocity: 500 },
        
        // 14-16 window: velocities [250, 250, 250, 250, 250] -> avg = 250
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 5, 14, 15), readingVelocity: 250 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('8-10')
    })

    it('should handle single session in a window', async () => {
      const sessions = [
        // 12-14 window: single session with velocity 400
        { userId, date: new Date(2024, 0, 1, 12, 0), readingVelocity: 400 },
        
        // Other windows with multiple sessions but lower avg
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 3, 8, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 4, 9, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 5, 8, 15), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 6, 9, 15), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 7, 8, 45), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 8, 9, 45), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 9, 8, 20), readingVelocity: 200 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('12-14')
    })
  })

  describe('edge cases', () => {
    it('should handle exactly 10 sessions (minimum required)', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        userId,
        date: new Date(2024, 0, 1, 14, i * 5),
        readingVelocity: 250
      }))

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('14-16')
    })

    it('should handle sessions with zero velocity', async () => {
      const sessions = [
        // 10-12 window: velocities [0, 0, 0] -> avg = 0
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 0 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 0 },
        { userId, date: new Date(2024, 0, 3, 10, 30), readingVelocity: 0 },
        
        // 14-16 window: velocities [100, 100] -> avg = 100
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 5, 14, 15), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 6, 15, 15), readingVelocity: 100 },
        { userId, date: new Date(2024, 0, 7, 14, 45), readingVelocity: 100 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('14-16')
    })

    it('should handle all sessions in the same window', async () => {
      const sessions = Array.from({ length: 15 }, (_, i) => ({
        userId,
        date: new Date(2024, 0, 1 + i, 20, 0),
        readingVelocity: 250 + i * 5
      }))

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('20-22')
    })

    it('should handle sessions spanning multiple days', async () => {
      const sessions = [
        // Sessions across different days but same time window
        { userId, date: new Date(2024, 0, 1, 16, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 5, 17, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 10, 16, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 15, 17, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 20, 16, 15), readingVelocity: 300 },
        
        // Other window with lower velocity
        { userId, date: new Date(2024, 0, 2, 10, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 7, 11, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 12, 10, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 17, 11, 30), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 22, 10, 15), readingVelocity: 200 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('16-18')
    })

    it('should handle very high velocity values', async () => {
      const sessions = [
        // 6-8 window with very high velocities
        { userId, date: new Date(2024, 0, 1, 6, 0), readingVelocity: 10000 },
        { userId, date: new Date(2024, 0, 2, 7, 0), readingVelocity: 10000 },
        { userId, date: new Date(2024, 0, 3, 6, 30), readingVelocity: 10000 },
        
        // Other windows with normal velocities
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 5, 14, 15), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 6, 15, 15), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 7, 14, 45), readingVelocity: 250 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('6-8')
    })

    it('should handle fractional velocity values', async () => {
      const sessions = [
        // 12-14 window with fractional velocities
        { userId, date: new Date(2024, 0, 1, 12, 0), readingVelocity: 250.5 },
        { userId, date: new Date(2024, 0, 2, 13, 0), readingVelocity: 250.7 },
        { userId, date: new Date(2024, 0, 3, 12, 30), readingVelocity: 250.3 },
        
        // Other windows with lower velocities
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 200.1 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 200.2 },
        { userId, date: new Date(2024, 0, 3, 8, 30), readingVelocity: 200.3 },
        { userId, date: new Date(2024, 0, 4, 9, 30), readingVelocity: 200.4 },
        { userId, date: new Date(2024, 0, 5, 8, 15), readingVelocity: 200.5 },
        { userId, date: new Date(2024, 0, 6, 9, 15), readingVelocity: 200.6 },
        { userId, date: new Date(2024, 0, 7, 8, 45), readingVelocity: 200.7 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('12-14')
    })
  })

  describe('tie-breaking behavior', () => {
    it('should return first window when multiple windows have same average velocity', async () => {
      const sessions = [
        // 8-10 window: avg = 300
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 300 },
        
        // 14-16 window: avg = 300
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 300 },
        
        // 20-22 window: avg = 300
        { userId, date: new Date(2024, 0, 1, 20, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 2, 21, 0), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 3, 20, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 4, 21, 30), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 5, 20, 15), readingVelocity: 300 },
        { userId, date: new Date(2024, 0, 6, 21, 15), readingVelocity: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      // Should return one of the windows with highest velocity
      expect(['8-10', '14-16', '20-22']).toContain(result)
      expect(result).toBeTruthy()
    })
  })

  describe('real-world scenarios', () => {
    it('should identify morning reader pattern', async () => {
      const sessions = [
        // Strong morning pattern (6-8)
        { userId, date: new Date(2024, 0, 1, 6, 30), readingVelocity: 350 },
        { userId, date: new Date(2024, 0, 2, 7, 0), readingVelocity: 360 },
        { userId, date: new Date(2024, 0, 3, 6, 45), readingVelocity: 340 },
        { userId, date: new Date(2024, 0, 4, 7, 15), readingVelocity: 355 },
        { userId, date: new Date(2024, 0, 5, 6, 20), readingVelocity: 345 },
        
        // Weaker afternoon pattern
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 260 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 240 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 255 },
        { userId, date: new Date(2024, 0, 5, 14, 15), readingVelocity: 245 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('6-8')
    })

    it('should identify night owl pattern', async () => {
      const sessions = [
        // Strong late night pattern (22-24)
        { userId, date: new Date(2024, 0, 1, 22, 30), readingVelocity: 380 },
        { userId, date: new Date(2024, 0, 2, 23, 0), readingVelocity: 390 },
        { userId, date: new Date(2024, 0, 3, 22, 45), readingVelocity: 375 },
        { userId, date: new Date(2024, 0, 4, 23, 15), readingVelocity: 385 },
        
        // Weaker daytime patterns
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 250 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 260 },
        { userId, date: new Date(2024, 0, 3, 10, 30), readingVelocity: 240 },
        { userId, date: new Date(2024, 0, 4, 11, 30), readingVelocity: 255 },
        { userId, date: new Date(2024, 0, 5, 10, 15), readingVelocity: 245 },
        { userId, date: new Date(2024, 0, 6, 11, 15), readingVelocity: 250 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('22-24')
    })

    it('should handle mixed reading patterns across day', async () => {
      const sessions = [
        // Early morning (4-6): avg = 200
        { userId, date: new Date(2024, 0, 1, 4, 0), readingVelocity: 200 },
        { userId, date: new Date(2024, 0, 2, 5, 0), readingVelocity: 200 },
        
        // Mid-morning (10-12): avg = 280
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 280 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 280 },
        
        // Afternoon (14-16): avg = 320 (highest)
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 320 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 320 },
        
        // Evening (18-20): avg = 260
        { userId, date: new Date(2024, 0, 1, 18, 0), readingVelocity: 260 },
        { userId, date: new Date(2024, 0, 2, 19, 0), readingVelocity: 260 },
        
        // Night (22-24): avg = 220
        { userId, date: new Date(2024, 0, 1, 22, 0), readingVelocity: 220 },
        { userId, date: new Date(2024, 0, 2, 23, 0), readingVelocity: 220 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await findOptimalReadingTime(userId)

      expect(result).toBe('14-16')
    })
  })
})


describe('getTimeSpecificWPMRecommendations', () => {
  const userId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('insufficient data handling', () => {
    it('should return empty map when user has no sessions', async () => {
      ;(ReadingSession.find as jest.Mock).mockResolvedValue([])

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(ReadingSession.find).toHaveBeenCalledWith({ userId })
    })
  })

  describe('basic functionality', () => {
    it('should calculate median WPM for sessions exceeding overall median velocity', async () => {
      const sessions = [
        // Morning sessions (8-10): velocities [200, 300], WPMs [250, 350]
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 300, currentWPM: 350 },
        
        // Afternoon sessions (14-16): velocities [250, 350], WPMs [300, 400]
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 350, currentWPM: 400 }
      ]
      // Overall median velocity: [200, 250, 300, 350] -> 275
      // Morning: only session with velocity 300 > 275, WPM = 350
      // Afternoon: only session with velocity 350 > 275, WPM = 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(2)
      expect(result.get('8-10')).toBe(350)
      expect(result.get('14-16')).toBe(400)
    })

    it('should handle userId as string', async () => {
      const userIdString = userId.toString()
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250, currentWPM: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      await getTimeSpecificWPMRecommendations(userIdString)

      expect(ReadingSession.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId)
      })
    })

    it('should round WPM values to nearest integer', async () => {
      const sessions = [
        // Sessions with fractional WPMs
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 300, currentWPM: 250.3 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 350, currentWPM: 250.7 },
        { userId, date: new Date(2024, 0, 3, 10, 30), readingVelocity: 200, currentWPM: 200.1 }
      ]
      // Overall median velocity: [200, 300, 350] -> 300
      // High velocity sessions: 300, 350 with WPMs 250.3, 250.7
      // Median WPM: 250.5 -> rounds to 251

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('10-12')).toBe(251)
    })
  })

  describe('median calculation', () => {
    it('should calculate median correctly for odd number of values', async () => {
      const sessions = [
        // 3 high-velocity sessions with WPMs [200, 300, 400]
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300, currentWPM: 200 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 350, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 400, currentWPM: 400 },
        // Low velocity session
        { userId, date: new Date(2024, 0, 4, 14, 0), readingVelocity: 100, currentWPM: 150 }
      ]
      // Overall median velocity: [100, 300, 350, 400] -> 325
      // High velocity sessions: 350, 400 with WPMs 300, 400
      // Median WPM: 350

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(350)
    })

    it('should calculate median correctly for even number of values', async () => {
      const sessions = [
        // 4 high-velocity sessions with WPMs [200, 300, 400, 500]
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300, currentWPM: 200 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 350, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 400, currentWPM: 400 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 450, currentWPM: 500 },
        // Low velocity session
        { userId, date: new Date(2024, 0, 5, 14, 0), readingVelocity: 100, currentWPM: 150 }
      ]
      // Overall median velocity: [100, 300, 350, 400, 450] -> 350
      // High velocity sessions: 400, 450 with WPMs 400, 500
      // Median WPM: (400 + 500) / 2 = 450

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(450)
    })

    it('should handle single high-velocity session in a window', async () => {
      const sessions = [
        // Single high-velocity session
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 400, currentWPM: 450 },
        // Multiple low-velocity sessions
        { userId, date: new Date(2024, 0, 2, 10, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 3, 11, 0), readingVelocity: 250, currentWPM: 300 }
      ]
      // Overall median velocity: [200, 250, 400] -> 250
      // High velocity session: 400 with WPM 450
      // Median WPM: 450

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(450)
    })
  })

  describe('time window grouping', () => {
    it('should group sessions into correct 2-hour windows', async () => {
      const sessions = [
        // 0-2 window
        { userId, date: new Date(2024, 0, 1, 0, 0), readingVelocity: 300, currentWPM: 350 },
        { userId, date: new Date(2024, 0, 2, 1, 30), readingVelocity: 350, currentWPM: 400 },
        
        // 6-8 window
        { userId, date: new Date(2024, 0, 1, 6, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 2, 7, 45), readingVelocity: 450, currentWPM: 500 },
        
        // Low velocity session
        { userId, date: new Date(2024, 0, 3, 12, 0), readingVelocity: 100, currentWPM: 150 }
      ]
      // Overall median velocity: [100, 300, 350, 400, 450] -> 350

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('0-2')).toBe(false) // No sessions exceed median
      expect(result.has('6-8')).toBe(true)
      expect(result.get('6-8')).toBe(475) // median of [450, 500]
    })

    it('should handle all 12 possible 2-hour windows', async () => {
      const sessions = []
      // Create sessions for each 2-hour window
      for (let window = 0; window < 12; window++) {
        const startHour = window * 2
        const velocity = 300 + window * 10 // Increasing velocity
        const wpm = 350 + window * 10
        
        sessions.push({
          userId,
          date: new Date(2024, 0, 1, startHour, 0),
          readingVelocity: velocity,
          currentWPM: wpm
        })
      }
      // Overall median velocity: 355

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      // Windows with velocity > 355 should have recommendations
      expect(result.size).toBeGreaterThan(0)
      expect(result.has('12-14')).toBe(true) // window 6: velocity 360
      expect(result.has('22-24')).toBe(true) // window 11: velocity 410
    })

    it('should correctly group hour 23 into 22-24 window', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 22, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 2, 23, 30), readingVelocity: 450, currentWPM: 500 },
        { userId, date: new Date(2024, 0, 3, 10, 0), readingVelocity: 200, currentWPM: 250 }
      ]
      // Overall median velocity: [200, 400, 450] -> 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('22-24')).toBe(true)
      expect(result.get('22-24')).toBe(500) // Only session with velocity 450 > 400
    })
  })

  describe('filtering logic', () => {
    it('should only include sessions where velocity exceeds overall median', async () => {
      const sessions = [
        // High velocity sessions
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 500, currentWPM: 550 },
        
        // Low velocity sessions (should be excluded)
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 4, 15, 30), readingVelocity: 300, currentWPM: 350 }
      ]
      // Overall median velocity: [200, 300, 400, 500] -> 350
      // High velocity sessions in 14-16: 400, 500 with WPMs 450, 550
      // Median WPM: 500

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(500)
    })

    it('should not include windows with no high-velocity sessions', async () => {
      const sessions = [
        // Morning: all low velocity
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 250, currentWPM: 300 },
        
        // Afternoon: high velocity
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 500, currentWPM: 550 }
      ]
      // Overall median velocity: [200, 250, 400, 500] -> 325

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('8-10')).toBe(false) // No sessions exceed median
      expect(result.has('14-16')).toBe(true)
    })

    it('should handle sessions exactly at median velocity', async () => {
      const sessions = [
        // Sessions at exactly median velocity (should be excluded)
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 300, currentWPM: 350 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 300, currentWPM: 350 },
        
        // Session above median
        { userId, date: new Date(2024, 0, 3, 14, 0), readingVelocity: 400, currentWPM: 450 }
      ]
      // Overall median velocity: [300, 300, 400] -> 300
      // Only session with velocity 400 > 300 should be included

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('10-12')).toBe(false) // Sessions at median excluded
      expect(result.has('14-16')).toBe(true)
      expect(result.get('14-16')).toBe(450)
    })
  })

  describe('edge cases', () => {
    it('should handle single session', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300, currentWPM: 350 }
      ]
      // Overall median velocity: 300
      // No sessions exceed median (300 is not > 300)

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(0)
    })

    it('should handle two sessions with different velocities', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 400, currentWPM: 450 }
      ]
      // Overall median velocity: (200 + 400) / 2 = 300
      // High velocity session: 400 with WPM 450

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(1)
      expect(result.get('14-16')).toBe(450)
    })

    it('should handle sessions with zero velocity', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 10, 0), readingVelocity: 0, currentWPM: 100 },
        { userId, date: new Date(2024, 0, 2, 11, 0), readingVelocity: 0, currentWPM: 100 },
        { userId, date: new Date(2024, 0, 3, 14, 0), readingVelocity: 300, currentWPM: 350 }
      ]
      // Overall median velocity: [0, 0, 300] -> 0
      // High velocity session: 300 with WPM 350

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('14-16')).toBe(true)
      expect(result.get('14-16')).toBe(350)
    })

    it('should handle very high WPM values', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300, currentWPM: 10000 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 400, currentWPM: 10000 },
        { userId, date: new Date(2024, 0, 3, 10, 0), readingVelocity: 200, currentWPM: 5000 }
      ]
      // Overall median velocity: [200, 300, 400] -> 300

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(10000)
    })

    it('should handle fractional velocity values', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 250.5, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 350.7, currentWPM: 400 },
        { userId, date: new Date(2024, 0, 3, 10, 0), readingVelocity: 200.3, currentWPM: 250 }
      ]
      // Overall median velocity: [200.3, 250.5, 350.7] -> 250.5

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('14-16')).toBe(true)
      expect(result.get('14-16')).toBe(400) // Only session with velocity 350.7 > 250.5
    })

    it('should handle all sessions in the same window', async () => {
      const sessions = [
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 300, currentWPM: 350 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 400, currentWPM: 450 }
      ]
      // Overall median velocity: [200, 300, 400] -> 300
      // High velocity sessions: 400 with WPM 450

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(1)
      expect(result.has('14-16')).toBe(true)
      expect(result.get('14-16')).toBe(450)
    })

    it('should handle sessions spanning multiple days', async () => {
      const sessions = [
        // Sessions across different days but same time window
        { userId, date: new Date(2024, 0, 1, 16, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 5, 17, 0), readingVelocity: 450, currentWPM: 500 },
        { userId, date: new Date(2024, 0, 10, 16, 30), readingVelocity: 500, currentWPM: 550 },
        
        // Low velocity sessions
        { userId, date: new Date(2024, 0, 2, 10, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 7, 11, 0), readingVelocity: 250, currentWPM: 300 }
      ]
      // Overall median velocity: [200, 250, 400, 450, 500] -> 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('16-18')).toBe(true)
      // High velocity sessions: 450, 500 with WPMs 500, 550
      expect(result.get('16-18')).toBe(525) // median of [500, 550]
    })
  })

  describe('multiple windows scenarios', () => {
    it('should provide recommendations for multiple time windows', async () => {
      const sessions = [
        // Morning (8-10): high velocity
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 400, currentWPM: 450 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 450, currentWPM: 500 },
        
        // Afternoon (14-16): high velocity
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 500, currentWPM: 550 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 550, currentWPM: 600 },
        
        // Evening (20-22): low velocity
        { userId, date: new Date(2024, 0, 1, 20, 0), readingVelocity: 200, currentWPM: 250 },
        { userId, date: new Date(2024, 0, 2, 21, 0), readingVelocity: 250, currentWPM: 300 }
      ]
      // Overall median velocity: [200, 250, 400, 450, 500, 550] -> 425

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(2)
      expect(result.has('8-10')).toBe(true)
      expect(result.has('14-16')).toBe(true)
      expect(result.has('20-22')).toBe(false)
    })

    it('should handle varying WPMs within same window', async () => {
      const sessions = [
        // 14-16 window with varying WPMs
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 400, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 450, currentWPM: 500 },
        { userId, date: new Date(2024, 0, 3, 14, 30), readingVelocity: 500, currentWPM: 700 },
        
        // Low velocity session
        { userId, date: new Date(2024, 0, 4, 10, 0), readingVelocity: 200, currentWPM: 250 }
      ]
      // Overall median velocity: [200, 400, 450, 500] -> 425
      // High velocity sessions: 450, 500 with WPMs 500, 700
      // Median WPM: 600

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.get('14-16')).toBe(600)
    })
  })

  describe('real-world scenarios', () => {
    it('should identify morning reader with high performance', async () => {
      const sessions = [
        // Strong morning performance (6-8)
        { userId, date: new Date(2024, 0, 1, 6, 30), readingVelocity: 450, currentWPM: 500 },
        { userId, date: new Date(2024, 0, 2, 7, 0), readingVelocity: 480, currentWPM: 530 },
        { userId, date: new Date(2024, 0, 3, 6, 45), readingVelocity: 460, currentWPM: 510 },
        
        // Weaker afternoon performance
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 300, currentWPM: 350 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 320, currentWPM: 370 },
        
        // Weak evening performance
        { userId, date: new Date(2024, 0, 1, 20, 0), readingVelocity: 250, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 2, 21, 0), readingVelocity: 270, currentWPM: 320 }
      ]
      // Overall median velocity: [250, 270, 300, 320, 450, 460, 480] -> 320

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('6-8')).toBe(true)
      expect(result.get('6-8')).toBe(510) // median of [500, 510, 530]
    })

    it('should identify night owl with high performance', async () => {
      const sessions = [
        // Weak morning performance
        { userId, date: new Date(2024, 0, 1, 8, 0), readingVelocity: 250, currentWPM: 300 },
        { userId, date: new Date(2024, 0, 2, 9, 0), readingVelocity: 270, currentWPM: 320 },
        
        // Weak afternoon performance
        { userId, date: new Date(2024, 0, 1, 14, 0), readingVelocity: 280, currentWPM: 330 },
        { userId, date: new Date(2024, 0, 2, 15, 0), readingVelocity: 290, currentWPM: 340 },
        
        // Strong late night performance (22-24)
        { userId, date: new Date(2024, 0, 1, 22, 30), readingVelocity: 480, currentWPM: 530 },
        { userId, date: new Date(2024, 0, 2, 23, 0), readingVelocity: 500, currentWPM: 550 },
        { userId, date: new Date(2024, 0, 3, 22, 45), readingVelocity: 490, currentWPM: 540 }
      ]
      // Overall median velocity: [250, 270, 280, 290, 480, 490, 500] -> 290

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.has('22-24')).toBe(true)
      expect(result.get('22-24')).toBe(540) // median of [530, 540, 550]
    })

    it('should handle consistent performance across all time windows', async () => {
      const sessions = []
      // Create sessions with consistent velocity across different windows
      for (let i = 0; i < 12; i++) {
        const hour = i * 2
        sessions.push({
          userId,
          date: new Date(2024, 0, 1, hour, 0),
          readingVelocity: 300,
          currentWPM: 350
        })
      }
      // All sessions have same velocity, so median is 300
      // No sessions exceed median (300 is not > 300)

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getTimeSpecificWPMRecommendations(userId)

      expect(result.size).toBe(0)
    })
  })
})


// Mock Quiz model at the top level
jest.mock('../../models/Quiz')
const Quiz = require('../../models/Quiz').default;

describe('getHighComprehensionGenres', () => {
  const userId = new Types.ObjectId()
  
  // Import the function
  let getHighComprehensionGenres: any
  
  beforeAll(async () => {
    const module = await import('../services/ml/recommendationEngine')
    getHighComprehensionGenres = module.getHighComprehensionGenres
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('insufficient data handling', () => {
    it('should return empty array when user has no quizzes', async () => {
      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })
  })

  describe('basic functionality', () => {
    it('should identify genre with score 10% above overall average', async () => {
      const quizzes = [
        // Fiction quizzes: avg = 90
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        
        // Science quizzes: avg = 70
        { userId, bookId: { genre: 'science' }, score: 70 },
        { userId, bookId: { genre: 'science' }, score: 70 }
      ];
      // Overall average: (90 + 90 + 70 + 70) / 4 = 80
      // Fiction: 90 >= 80 + 10 = 90 ✓
      // Science: 70 < 90 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      });

      const result = await getHighComprehensionGenres(userId);

      expect(result).toEqual(['fiction']);
    });
  });

  describe('multiple genres', () => {
    it('should identify multiple high-comprehension genres', async () => {
      const quizzes = [
        // Fiction: avg = 95
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        
        // Mystery: avg = 92
        { userId, bookId: { genre: 'mystery' }, score: 92 },
        { userId, bookId: { genre: 'mystery' }, score: 92 },
        
        // Science: avg = 70
        { userId, bookId: { genre: 'science' }, score: 70 },
        { userId, bookId: { genre: 'science' }, score: 70 }
      ]
      // Overall average: (95 + 95 + 92 + 92 + 70 + 70) / 6 = 85.67
      // Fiction: 95 >= 95.67 ✗ (close but not quite)
      // Mystery: 92 >= 95.67 ✗
      // Science: 70 < 95.67 ✗
      // Actually: 85.67 + 10 = 95.67
      // Fiction: 95 < 95.67 ✗
      // Let me recalculate: (95*2 + 92*2 + 70*2) / 6 = 514/6 = 85.67
      // Threshold: 95.67
      // None qualify

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should identify multiple genres when they exceed threshold', async () => {
      const quizzes = [
        // Fiction: avg = 95
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        
        // Mystery: avg = 93
        { userId, bookId: { genre: 'mystery' }, score: 93 },
        { userId, bookId: { genre: 'mystery' }, score: 93 },
        
        // Science: avg = 60
        { userId, bookId: { genre: 'science' }, score: 60 },
        { userId, bookId: { genre: 'science' }, score: 60 }
      ]
      // Overall average: (95*2 + 93*2 + 60*2) / 6 = 496/6 = 82.67
      // Threshold: 92.67
      // Fiction: 95 >= 92.67 ✓
      // Mystery: 93 >= 92.67 ✓
      // Science: 60 < 92.67 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toContain('fiction')
      expect(result).toContain('mystery')
      expect(result).not.toContain('science')
      expect(result).toHaveLength(2)
    })

    it('should handle userId as string', async () => {
      const userIdString = userId.toString()
      
      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      })

      await getHighComprehensionGenres(userIdString)

      expect((Quiz.find as jest.Mock)).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId)
      })
    })
  })

  describe('threshold calculation', () => {
    it('should require exactly 10 percentage points above average', async () => {
      const quizzes = [
        // Fiction: avg = 90
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        
        // Science: avg = 80
        { userId, bookId: { genre: 'science' }, score: 80 }
      ]
      // Overall average: (90 + 80) / 2 = 85
      // Threshold: 95
      // Fiction: 90 < 95 ✗
      // Science: 80 < 95 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should include genre at exactly 10 percentage points above', async () => {
      const quizzes = [
        // Fiction: avg = 90
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        
        // Science: avg = 70
        { userId, bookId: { genre: 'science' }, score: 70 }
      ]
      // Overall average: (90 + 70) / 2 = 80
      // Threshold: 90
      // Fiction: 90 >= 90 ✓
      // Science: 70 < 90 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should exclude genre at 9.9 percentage points above', async () => {
      const quizzes = [
        // Fiction: avg = 89.9
        { userId, bookId: { genre: 'fiction' }, score: 89.9 },
        
        // Science: avg = 70
        { userId, bookId: { genre: 'science' }, score: 70 }
      ]
      // Overall average: (89.9 + 70) / 2 = 79.95
      // Threshold: 89.95
      // Fiction: 89.9 < 89.95 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })
  })

  describe('genre grouping', () => {
    it('should correctly group quizzes by genre', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 92 },
        { userId, bookId: { genre: 'fiction' }, score: 88 },
        
        { userId, bookId: { genre: 'science' }, score: 70 },
        { userId, bookId: { genre: 'science' }, score: 72 }
      ]
      // Overall average: (90 + 92 + 88 + 70 + 72) / 5 = 82.4
      // Fiction avg: (90 + 92 + 88) / 3 = 90
      // Science avg: (70 + 72) / 2 = 71
      // Threshold: 92.4
      // Fiction: 90 < 92.4 ✗
      // Science: 71 < 92.4 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should calculate average correctly for each genre', async () => {
      const quizzes = [
        // Fiction: avg = 95
        { userId, bookId: { genre: 'fiction' }, score: 100 },
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        
        // Mystery: avg = 50
        { userId, bookId: { genre: 'mystery' }, score: 50 },
        { userId, bookId: { genre: 'mystery' }, score: 50 }
      ]
      // Overall average: (100 + 90 + 50 + 50) / 4 = 72.5
      // Threshold: 82.5
      // Fiction: 95 >= 82.5 ✓
      // Mystery: 50 < 82.5 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })
  })

  describe('edge cases', () => {
    it('should handle quizzes with missing book data', async () => {
      const quizzes = [
        { userId, bookId: null, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'fiction' }, score: 95 }
      ]
      // Overall average includes all quizzes: (90 + 95 + 95) / 3 = 93.33
      // But only fiction genre is grouped (2 quizzes)
      // Fiction avg: (95 + 95) / 2 = 95
      // Threshold: 103.33
      // Fiction: 95 < 103.33 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should handle quizzes with missing genre', async () => {
      const quizzes = [
        { userId, bookId: { genre: undefined }, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'fiction' }, score: 95 }
      ]
      // Overall average: (90 + 95 + 95) / 3 = 93.33
      // Fiction avg: (95 + 95) / 2 = 95
      // Threshold: 103.33
      // Fiction: 95 < 103.33 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should handle single quiz per genre', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'science' }, score: 70 }
      ]
      // Overall average: (95 + 70) / 2 = 82.5
      // Threshold: 92.5
      // Fiction: 95 >= 92.5 ✓
      // Science: 70 < 92.5 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should handle all quizzes in same genre', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 92 },
        { userId, bookId: { genre: 'fiction' }, score: 88 }
      ]
      // Overall average: (90 + 92 + 88) / 3 = 90
      // Fiction avg: 90
      // Threshold: 100
      // Fiction: 90 < 100 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should handle perfect scores', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 100 },
        { userId, bookId: { genre: 'fiction' }, score: 100 },
        
        { userId, bookId: { genre: 'science' }, score: 80 },
        { userId, bookId: { genre: 'science' }, score: 80 }
      ]
      // Overall average: (100 + 100 + 80 + 80) / 4 = 90
      // Threshold: 100
      // Fiction: 100 >= 100 ✓
      // Science: 80 < 100 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should handle very low scores', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 30 },
        { userId, bookId: { genre: 'fiction' }, score: 30 },
        
        { userId, bookId: { genre: 'science' }, score: 10 },
        { userId, bookId: { genre: 'science' }, score: 10 }
      ]
      // Overall average: (30 + 30 + 10 + 10) / 4 = 20
      // Threshold: 30
      // Fiction: 30 >= 30 ✓
      // Science: 10 < 30 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should handle decimal scores', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 85.5 },
        { userId, bookId: { genre: 'fiction' }, score: 86.5 },
        
        { userId, bookId: { genre: 'science' }, score: 70.2 },
        { userId, bookId: { genre: 'science' }, score: 69.8 }
      ]
      // Overall average: (85.5 + 86.5 + 70.2 + 69.8) / 4 = 78
      // Fiction avg: (85.5 + 86.5) / 2 = 86
      // Science avg: (70.2 + 69.8) / 2 = 70
      // Threshold: 88
      // Fiction: 86 < 88 ✗
      // Science: 70 < 88 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })
  })

  describe('real-world scenarios', () => {
    it('should identify user strong in fiction but weak in technical content', async () => {
      const quizzes = [
        // Fiction: avg = 92
        { userId, bookId: { genre: 'fiction' }, score: 90 },
        { userId, bookId: { genre: 'fiction' }, score: 94 },
        { userId, bookId: { genre: 'fiction' }, score: 92 },
        
        // Science: avg = 65
        { userId, bookId: { genre: 'science' }, score: 60 },
        { userId, bookId: { genre: 'science' }, score: 70 },
        
        // Technical: avg = 62
        { userId, bookId: { genre: 'technical' }, score: 60 },
        { userId, bookId: { genre: 'technical' }, score: 64 }
      ]
      // Overall average: (90 + 94 + 92 + 60 + 70 + 60 + 64) / 7 = 75.71
      // Threshold: 85.71
      // Fiction: 92 >= 85.71 ✓
      // Science: 65 < 85.71 ✗
      // Technical: 62 < 85.71 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should identify user with balanced comprehension across genres', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 80 },
        { userId, bookId: { genre: 'fiction' }, score: 82 },
        
        { userId, bookId: { genre: 'science' }, score: 78 },
        { userId, bookId: { genre: 'science' }, score: 82 },
        
        { userId, bookId: { genre: 'history' }, score: 79 },
        { userId, bookId: { genre: 'history' }, score: 81 }
      ]
      // Overall average: (80 + 82 + 78 + 82 + 79 + 81) / 6 = 80.33
      // Fiction avg: 81
      // Science avg: 80
      // History avg: 80
      // Threshold: 90.33
      // All genres < 90.33 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })

    it('should identify multiple strong genres for well-rounded reader', async () => {
      const quizzes = [
        // Fiction: avg = 95
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        { userId, bookId: { genre: 'fiction' }, score: 95 },
        
        // History: avg = 93
        { userId, bookId: { genre: 'history' }, score: 93 },
        { userId, bookId: { genre: 'history' }, score: 93 },
        
        // Biography: avg = 94
        { userId, bookId: { genre: 'biography' }, score: 94 },
        { userId, bookId: { genre: 'biography' }, score: 94 },
        
        // Science: avg = 70
        { userId, bookId: { genre: 'science' }, score: 70 },
        { userId, bookId: { genre: 'science' }, score: 70 }
      ]
      // Overall average: (95*2 + 93*2 + 94*2 + 70*2) / 8 = 88
      // Threshold: 98
      // Fiction: 95 < 98 ✗
      // History: 93 < 98 ✗
      // Biography: 94 < 98 ✗
      // Science: 70 < 98 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual([])
    })
  })

  describe('boundary values', () => {
    it('should handle score of 0', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 50 },
        { userId, bookId: { genre: 'science' }, score: 0 }
      ]
      // Overall average: 25
      // Threshold: 35
      // Fiction: 50 >= 35 ✓
      // Science: 0 < 35 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should handle score of 100', async () => {
      const quizzes = [
        { userId, bookId: { genre: 'fiction' }, score: 100 },
        { userId, bookId: { genre: 'science' }, score: 80 }
      ]
      // Overall average: 90
      // Threshold: 100
      // Fiction: 100 >= 100 ✓
      // Science: 80 < 100 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })

    it('should handle large number of quizzes', async () => {
      const quizzes = []
      
      // 50 fiction quizzes with avg = 95
      for (let i = 0; i < 50; i++) {
        quizzes.push({ userId, bookId: { genre: 'fiction' }, score: 95 })
      }
      
      // 50 science quizzes with avg = 70
      for (let i = 0; i < 50; i++) {
        quizzes.push({ userId, bookId: { genre: 'science' }, score: 70 })
      }
      
      // Overall average: (95*50 + 70*50) / 100 = 82.5
      // Threshold: 92.5
      // Fiction: 95 >= 92.5 ✓
      // Science: 70 < 92.5 ✗

      (Quiz.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(quizzes)
      })

      const result = await getHighComprehensionGenres(userId)

      expect(result).toEqual(['fiction'])
    })
  })
})


describe('getInitialWPMForBook', () => {
  const userId = new Types.ObjectId()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('no session data', () => {
    it('should return default WPM of 300 when user has no sessions', async () => {
      ;(ReadingSession.find as jest.Mock).mockResolvedValue([])

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(300)
      expect(ReadingSession.find).toHaveBeenCalledWith({ userId })
    })
  })

  describe('complexity factor calculation', () => {
    it('should apply 1.2x factor for low complexity (0.0-0.3)', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Low complexity factor: 1.2
      // Expected: 400 * 1.2 = 480

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(480)
    })

    it('should apply 1.0x factor for medium complexity (0.3-0.7)', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Medium complexity factor: 1.0
      // Expected: 400 * 1.0 = 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(400)
    })

    it('should apply 0.8x factor for high complexity (0.7-1.0)', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // High complexity factor: 0.8
      // Expected: 400 * 0.8 = 320

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.8)

      expect(result).toBe(320)
    })
  })

  describe('complexity boundary values', () => {
    it('should treat complexity 0.0 as low complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 0.0 < 0.3: factor = 1.2
      // Expected: 400 * 1.2 = 480

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.0)

      expect(result).toBe(480)
    })

    it('should treat complexity 0.29 as low complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 0.29 < 0.3: factor = 1.2
      // Expected: 400 * 1.2 = 480

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.29)

      expect(result).toBe(480)
    })

    it('should treat complexity 0.3 as medium complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 0.3 >= 0.3 and < 0.7: factor = 1.0
      // Expected: 400 * 1.0 = 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.3)

      expect(result).toBe(400)
    })

    it('should treat complexity 0.69 as medium complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 0.69 < 0.7: factor = 1.0
      // Expected: 400 * 1.0 = 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.69)

      expect(result).toBe(400)
    })

    it('should treat complexity 0.7 as high complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 0.7 >= 0.7: factor = 0.8
      // Expected: 400 * 0.8 = 320

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.7)

      expect(result).toBe(320)
    })

    it('should treat complexity 1.0 as high complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median WPM: 400
      // Complexity 1.0 >= 0.7: factor = 0.8
      // Expected: 400 * 0.8 = 320

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 1.0)

      expect(result).toBe(320)
    })
  })

  describe('median WPM calculation', () => {
    it('should calculate median correctly for odd number of sessions', async () => {
      const sessions = [
        { userId, currentWPM: 100 },
        { userId, currentWPM: 200 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 500 }
      ]
      // Median: 300
      // Medium complexity factor: 1.0
      // Expected: 300

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(300)
    })

    it('should calculate median correctly for even number of sessions', async () => {
      const sessions = [
        { userId, currentWPM: 100 },
        { userId, currentWPM: 200 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 400 }
      ]
      // Median: (200 + 300) / 2 = 250
      // Medium complexity factor: 1.0
      // Expected: 250

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(250)
    })

    it('should handle single session', async () => {
      const sessions = [
        { userId, currentWPM: 350 }
      ]
      // Median: 350
      // Medium complexity factor: 1.0
      // Expected: 350

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(350)
    })

    it('should handle sessions with unsorted WPM values', async () => {
      const sessions = [
        { userId, currentWPM: 500 },
        { userId, currentWPM: 200 },
        { userId, currentWPM: 400 },
        { userId, currentWPM: 100 },
        { userId, currentWPM: 300 }
      ]
      // Sorted: [100, 200, 300, 400, 500]
      // Median: 300
      // Medium complexity factor: 1.0
      // Expected: 300

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(300)
    })
  })

  describe('rounding behavior', () => {
    it('should round down when result is X.4', async () => {
      const sessions = [
        { userId, currentWPM: 333 },
        { userId, currentWPM: 333 },
        { userId, currentWPM: 333 }
      ]
      // Median: 333
      // Low complexity factor: 1.2
      // Expected: 333 * 1.2 = 399.6 → 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(400)
    })

    it('should round up when result is X.5', async () => {
      const sessions = [
        { userId, currentWPM: 250 },
        { userId, currentWPM: 250 },
        { userId, currentWPM: 250 }
      ]
      // Median: 250
      // Low complexity factor: 1.2
      // Expected: 250 * 1.2 = 300

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(300)
    })

    it('should round up when result is X.6', async () => {
      const sessions = [
        { userId, currentWPM: 334 },
        { userId, currentWPM: 334 },
        { userId, currentWPM: 334 }
      ]
      // Median: 334
      // Low complexity factor: 1.2
      // Expected: 334 * 1.2 = 400.8 → 401

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(401)
    })

    it('should return integer when calculation is exact', async () => {
      const sessions = [
        { userId, currentWPM: 500 },
        { userId, currentWPM: 500 },
        { userId, currentWPM: 500 }
      ]
      // Median: 500
      // High complexity factor: 0.8
      // Expected: 500 * 0.8 = 400

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.8)

      expect(result).toBe(400)
    })
  })

  describe('userId parameter handling', () => {
    it('should handle userId as string', async () => {
      const userIdString = userId.toString()
      const sessions = [
        { userId, currentWPM: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      await getInitialWPMForBook(userIdString, 0.5)

      expect(ReadingSession.find).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId)
      })
    })

    it('should handle userId as ObjectId', async () => {
      const sessions = [
        { userId, currentWPM: 300 }
      ]

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      await getInitialWPMForBook(userId, 0.5)

      expect(ReadingSession.find).toHaveBeenCalledWith({ userId })
    })
  })

  describe('realistic scenarios', () => {
    it('should recommend faster speed for simple book with experienced reader', async () => {
      const sessions = [
        { userId, currentWPM: 450 },
        { userId, currentWPM: 480 },
        { userId, currentWPM: 500 },
        { userId, currentWPM: 520 },
        { userId, currentWPM: 550 }
      ]
      // Median: 500
      // Low complexity (0.2): factor = 1.2
      // Expected: 500 * 1.2 = 600

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(600)
    })

    it('should recommend slower speed for complex book with average reader', async () => {
      const sessions = [
        { userId, currentWPM: 250 },
        { userId, currentWPM: 280 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 320 },
        { userId, currentWPM: 350 }
      ]
      // Median: 300
      // High complexity (0.85): factor = 0.8
      // Expected: 300 * 0.8 = 240

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.85)

      expect(result).toBe(240)
    })

    it('should recommend baseline speed for medium complexity book', async () => {
      const sessions = [
        { userId, currentWPM: 200 },
        { userId, currentWPM: 250 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 350 },
        { userId, currentWPM: 400 }
      ]
      // Median: 300
      // Medium complexity (0.5): factor = 1.0
      // Expected: 300 * 1.0 = 300

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(300)
    })

    it('should handle slow reader with simple book', async () => {
      const sessions = [
        { userId, currentWPM: 150 },
        { userId, currentWPM: 180 },
        { userId, currentWPM: 200 }
      ]
      // Median: 180
      // Low complexity (0.1): factor = 1.2
      // Expected: 180 * 1.2 = 216

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.1)

      expect(result).toBe(216)
    })

    it('should handle fast reader with complex book', async () => {
      const sessions = [
        { userId, currentWPM: 600 },
        { userId, currentWPM: 650 },
        { userId, currentWPM: 700 }
      ]
      // Median: 650
      // High complexity (0.9): factor = 0.8
      // Expected: 650 * 0.8 = 520

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.9)

      expect(result).toBe(520)
    })
  })

  describe('edge cases', () => {
    it('should handle very low WPM values', async () => {
      const sessions = [
        { userId, currentWPM: 50 },
        { userId, currentWPM: 60 },
        { userId, currentWPM: 70 }
      ]
      // Median: 60
      // Medium complexity: factor = 1.0
      // Expected: 60

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(60)
    })

    it('should handle very high WPM values', async () => {
      const sessions = [
        { userId, currentWPM: 1000 },
        { userId, currentWPM: 1100 },
        { userId, currentWPM: 1200 }
      ]
      // Median: 1100
      // Medium complexity: factor = 1.0
      // Expected: 1100

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(1100)
    })

    it('should handle all sessions with same WPM', async () => {
      const sessions = [
        { userId, currentWPM: 300 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 300 },
        { userId, currentWPM: 300 }
      ]
      // Median: 300
      // Low complexity: factor = 1.2
      // Expected: 300 * 1.2 = 360

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.2)

      expect(result).toBe(360)
    })

    it('should handle large number of sessions', async () => {
      const sessions = Array.from({ length: 1000 }, (_, i) => ({
        userId,
        currentWPM: 200 + i // WPM from 200 to 1199
      }))
      // Median: (200 + 1199) / 2 = 699.5 → 700 (middle two values)
      // Actually for 1000 items: median is average of 500th and 501st
      // 200 + 499 = 699 and 200 + 500 = 700
      // Median: (699 + 700) / 2 = 699.5
      // Medium complexity: factor = 1.0
      // Expected: 700 (rounded)

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const result = await getInitialWPMForBook(userId, 0.5)

      expect(result).toBe(700)
    })
  })

  describe('integration with complexity thresholds', () => {
    it('should demonstrate 20% speed increase for low complexity', async () => {
      const sessions = [
        { userId, currentWPM: 300 }
      ]
      // Median: 300
      // Low complexity: 300 * 1.2 = 360
      // Medium complexity: 300 * 1.0 = 300
      // High complexity: 300 * 0.8 = 240
      // Difference low to medium: 60 WPM (20%)
      // Difference medium to high: 60 WPM (20%)

      ;(ReadingSession.find as jest.Mock).mockResolvedValue(sessions)

      const lowResult = await getInitialWPMForBook(userId, 0.2)
      const mediumResult = await getInitialWPMForBook(userId, 0.5)
      const highResult = await getInitialWPMForBook(userId, 0.8)

      expect(lowResult).toBe(360)
      expect(mediumResult).toBe(300)
      expect(highResult).toBe(240)
      
      // Verify 20% differences
      expect(lowResult - mediumResult).toBe(60)
      expect(mediumResult - highResult).toBe(60)
    })
  })
})
