import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import User from '../models/User'
import Follow from '../models/Follow'
import Book from '../models/Book'

export async function searchUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string) ?? ''
    if (!q.trim()) { res.json([]); return }
    const users = await User.find({
      _id: { $ne: req.user!.id },
      name: { $regex: q.trim(), $options: 'i' }
    }).select('_id name').limit(20)
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function followUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.body
    if (!userId) { res.status(400).json({ error: 'userId required' }); return }
    await Follow.create({ followerId: req.user!.id, followingId: userId })
    res.status(201).json({ message: 'Following' })
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code
    if (code === 11000) { res.status(409).json({ error: 'Already following' }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function unfollowUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Follow.deleteOne({ followerId: req.user!.id, followingId: req.params.userId })
    res.json({ message: 'Unfollowed' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFollowing(req: AuthRequest, res: Response): Promise<void> {
  try {
    const follows = await Follow.find({ followerId: req.user!.id }).select('followingId')
    const ids = follows.map(f => f.followingId)
    const users = await User.find({ _id: { $in: ids } }).select('_id name')
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFollowingFeed(req: AuthRequest, res: Response): Promise<void> {
  try {
    const follows = await Follow.find({ followerId: req.user!.id }).select('followingId')
    const ids = follows.map(f => f.followingId)
    const books = await Book.find({ userId: { $in: ids }, isPublic: true })
      .select('-words -pdfData')
      .sort({ createdAt: -1 })
      .limit(20)
      .populate<{ userId: { _id: unknown; name: string } }>('userId', '_id name')
    const result = books.map(b => ({
      _id: b._id,
      title: b.title,
      totalWords: b.totalWords,
      createdAt: b.createdAt,
      owner: b.userId
    }))
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
