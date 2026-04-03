import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const SECRET = 'test-secret'

function makeReq(authHeader?: string): AuthRequest {
  return { headers: { authorization: authHeader } } as unknown as AuthRequest
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

const next: NextFunction = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.JWT_SECRET = SECRET
})

afterEach(() => {
  delete process.env.JWT_SECRET
})

describe('authMiddleware', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq()
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const req = makeReq('Basic sometoken')
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 500 when JWT_SECRET env var is not set', () => {
    delete process.env.JWT_SECRET
    const token = jwt.sign({ id: '123', email: 'a@b.com' }, SECRET)
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an invalid/tampered token', () => {
    const req = makeReq('Bearer invalidtoken')
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ id: '123', email: 'a@b.com' }, SECRET, { expiresIn: -1 })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('populates req.user and calls next() for a valid token', () => {
    const payload = { id: 'user-id-1', email: 'user@example.com' }
    const token = jwt.sign(payload, SECRET)
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toEqual({ id: payload.id, email: payload.email })
    expect(res.status).not.toHaveBeenCalled()
  })
})
