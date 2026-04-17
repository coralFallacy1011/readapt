import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer | null = null

/**
 * Initialize the WebSocket utility with the Socket.IO server instance
 */
export function initializeWebSocket(ioInstance: SocketIOServer): void {
  io = ioInstance
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeWebSocket first.')
  }
  return io
}

/**
 * Emit an event to a specific user
 */
export function emitToUser(userId: string, event: string, data: any): void {
  const ioInstance = getIO()
  ioInstance.to(`user:${userId}`).emit(event, data)
}

/**
 * Emit an event to multiple users
 */
export function emitToUsers(userIds: string[], event: string, data: any): void {
  const ioInstance = getIO()
  userIds.forEach((userId) => {
    ioInstance.to(`user:${userId}`).emit(event, data)
  })
}

/**
 * Broadcast an event to all connected clients
 */
export function broadcastEvent(event: string, data: any): void {
  const ioInstance = getIO()
  ioInstance.emit(event, data)
}
