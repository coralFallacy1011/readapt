import request from 'supertest'
import mongoose from 'mongoose'
import app from '../index'
import User from '../models/User'
import Goal from '../models/Goal'
import jwt from 'jsonwebtoken'

describe('Gamification Controller', () => {
  let authToken: string
  let userId: string

  beforeAll(async () => {
    // Create test user
    const user = await User.create({
      name: 'Test User',
      email: 'gamificationtest@example.com',
      passwordHash: 'hashedpassword',
      currentStreak: 5,
      longestStreak: 10,
      lastReadDate: '2024-01-15',
      badges: ['streak_7'],
      timezone: 'UTC'
    })
    userId = user._id.toString()

    // Generate auth token
    authToken = jwt.sign(
      { id: userId, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    )
  })

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: 'gamificationtest@example.com' })
    await Goal.deleteMany({ userId })
    await mongoose.connection.close()
  })

  describe('GET /api/gamification/streak', () => {
    it('should return current streak information', async () => {
      const response = await request(app)
        .get('/api/gamification/streak')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        current: 5,
        longest: 10,
        lastReadDate: '2024-01-15'
      })
    })

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/gamification/streak')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/gamification/badges', () => {
    it('should return user badges', async () => {
      const response = await request(app)
        .get('/api/gamification/badges')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.badges).toEqual(['streak_7'])
    })
  })

  describe('POST /api/gamification/goals', () => {
    it('should create a daily words goal', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'words',
          period: 'daily',
          targetValue: 5000
        })

      expect(response.status).toBe(201)
      expect(response.body.goal).toBeDefined()
      expect(response.body.goal.type).toBe('words')
      expect(response.body.goal.period).toBe('daily')
      expect(response.body.goal.targetValue).toBe(5000)
      expect(response.body.goal.currentValue).toBe(0)
      expect(response.body.goal.status).toBe('active')
    })

    it('should create a weekly time goal', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'time',
          period: 'weekly',
          targetValue: 300
        })

      expect(response.status).toBe(201)
      expect(response.body.goal.type).toBe('time')
      expect(response.body.goal.period).toBe('weekly')
    })

    it('should create a monthly books goal', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'books',
          period: 'monthly',
          targetValue: 3
        })

      expect(response.status).toBe(201)
      expect(response.body.goal.type).toBe('books')
      expect(response.body.goal.period).toBe('monthly')
    })

    it('should reject invalid goal type', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid',
          period: 'daily',
          targetValue: 1000
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('type must be one of')
    })

    it('should reject invalid period', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'words',
          period: 'invalid',
          targetValue: 1000
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('period must be one of')
    })

    it('should reject negative target value', async () => {
      const response = await request(app)
        .post('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'words',
          period: 'daily',
          targetValue: -100
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('targetValue must be a positive number')
    })
  })

  describe('GET /api/gamification/goals', () => {
    let goalId: string

    beforeAll(async () => {
      // Create a test goal
      const goal = await Goal.create({
        userId,
        type: 'words',
        period: 'daily',
        targetValue: 5000,
        currentValue: 2500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
      })
      goalId = goal._id.toString()
    })

    it('should return all user goals with daily pace', async () => {
      const response = await request(app)
        .get('/api/gamification/goals')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.goals).toBeDefined()
      expect(Array.isArray(response.body.goals)).toBe(true)
      expect(response.body.goals.length).toBeGreaterThan(0)
      
      // Check that dailyPace is included
      const goal = response.body.goals.find((g: any) => g._id === goalId)
      expect(goal).toBeDefined()
      expect(goal.dailyPace).toBeDefined()
    })
  })

  describe('PUT /api/gamification/goals/:id', () => {
    let goalId: string

    beforeEach(async () => {
      // Create a test goal
      const goal = await Goal.create({
        userId,
        type: 'words',
        period: 'daily',
        targetValue: 5000,
        currentValue: 2500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
      })
      goalId = goal._id.toString()
    })

    afterEach(async () => {
      await Goal.deleteOne({ _id: goalId })
    })

    it('should update goal target value', async () => {
      const response = await request(app)
        .put(`/api/gamification/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetValue: 7000 })

      expect(response.status).toBe(200)
      expect(response.body.goal.targetValue).toBe(7000)
    })

    it('should mark goal as achieved if current value exceeds new target', async () => {
      const response = await request(app)
        .put(`/api/gamification/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetValue: 2000 })

      expect(response.status).toBe(200)
      expect(response.body.goal.status).toBe('achieved')
      expect(response.body.goal.achievedAt).toBeDefined()
    })

    it('should reject invalid target value', async () => {
      const response = await request(app)
        .put(`/api/gamification/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetValue: -100 })

      expect(response.status).toBe(400)
    })

    it('should return 404 for non-existent goal', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .put(`/api/gamification/goals/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetValue: 5000 })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/gamification/goals/:id', () => {
    let goalId: string

    beforeEach(async () => {
      // Create a test goal
      const goal = await Goal.create({
        userId,
        type: 'words',
        period: 'daily',
        targetValue: 5000,
        currentValue: 2500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active'
      })
      goalId = goal._id.toString()
    })

    it('should cancel a goal', async () => {
      const response = await request(app)
        .delete(`/api/gamification/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify goal is marked as cancelled
      const goal = await Goal.findById(goalId)
      expect(goal?.status).toBe('cancelled')
    })

    it('should return 404 for non-existent goal', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .delete(`/api/gamification/goals/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(404)
    })
  })
})
