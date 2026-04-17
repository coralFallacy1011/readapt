import request from 'supertest'
import mongoose from 'mongoose'
import app from '../index'
import User from '../models/User'
import Book from '../models/Book'
import ReadingSession from '../models/ReadingSession'
import SpeedRecommendation from '../models/SpeedRecommendation'
import ORPModel from '../models/ORPModel'
import ORPTrainingData from '../models/ORPTrainingData'
import ReadingDNA from '../models/ReadingDNA'
import jwt from 'jsonwebtoken'

describe('ML Controller', () => {
  let authToken: string
  let userId: string
  let bookId: string

  beforeAll(async () => {
    // Create test user
    const user = await User.create({
      name: 'Test User',
      email: 'mltest@example.com',
      passwordHash: 'hashedpassword',
      minWPM: 100,
      maxWPM: 1000,
      personalizedORPEnabled: false,
      currentStreak: 5,
      longestStreak: 10
    })
    userId = user._id.toString()

    // Generate auth token
    authToken = jwt.sign(
      { id: userId, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    )

    // Create test book
    const book = await Book.create({
      userId: user._id,
      title: 'Test Book',
      totalWords: 1000,
      words: Array(1000).fill('test'),
      format: 'pdf',
      fileUrl: 'https://example.com/test.pdf',
      fileSize: 1024,
      genre: 'Fiction',
      language: 'en',
      averageWordLength: 5,
      complexityScore: 0.5,
      isCompleted: false,
      isPublic: false
    })
    bookId = book._id.toString()
  })

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: 'mltest@example.com' })
    await Book.deleteMany({ userId })
    await ReadingSession.deleteMany({ userId })
    await SpeedRecommendation.deleteMany({ userId })
    await ORPModel.deleteMany({ userId })
    await ORPTrainingData.deleteMany({ userId })
    await ReadingDNA.deleteMany({ userId })
    await mongoose.connection.close()
  })

  describe('GET /api/ml/speed-recommendation', () => {
    it('should return null when no recommendations exist', async () => {
      const response = await request(app)
        .get('/api/ml/speed-recommendation')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.recommendation).toBeNull()
    })

    it('should return the latest recommendation', async () => {
      // Create a test recommendation
      const recommendation = await SpeedRecommendation.create({
        userId,
        sessionId: new mongoose.Types.ObjectId(),
        currentWPM: 300,
        recommendedWPM: 255,
        rationale: 'Test rationale',
        confidence: 0.8,
        textComplexity: 'high',
        pauseRate: 0.1,
        sessionDuration: 300,
        accepted: false
      })

      const response = await request(app)
        .get('/api/ml/speed-recommendation')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.recommendation).toBeDefined()
      expect(response.body.recommendation.recommendedWPM).toBe(255)

      // Clean up
      await SpeedRecommendation.deleteOne({ _id: recommendation._id })
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ml/speed-recommendation')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/ml/speed-recommendation/respond', () => {
    it('should record user response to recommendation', async () => {
      // Create a test recommendation
      const recommendation = await SpeedRecommendation.create({
        userId,
        sessionId: new mongoose.Types.ObjectId(),
        currentWPM: 300,
        recommendedWPM: 255,
        rationale: 'Test rationale',
        confidence: 0.8,
        textComplexity: 'high',
        pauseRate: 0.1,
        sessionDuration: 300,
        accepted: false
      })

      const response = await request(app)
        .post('/api/ml/speed-recommendation/respond')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recommendationId: recommendation._id.toString(),
          action: 'accepted',
          finalWPM: 255
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify the recommendation was updated
      const updated = await SpeedRecommendation.findById(recommendation._id)
      expect(updated?.accepted).toBe(true)
      expect(updated?.userAction).toBe('accepted')
      expect(updated?.userFinalWPM).toBe(255)

      // Clean up
      await SpeedRecommendation.deleteOne({ _id: recommendation._id })
    })

    it('should validate action parameter', async () => {
      const response = await request(app)
        .post('/api/ml/speed-recommendation/respond')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recommendationId: new mongoose.Types.ObjectId().toString(),
          action: 'invalid'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('action must be one of')
    })
  })

  describe('GET /api/ml/orp-status', () => {
    it('should return ORP status and training progress', async () => {
      const response = await request(app)
        .get('/api/ml/orp-status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('model')
      expect(response.body).toHaveProperty('trainingProgress')
      expect(typeof response.body.trainingProgress).toBe('number')
    })
  })

  describe('POST /api/ml/orp-toggle', () => {
    it('should enable personalized ORP', async () => {
      const response = await request(app)
        .post('/api/ml/orp-toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: true })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify user setting was updated
      const user = await User.findById(userId)
      expect(user?.personalizedORPEnabled).toBe(true)
    })

    it('should disable personalized ORP', async () => {
      const response = await request(app)
        .post('/api/ml/orp-toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: false })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify user setting was updated
      const user = await User.findById(userId)
      expect(user?.personalizedORPEnabled).toBe(false)
    })

    it('should validate enabled parameter', async () => {
      const response = await request(app)
        .post('/api/ml/orp-toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('enabled must be a boolean')
    })
  })

  describe('GET /api/ml/recommendations/books', () => {
    it('should return book recommendations with confidence', async () => {
      const response = await request(app)
        .get('/api/ml/recommendations/books')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('books')
      expect(response.body).toHaveProperty('confidence')
      expect(Array.isArray(response.body.books)).toBe(true)
      expect(['low', 'medium', 'high']).toContain(response.body.confidence)
    })
  })

  describe('GET /api/ml/recommendations/time', () => {
    it('should return optimal reading time recommendation', async () => {
      const response = await request(app)
        .get('/api/ml/recommendations/time')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('optimalTime')
      expect(response.body).toHaveProperty('confidence')
      expect(['low', 'high']).toContain(response.body.confidence)
    })
  })

  describe('GET /api/ml/recommendations/wpm', () => {
    it('should return WPM recommendation for a book', async () => {
      const response = await request(app)
        .get(`/api/ml/recommendations/wpm?bookId=${bookId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('recommendedWPM')
      expect(response.body).toHaveProperty('rationale')
      expect(typeof response.body.recommendedWPM).toBe('number')
      expect(typeof response.body.rationale).toBe('string')
    })

    it('should require bookId parameter', async () => {
      const response = await request(app)
        .get('/api/ml/recommendations/wpm')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('bookId')
    })

    it('should return 404 for non-existent book', async () => {
      const fakeBookId = new mongoose.Types.ObjectId().toString()
      const response = await request(app)
        .get(`/api/ml/recommendations/wpm?bookId=${fakeBookId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(404)
    })
  })

  describe('GET /api/ml/reading-dna', () => {
    it('should return error for insufficient data', async () => {
      const response = await request(app)
        .get('/api/ml/reading-dna')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Insufficient data')
    })

    it('should return Reading DNA profile with sufficient data', async () => {
      // Create sufficient reading sessions
      const sessions = []
      for (let i = 0; i < 10; i++) {
        sessions.push({
          userId,
          bookId,
          lastWordIndex: 500 + i * 10,
          currentWPM: 300 + i * 5,
          timeSpent: 600,
          date: new Date(Date.now() - i * 86400000),
          pauseEvents: [],
          speedChanges: [],
          averageWordLength: 5,
          complexityScore: 0.5,
          readingVelocity: 300,
          sessionCompleted: true,
          bookCompleted: false
        })
      }
      await ReadingSession.insertMany(sessions)

      const response = await request(app)
        .get('/api/ml/reading-dna')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('dna')
      expect(response.body).toHaveProperty('visualizations')
      expect(response.body.dna).toHaveProperty('averageWPM')
      expect(response.body.dna).toHaveProperty('medianWPM')
      expect(response.body.visualizations).toHaveProperty('wpmHistory')
      expect(response.body.visualizations).toHaveProperty('activityHeatmap')

      // Clean up
      await ReadingSession.deleteMany({ userId })
    })
  })
})
