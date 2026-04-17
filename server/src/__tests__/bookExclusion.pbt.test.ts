import * as fc from 'fast-check'
import { generateBookRecommendations } from '../services/ml/recommendationEngine'
import { IBook } from '../models/Book'
import Book from '../models/Book'
import { Types } from 'mongoose'

/**
 * Property-Based Tests for Book Recommendation Exclusion
 * Feature: ai-adaptive-features
 */

// Mock the Book model
jest.mock('../models/Book')

describe('Book Recommendation Exclusion Property-Based Tests', () => {
  /**
   * Helper function to mock Book.find for the three calls in generateBookRecommendations
   */
  const mockBookFind = (completedBooks: IBook[], userBookIds: Types.ObjectId[], candidateBooks: IBook[]) => {
    const calls = [
      // First call: find completed books
      Promise.resolve(completedBooks),
      // Second call: find all user's book IDs (returns query with distinct method)
      {
        distinct: jest.fn().mockResolvedValue(userBookIds)
      },
      // Third call: find candidate books
      Promise.resolve(candidateBooks)
    ]
    
    let callIndex = 0
    ;(Book.find as jest.Mock).mockImplementation(() => {
      const result = calls[callIndex]
      callIndex++
      return result
    })
  }

  /**
   * Property 11: Book recommendations exclude user's books
   * **Validates: Requirements 3.3**
   *
   * For any set of book recommendations generated for a user, none of the 
   * recommended books may be books that the user has already uploaded or completed.
   *
   * This property verifies that:
   * 1. No recommended book has the same userId as the requesting user
   * 2. No recommended book appears in the user's owned books list
   * 3. The exclusion works regardless of completion status
   */
  describe('Property 11: Book recommendations exclude user\'s books', () => {
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

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should never recommend books owned by the user', () => {
      // Generators
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUserBooksGen = fc.integer({ min: 1, max: 10 })
      const numOtherBooksGen = fc.integer({ min: 1, max: 20 })
      const genreGen = fc.constantFrom('fiction', 'non-fiction', 'science', 'mystery', 'romance')

      fc.assert(
        fc.asyncProperty(userIdGen, numUserBooksGen, numOtherBooksGen, genreGen,
          async (userId, numUserBooks, numOtherBooks, genre) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // Create user's books (some completed, some not)
            const userBooks = Array.from({ length: numUserBooks }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: i < Math.floor(numUserBooks / 2), // Half completed
                genre,
                totalWords: 50000 + i * 1000,
                complexityScore: 0.5 + (i * 0.01),
                isPublic: false
              })
            )

            // Create books from other users
            const otherUserBooks = Array.from({ length: numOtherBooks }, (_, i) => 
              createMockBook({
                userId: new Types.ObjectId(), // Different user
                isCompleted: false,
                genre,
                totalWords: 50000 + i * 1000,
                complexityScore: 0.5 + (i * 0.01),
                isPublic: true
              })
            )

            // Mock Book.find calls
            const completedBooks = userBooks.filter(b => b.isCompleted)
            const userBookIds = userBooks.map(b => b._id)
            mockBookFind(completedBooks, userBookIds, otherUserBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: No recommended book should have the user's ID
            const hasUserBook = recommendations.some(book => 
              book.userId.equals(userId)
            )

            // Verify: No recommended book should be in user's owned books
            const hasOwnedBook = recommendations.some(rec =>
              userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            return !hasUserBook && !hasOwnedBook
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should exclude both completed and uncompleted user books', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numCompletedGen = fc.integer({ min: 1, max: 5 })
      const numUncompletedGen = fc.integer({ min: 1, max: 5 })
      const numCandidatesGen = fc.integer({ min: 5, max: 15 })

      fc.assert(
        fc.asyncProperty(userIdGen, numCompletedGen, numUncompletedGen, numCandidatesGen,
          async (userId, numCompleted, numUncompleted, numCandidates) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // Create completed books
            const completedBooks = Array.from({ length: numCompleted }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: true,
                genre: 'fiction',
                totalWords: 50000 + i * 1000
              })
            )

            // Create uncompleted books
            const uncompletedBooks = Array.from({ length: numUncompleted }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: false,
                genre: 'fiction',
                totalWords: 60000 + i * 1000
              })
            )

            const allUserBooks = [...completedBooks, ...uncompletedBooks]
            const userBookIds = allUserBooks.map(b => b._id)

            // Create candidate books from other users
            const candidateBooks = Array.from({ length: numCandidates }, (_, i) => 
              createMockBook({
                userId: new Types.ObjectId(),
                isPublic: true,
                genre: 'fiction',
                totalWords: 50000 + i * 500
              })
            )

            // Mock Book.find calls
            mockBookFind(completedBooks, userBookIds, candidateBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: None of the user's books (completed or not) are recommended
            const hasAnyUserBook = recommendations.some(rec =>
              userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            return !hasAnyUserBook
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should only recommend books from other users', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUserBooksGen = fc.integer({ min: 1, max: 8 })
      const numOtherUsersGen = fc.integer({ min: 2, max: 5 })
      const booksPerUserGen = fc.integer({ min: 1, max: 5 })

      fc.assert(
        fc.asyncProperty(userIdGen, numUserBooksGen, numOtherUsersGen, booksPerUserGen,
          async (userId, numUserBooks, numOtherUsers, booksPerUser) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // Create user's completed books
            const userBooks = Array.from({ length: numUserBooks }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: true,
                genre: 'fiction',
                totalWords: 50000
              })
            )

            // Create books from multiple other users
            const otherUserIds = Array.from({ length: numOtherUsers }, () => new Types.ObjectId())
            const candidateBooks = otherUserIds.flatMap(otherUserId =>
              Array.from({ length: booksPerUser }, (_, i) => 
                createMockBook({
                  userId: otherUserId,
                  isPublic: true,
                  genre: 'fiction',
                  totalWords: 50000 + i * 1000
                })
              )
            )

            // Mock Book.find calls
            mockBookFind(userBooks, userBooks.map(b => b._id), candidateBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: All recommendations are from other users
            const allFromOtherUsers = recommendations.every(rec =>
              !rec.userId.equals(userId)
            )

            // Verify: All recommendations are from the candidate pool
            const allFromCandidates = recommendations.every(rec =>
              candidateBooks.some(cand => cand._id.equals(rec._id))
            )

            return allFromOtherUsers && allFromCandidates
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle edge case with no completed books (returns empty)', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUncompletedGen = fc.integer({ min: 0, max: 10 })

      fc.assert(
        fc.asyncProperty(userIdGen, numUncompletedGen,
          async (userId, numUncompleted) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // User has books but none completed
            const uncompletedBooks = Array.from({ length: numUncompleted }, () => 
              createMockBook({
                userId,
                isCompleted: false
              })
            )

            // Mock: no completed books
            mockBookFind([], [], [])

            const recommendations = await generateBookRecommendations(userId)

            // Should return empty array when no completed books
            return recommendations.length === 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should exclude user books even when they match similarity criteria perfectly', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const genreGen = fc.constantFrom('fiction', 'science', 'mystery')
      const wordCountGen = fc.integer({ min: 40000, max: 60000 })
      const complexityGen = fc.double({ min: 0.4, max: 0.6, noNaN: true })

      fc.assert(
        fc.asyncProperty(userIdGen, genreGen, wordCountGen, complexityGen,
          async (userId, genre, wordCount, complexity) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // User has a completed book
            const userCompletedBook = createMockBook({
              userId,
              isCompleted: true,
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })

            // User has another book (uncompleted) with identical properties
            const userUncompletedBook = createMockBook({
              userId,
              isCompleted: false,
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })

            // Other user has a book with identical properties (perfect match)
            const otherUserBook = createMockBook({
              userId: new Types.ObjectId(),
              isPublic: true,
              genre,
              totalWords: wordCount,
              complexityScore: complexity
            })

            const userBooks = [userCompletedBook, userUncompletedBook]
            const userBookIds = userBooks.map(b => b._id)

            // Mock Book.find calls
            mockBookFind([userCompletedBook], userBookIds, [otherUserBook])

            const recommendations = await generateBookRecommendations(userId)

            // Should recommend the other user's book but not the user's books
            const hasOtherUserBook = recommendations.some(rec => 
              rec._id.equals(otherUserBook._id)
            )
            const hasUserBook = recommendations.some(rec =>
              userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            return hasOtherUserBook && !hasUserBook
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain exclusion property with varying numbers of user books', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUserBooksGen = fc.integer({ min: 1, max: 50 })
      const numCandidatesGen = fc.integer({ min: 5, max: 30 })

      fc.assert(
        fc.asyncProperty(userIdGen, numUserBooksGen, numCandidatesGen,
          async (userId, numUserBooks, numCandidates) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // Create many user books
            const userBooks = Array.from({ length: numUserBooks }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: i % 3 === 0, // Every third book is completed
                genre: ['fiction', 'science', 'mystery'][i % 3],
                totalWords: 30000 + i * 1000,
                complexityScore: 0.3 + (i % 7) * 0.1
              })
            )

            const completedBooks = userBooks.filter(b => b.isCompleted)
            const userBookIds = userBooks.map(b => b._id)

            // Create candidate books
            const candidateBooks = Array.from({ length: numCandidates }, (_, i) => 
              createMockBook({
                userId: new Types.ObjectId(),
                isPublic: true,
                genre: ['fiction', 'science', 'mystery'][i % 3],
                totalWords: 30000 + i * 1000,
                complexityScore: 0.3 + (i % 7) * 0.1
              })
            )

            // Mock Book.find calls
            mockBookFind(completedBooks, userBookIds, candidateBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: No user books in recommendations
            const hasUserBook = recommendations.some(rec =>
              userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            // Verify: All recommendations have different userId
            const allDifferentUser = recommendations.every(rec =>
              !rec.userId.equals(userId)
            )

            return !hasUserBook && allDifferentUser
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return at most 5 recommendations, all excluding user books', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUserBooksGen = fc.integer({ min: 1, max: 10 })
      const numCandidatesGen = fc.integer({ min: 10, max: 50 })

      fc.assert(
        fc.asyncProperty(userIdGen, numUserBooksGen, numCandidatesGen,
          async (userId, numUserBooks, numCandidates) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            // Create user books
            const userBooks = Array.from({ length: numUserBooks }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: true,
                genre: 'fiction',
                totalWords: 50000
              })
            )

            // Create many candidate books
            const candidateBooks = Array.from({ length: numCandidates }, (_, i) => 
              createMockBook({
                userId: new Types.ObjectId(),
                isPublic: true,
                genre: 'fiction',
                totalWords: 50000 + i * 100
              })
            )

            const userBookIds = userBooks.map(b => b._id)

            // Mock Book.find calls
            mockBookFind(userBooks, userBookIds, candidateBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: At most 5 recommendations
            const hasCorrectLength = recommendations.length <= 5

            // Verify: None are user books
            const noUserBooks = recommendations.every(rec =>
              !userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            return hasCorrectLength && noUserBooks
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle mixed ownership scenarios correctly', () => {
      const userIdGen = fc.constantFrom(
        new Types.ObjectId(),
        new Types.ObjectId()
      )
      const numUserBooksGen = fc.integer({ min: 2, max: 8 })
      const numSharedPropertiesGen = fc.integer({ min: 3, max: 10 })

      fc.assert(
        fc.asyncProperty(userIdGen, numUserBooksGen, numSharedPropertiesGen,
          async (userId, numUserBooks, numSharedProperties) => {
            // Reset mocks for each property test iteration
            jest.clearAllMocks()
            
            const otherUserId = new Types.ObjectId()

            // User books with specific properties
            const userBooks = Array.from({ length: numUserBooks }, (_, i) => 
              createMockBook({
                userId,
                isCompleted: i < Math.ceil(numUserBooks / 2),
                genre: 'fiction',
                totalWords: 50000,
                complexityScore: 0.5
              })
            )

            // Other user books with same properties (should be recommended)
            const otherUserBooks = Array.from({ length: numSharedProperties }, (_, i) => 
              createMockBook({
                userId: otherUserId,
                isPublic: true,
                genre: 'fiction',
                totalWords: 50000,
                complexityScore: 0.5
              })
            )

            const completedBooks = userBooks.filter(b => b.isCompleted)
            const userBookIds = userBooks.map(b => b._id)

            // Mock Book.find calls
            mockBookFind(completedBooks, userBookIds, otherUserBooks)

            const recommendations = await generateBookRecommendations(userId)

            // Verify: Recommendations are from other user
            const allFromOtherUser = recommendations.every(rec =>
              rec.userId.equals(otherUserId)
            )

            // Verify: No user books in recommendations
            const noUserBooks = recommendations.every(rec =>
              !userBookIds.some(ownedId => ownedId.equals(rec._id))
            )

            return allFromOtherUser && noUserBooks
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
