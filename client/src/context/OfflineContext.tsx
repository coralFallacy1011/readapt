import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/index'

interface QueuedSession {
  bookId: string
  lastWordIndex: number
  timeSpent: number
  currentWPM: number
}

export interface OfflineContextType {
  isOnline: boolean
  queueUpdate: (session: QueuedSession) => void
}

const OfflineContext = createContext<OfflineContextType | null>(null)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const queueRef = useRef<QueuedSession[]>([])

  const syncQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return

    const sessions = [...queueRef.current]
    queueRef.current = []

    try {
      await api.post('/offline/sync', { sessions })
    } catch {
      // Re-queue on failure
      queueRef.current = [...sessions, ...queueRef.current]
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncQueue])

  const queueUpdate = useCallback((session: QueuedSession) => {
    if (isOnline) {
      // Attempt immediate sync; fall back to queue on error
      api.post('/offline/sync', { sessions: [session] }).catch(() => {
        queueRef.current.push(session)
      })
    } else {
      queueRef.current.push(session)
    }
  }, [isOnline])

  return (
    <OfflineContext.Provider value={{ isOnline, queueUpdate }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline(): OfflineContextType {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
