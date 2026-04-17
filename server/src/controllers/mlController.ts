import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import SpeedRecommendation from '../models/SpeedRecommendation'
import ORPModel from '../models/ORPModel'
import ORPTrainingData from '../models/ORPTrainingData'
import User from '../models/User'
import Book from '../models/Book'
import { Types } from 'mongoose'
import {
  generateBookRecommendations,
  findOptimalReadingTime,
  getTimeSpecificWPMRecommendations,
  getInitialWPMForBook
} from '../services/ml/recommendationEngine'
import { generateReadingDNA } from '../services/ml/readingDNA'

/**
 * GET /api/ml/speed-recommendation
 * Get the latest speed recommendation for the authenticated user
 */
export async function getSpeedRecommendation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    // Get the most recent recommendation
    const recommendation = await SpeedRecommendation.findOne({ userId })
      .sort({ timestamp: -1 })
      .lean()

    if (!recommendation) {
      res.json({ message: 'Insufficient data' })
      return
    }

    res.json({ recommendation })
  } catch (error) {
    console.error('Error fetching speed recommendation:', error)
    res.json({ message: 'Insufficient data' })
  }
}

/**
 * POST /api/ml/speed-recommendation/respond
 * Record user's response to a speed recommendation
 */
export async function respondToSpeedRecommendation(req: AuthRequest, res: Response): Promise<void> {
  const { recommendationId, action, finalWPM } = req.body

  if (!recommendationId) {
    res.status(400).json({ error: 'recommendationId is required' })
    return
  }

  if (!action || !['accepted', 'rejected', 'modified', 'ignored'].includes(action)) {
    res.status(400).json({ error: 'action must be one of: accepted, rejected, modified, ignored' })
    return
  }

  try {
    const userId = req.user!.id

    // Find the recommendation
    const recommendation = await SpeedRecommendation.findOne({
      _id: recommendationId,
      userId
    })

    if (!recommendation) {
      res.status(404).json({ error: 'Recommendation not found' })
      return
    }

    // Update recommendation with user response
    recommendation.accepted = action === 'accepted'
    recommendation.userAction = action
    if (finalWPM !== undefined) {
      recommendation.userFinalWPM = finalWPM
    }

    await recommendation.save()

    res.json({ success: true })
  } catch (error) {
    console.error('Error responding to speed recommendation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/ml/orp-status
 * Get ORP model status and training progress for the authenticated user
 */
export async function getORPStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id
    const userObjectId = new Types.ObjectId(userId)

    // Get the user's ORP model
    const model = await ORPModel.findOne({ userId: userObjectId }).lean()

    // Calculate training progress
    const trainingDataCount = await ORPTrainingData.countDocuments({ userId: userObjectId })
    const requiredData = 2000
    const trainingProgress = Math.min((trainingDataCount / requiredData) * 100, 100)

    res.json({
      model: model ?? { status: 'not_trained', trainingProgress: 0 },
      trainingProgress: Math.round(trainingProgress)
    })
  } catch (error) {
    console.error('Error fetching ORP status:', error)
    res.json({
      model: { status: 'not_trained', trainingProgress: 0 },
      trainingProgress: 0
    })
  }
}

/**
 * POST /api/ml/orp-toggle
 * Enable or disable personalized ORP for the authenticated user
 */
export async function toggleORP(req: AuthRequest, res: Response): Promise<void> {
  const { enabled } = req.body

  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' })
    return
  }

  try {
    const userId = req.user!.id

    // Update user's ORP preference
    const user = await User.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    user.personalizedORPEnabled = enabled
    await user.save()

    res.json({ success: true })
  } catch (error) {
    console.error('Error toggling ORP:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/ml/recommendations/books
 * Get book recommendations for the authenticated user
 */
export async function getBookRecommendations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const books = await generateBookRecommendations(userId)

    // Determine confidence level based on number of completed books
    const completedBooksCount = await Book.countDocuments({
      userId: new Types.ObjectId(userId),
      isCompleted: true
    })

    let confidence: string
    if (completedBooksCount >= 10) {
      confidence = 'high'
    } else if (completedBooksCount >= 5) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    res.json({ books, confidence })
  } catch (error) {
    console.error('Error generating book recommendations:', error)
    res.json({ books: [], confidence: 'low' })
  }
}

/**
 * GET /api/ml/recommendations/time
 * Get optimal reading time recommendation for the authenticated user
 */
export async function getTimeRecommendation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const optimalTime = await findOptimalReadingTime(userId)

    // Determine confidence based on whether we found an optimal time
    const confidence = optimalTime ? 'high' : 'low'

    res.json({ optimalTime, confidence })
  } catch (error) {
    console.error('Error generating time recommendation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/ml/recommendations/wpm
 * Get WPM recommendation for a specific book
 */
export async function getWPMRecommendation(req: AuthRequest, res: Response): Promise<void> {
  const { bookId } = req.query

  if (!bookId || typeof bookId !== 'string') {
    res.status(400).json({ error: 'bookId query parameter is required' })
    return
  }

  try {
    const userId = req.user!.id

    // Get the book
    const book = await Book.findById(bookId)
    if (!book) {
      res.status(404).json({ error: 'Book not found' })
      return
    }

    // Verify book belongs to user
    if (book.userId.toString() !== userId) {
      res.status(403).json({ error: 'Unauthorized' })
      return
    }

    // Get initial WPM recommendation
    const recommendedWPM = await getInitialWPMForBook(userId, book.complexityScore)

    // Generate rationale based on complexity
    let rationale: string
    if (book.complexityScore < 0.3) {
      rationale = 'This book has simple text, suggesting a faster reading pace'
    } else if (book.complexityScore < 0.7) {
      rationale = 'This book has moderate complexity, suggesting your typical reading pace'
    } else {
      rationale = 'This book has complex text, suggesting a slower reading pace'
    }

    res.json({ recommendedWPM, rationale })
  } catch (error) {
    console.error('Error generating WPM recommendation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/ml/reading-dna
 * Get Reading DNA profile for the authenticated user
 */
export async function getReadingDNA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id

    const dna = await generateReadingDNA(userId)

    // Generate visualizations object
    const visualizations = {
      wpmHistory: dna.wpmHistory,
      activityHeatmap: dna.activityHeatmap,
      genreDistribution: dna.genreAffinity
    }

    res.json({ dna, visualizations })
  } catch (error: any) {
    console.error('Error generating Reading DNA:', error)
    res.json({ message: 'Insufficient data to generate Reading DNA' })
  }
}
