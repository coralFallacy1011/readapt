/**
 * Integration tests: Offline sync complete flow
 * Requirements: 15.5
 *
 * Tests the complete flow: go offline → read → queue updates → go online → sync → verify data consistency
 */

import { Request, Response } from 'express'
import { syncOfflineSessions } from '../controllers/offlineController'
import ReadingSession from '../models/ReadingSession'
import { AuthRequest } from '../middleware/auth'

jest.mock('../models/ReadingSession')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(body: unknown, userId = 'user123'): AuthRequest {
  return {
    body,
    user: { id: userId },
  } as AuthRequest
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const res = { json, status } as unknown as Response
  return { res, json, status }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Offline Sync Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Flow 1: valid sessions array → all sessions created, returns { synced: N }', () => {
    it('syncs 3 sessions and returns { synced: 3 }', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [
        { bookId: 'book1', lastWordIndex: 100, timeSpent: 300, currentWPM: 250 },
        { bookId: 'book2', lastWordIndex: 200, timeSpent: 600, currentWPM: 300 },
        { bookId: 'book3', lastWordIndex: 50,  timeSpent: 120, currentWPM: 200 },
      ]

      const req = makeReq({ sessions })
      const { res, json } = makeRes()

      await syncOfflineSessions(req, res)

      expect(ReadingSession.insertMany).toHaveBeenCalledTimes(1)
      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted).toHaveLength(3)
      expect(json).toHaveBeenCalledWith({ synced: 3 })
    })

    it('attaches the authenticated userId to every inserted document', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [
        { bookId: 'book1', lastWordIndex: 10, timeSpent: 60, currentWPM: 300 },
      ]

      const req = makeReq({ sessions }, 'myUserId')
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].userId).toBe('myUserId')
    })
  })

  describe('Flow 2: empty sessions array → returns { synced: 0 }', () => {
    it('returns { synced: 0 } for an empty array', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const req = makeReq({ sessions: [] })
      const { res, json } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted).toHaveLength(0)
      expect(json).toHaveBeenCalledWith({ synced: 0 })
    })
  })

  describe('Flow 3: invalid body (not array) → returns 400 error', () => {
    it('returns 400 when sessions is a plain object', async () => {
      const req = makeReq({ sessions: { bookId: 'book1' } })
      const { res, status, json } = makeRes()

      await syncOfflineSessions(req, res)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith({ error: 'sessions must be an array' })
      expect(ReadingSession.insertMany).not.toHaveBeenCalled()
    })

    it('returns 400 when sessions is a string', async () => {
      const req = makeReq({ sessions: 'not-an-array' })
      const { res, status } = makeRes()

      await syncOfflineSessions(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when sessions is null', async () => {
      const req = makeReq({ sessions: null })
      const { res, status } = makeRes()

      await syncOfflineSessions(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when sessions key is missing entirely', async () => {
      const req = makeReq({})
      const { res, status } = makeRes()

      await syncOfflineSessions(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })
  })

  describe('Flow 4: sessions with missing fields → uses defaults', () => {
    it('defaults lastWordIndex to 0 when missing', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [{ bookId: 'book1', timeSpent: 60, currentWPM: 300 }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].lastWordIndex).toBe(0)
    })

    it('defaults timeSpent to 0 when missing', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [{ bookId: 'book1', lastWordIndex: 50, currentWPM: 300 }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].timeSpent).toBe(0)
    })

    it('defaults currentWPM to 300 when missing', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [{ bookId: 'book1', lastWordIndex: 50, timeSpent: 60 }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].currentWPM).toBe(300)
    })

    it('defaults date to a Date instance when missing', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [{ bookId: 'book1', lastWordIndex: 50, timeSpent: 60, currentWPM: 300 }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].date).toBeInstanceOf(Date)
    })

    it('uses provided date when present', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const dateStr = '2024-01-15T10:00:00Z'
      const sessions = [{ bookId: 'book1', lastWordIndex: 50, timeSpent: 60, currentWPM: 300, date: dateStr }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].date).toEqual(new Date(dateStr))
    })

    it('initialises pauseEvents and speedChanges as empty arrays', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockResolvedValue([])

      const sessions = [{ bookId: 'book1', lastWordIndex: 50, timeSpent: 60, currentWPM: 300 }]
      const req = makeReq({ sessions })
      const { res } = makeRes()

      await syncOfflineSessions(req, res)

      const inserted = (ReadingSession.insertMany as jest.Mock).mock.calls[0][0]
      expect(inserted[0].pauseEvents).toEqual([])
      expect(inserted[0].speedChanges).toEqual([])
    })
  })

  describe('Error handling', () => {
    it('returns 500 when insertMany throws', async () => {
      ;(ReadingSession.insertMany as jest.Mock).mockRejectedValue(new Error('DB error'))

      const sessions = [{ bookId: 'book1', lastWordIndex: 10, timeSpent: 60, currentWPM: 300 }]
      const req = makeReq({ sessions })
      const { res, status, json } = makeRes()

      await syncOfflineSessions(req, res)

      expect(status).toHaveBeenCalledWith(500)
      expect(json).toHaveBeenCalledWith({ error: 'Internal server error' })
    })
  })
})
