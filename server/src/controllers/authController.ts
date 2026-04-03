import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User'

function signToken(id: string, email: string): string {
  const secret = process.env.JWT_SECRET!
  return jwt.sign({ id, email }, secret, { expiresIn: '24h' })
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body

  if (!name) { res.status(400).json({ error: 'name is required' }); return }
  if (!email) { res.status(400).json({ error: 'email is required' }); return }
  if (!password) { res.status(400).json({ error: 'password is required' }); return }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) { res.status(409).json({ error: 'Email already in use' }); return }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, passwordHash })
    const token = signToken(user._id.toString(), user.email)

    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body

  if (!email) { res.status(400).json({ error: 'email is required' }); return }
  if (!password) { res.status(400).json({ error: 'password is required' }); return }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) { res.status(401).json({ error: 'Invalid email or password' }); return }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) { res.status(401).json({ error: 'Invalid email or password' }); return }

    const token = signToken(user._id.toString(), user.email)
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}
