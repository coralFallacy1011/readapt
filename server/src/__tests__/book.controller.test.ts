import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { uploadBook, getAll, getById } from '../controllers/bookController'
import Book from '../models/Book'

jest.mock('../models/Book')
jest.mock('../utils/pdfExtractor')
jest.mock('../utils/textCleaner')

import { extractTextFromPDF } from '../utils/pdfExtractor'
import { cleanText } from '../utils/textCleaner'

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { id: 'user1', email: 'user1@example.com' },
    params: {},
    body: {},
    ...overrides,
  } as unknown as AuthRequest
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
})

// ---------------------------------------------------------------------------
// uploadBook
// ---------------------------------------------------------------------------
describe('uploadBook', () => {
  it('stores book with the authenticated userId', async () => {
    const words = ['hello', 'world']
    ;(extractTextFromPDF as jest.Mock).mockResolvedValue('hello world')
    ;(cleanText as jest.Mock).mockReturnValue(words)

    const savedBook = {
      _id: 'book1',
      userId: 'user1',
      title: 'my-doc',
      totalWords: 2,
      words,
    }
    ;(Book.create as jest.Mock).mockResolvedValue(savedBook)

    const req = makeReq({
      file: {
        buffer: Buffer.from('pdf-bytes'),
        mimetype: 'application/pdf',
        originalname: 'my-doc.pdf',
      } as Express.Multer.File,
    })
    const res = makeRes()

    await uploadBook(req, res)

    expect(Book.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user1' })
    )
    expect(res.status).toHaveBeenCalledWith(201)
    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body.book.userId).toBe('user1')
  })

  it('returns 400 when no file is provided', async () => {
    const req = makeReq({ file: undefined })
    const res = makeRes()

    await uploadBook(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Only PDF files are accepted' })
  })
})

// ---------------------------------------------------------------------------
// getAll
// ---------------------------------------------------------------------------
describe('getAll', () => {
  it("returns only the authenticated user's books", async () => {
    const userBooks = [
      { _id: 'b1', userId: 'user1', title: 'Book A' },
      { _id: 'b2', userId: 'user1', title: 'Book B' },
    ]
    const selectMock = jest.fn().mockResolvedValue(userBooks)
    ;(Book.find as jest.Mock).mockReturnValue({ select: selectMock })

    const req = makeReq()
    const res = makeRes()

    await getAll(req, res)

    expect(Book.find).toHaveBeenCalledWith({ userId: 'user1' })
    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body.books).toEqual(userBooks)
    // Ensure no books from other users leak through
    body.books.forEach((b: { userId: string }) => expect(b.userId).toBe('user1'))
  })
})

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
describe('getById', () => {
  it('returns 403 when the book belongs to a different user', async () => {
    const otherUsersBook = {
      _id: 'book99',
      userId: { toString: () => 'other-user' },
      title: 'Not yours',
    }
    ;(Book.findById as jest.Mock).mockResolvedValue(otherUsersBook)

    const req = makeReq({ params: { id: 'book99' } })
    const res = makeRes()

    await getById(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
  })

  it('returns 404 when the book does not exist', async () => {
    ;(Book.findById as jest.Mock).mockResolvedValue(null)

    const req = makeReq({ params: { id: 'nonexistent-id' } })
    const res = makeRes()

    await getById(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })

  it('returns the book when it belongs to the authenticated user', async () => {
    const ownBook = {
      _id: 'book1',
      userId: { toString: () => 'user1' },
      title: 'My Book',
      words: ['a', 'b'],
    }
    ;(Book.findById as jest.Mock).mockResolvedValue(ownBook)

    const req = makeReq({ params: { id: 'book1' } })
    const res = makeRes()

    await getById(req, res)

    expect(res.status).not.toHaveBeenCalled()
    const body = (res.json as jest.Mock).mock.calls[0][0]
    expect(body.book).toEqual(ownBook)
  })
})
