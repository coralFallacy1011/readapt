import { useEffect, useRef, useState, useCallback } from 'react'

// socket.io-client is required but not yet installed.
// Run: npm install socket.io-client
// Then uncomment the import below and remove the stub types.
//
// import { io, Socket } from 'socket.io-client'

// --- Stub types until socket.io-client is installed ---
type Socket = {
  connected: boolean
  on: (event: string, handler: (data: unknown) => void) => void
  off: (event: string, handler: (data: unknown) => void) => void
  emit: (event: string, data?: unknown) => void
  disconnect: () => void
}

function createSocket(_url: string, _opts: unknown): Socket {
  console.warn('socket.io-client is not installed. Run: npm install socket.io-client')
  return {
    connected: false,
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {},
  }
}
// --- End stub ---

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export interface UseWebSocketReturn {
  isConnected: boolean
  on: (event: string, handler: (data: unknown) => void) => void
  off: (event: string, handler: (data: unknown) => void) => void
  emit: (event: string, data?: unknown) => void
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')

    // When socket.io-client is installed, replace createSocket with:
    // const socket = io(SERVER_URL, { auth: { token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 })
    const socket = createSocket(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    setIsConnected(socket.connected)

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.off(event, handler)
  }, [])

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return { isConnected, on, off, emit }
}
