import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { register, login } from '../controllers/authController'
import User from '../models/User'

// Mock mongoose model and bcrypt so no real DB is needed
jest.mock('../models/User')
jest.mock('bcryptjs')

const SECRET = 'test-secret'

function makeReq(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.JWT_SECRET = SECRET
})

afterEach(() => {
  delete process.env.JWT_SECRET
})

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('register', () => {
  it('happy path — creates user and returns token + user', async () => {
    const fakeUser = { _id: 'uid1', name: 'Alice', email: 'alice@example.com', passwordHash: 'hashed' }
    ;(User.findOne as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed')
    ;(User.create as jest.Mock).mockResolvedValue(fakeUser)

    const req = makeReq({ name: 'Alice', email: 'alice@example.com', password: 'secret123' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body).toHaveProperty('token')
    expect(body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' })

    // token must be a valid JWT
    const decoded = jwt.verify(body.token, SECRET) as { id: string; email: string }
    expect(decoded.id).toBe('uid1')
  })

  it('returns 409 when email already exists', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue({ email: 'alice@example.com' })

    const req = makeReq({ name: 'Alice', email: 'alice@example.com', password: 'secret123' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already in use' })
  })

  it('returns 400 when name is missing', async () => {
    const req = makeReq({ email: 'alice@example.com', password: 'secret123' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect((res.json as jest.Mock).mock.calls[0][0].error).toMatch(/name/i)
  })

  it('returns 400 when email is missing', async () => {
    const req = makeReq({ name: 'Alice', password: 'secret123' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect((res.json as jest.Mock).mock.calls[0][0].error).toMatch(/email/i)
  })

  it('returns 400 when password is missing', async () => {
    const req = makeReq({ name: 'Alice', email: 'alice@example.com' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect((res.json as jest.Mock).mock.calls[0][0].error).toMatch(/password/i)
  })
})

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe('login', () => {
  it('happy path — returns token + user for valid credentials', async () => {
    const fakeUser = { _id: 'uid2', name: 'Bob', email: 'bob@example.com', passwordHash: 'hashed' }
    ;(User.findOne as jest.Mock).mockResolvedValue(fakeUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const req = makeReq({ email: 'bob@example.com', password: 'correct' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).not.toHaveBeenCalled() // defaults to 200
    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body).toHaveProperty('token')
    expect(body.user).toMatchObject({ name: 'Bob', email: 'bob@example.com' })
  })

  it('returns 401 when email is not found', async () => {
    ;(User.findOne as jest.Mock).mockResolvedValue(null)

    const req = makeReq({ email: 'nobody@example.com', password: 'whatever' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password' })
  })

  it('returns 401 when password is wrong', async () => {
    const fakeUser = { _id: 'uid2', name: 'Bob', email: 'bob@example.com', passwordHash: 'hashed' }
    ;(User.findOne as jest.Mock).mockResolvedValue(fakeUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    const req = makeReq({ email: 'bob@example.com', password: 'wrongpassword' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password' })
  })
})
