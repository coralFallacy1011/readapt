import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export interface AuthenticatedSocket extends Socket {
  user?: { id: string; email: string }
}

export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]

  if (!token) {
    return next(new Error('Authentication error: No token provided'))
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return next(new Error('Internal server error'))
  }

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string }
    socket.user = { id: decoded.id, email: decoded.email }
    next()
  } catch (error) {
    next(new Error('Authentication error: Invalid token'))
  }
}
