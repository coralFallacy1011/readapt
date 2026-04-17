import { Server as SocketIOServer } from 'socket.io'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { socketAuthMiddleware } from '../middleware/socketAuth'

describe('WebSocket Server', () => {
  let io: SocketIOServer
  let httpServer: any
  let clientSocket: ClientSocket
  const PORT = 5001
  const JWT_SECRET = 'test-secret'

  beforeAll((done) => {
    // Set up test JWT secret
    process.env.JWT_SECRET = JWT_SECRET

    // Create HTTP server and Socket.IO instance
    httpServer = createServer()
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        credentials: true,
      },
    })

    // Apply authentication middleware
    io.use(socketAuthMiddleware)

    // Add connection handler to join user rooms
    io.on('connection', (socket: any) => {
      if (socket.user?.id) {
        socket.join(`user:${socket.user.id}`)
      }
    })

    // Start server
    httpServer.listen(PORT, () => {
      done()
    })
  })

  afterAll((done) => {
    io.close()
    httpServer.close(() => {
      done()
    })
  })

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
  })

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`)

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication error')
        done()
      })

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'))
      })
    })

    it('should reject connection with invalid token', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`, {
        auth: {
          token: 'invalid-token',
        },
      })

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication error')
        done()
      })

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'))
      })
    })

    it('should accept connection with valid token', (done) => {
      const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, JWT_SECRET)

      clientSocket = ioClient(`http://localhost:${PORT}`, {
        auth: {
          token,
        },
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        done()
      })

      clientSocket.on('connect_error', (error) => {
        done(new Error(`Should connect with valid token: ${error.message}`))
      })
    })

    it('should accept connection with token in authorization header', (done) => {
      const token = jwt.sign({ id: 'user456', email: 'test2@example.com' }, JWT_SECRET)

      clientSocket = ioClient(`http://localhost:${PORT}`, {
        extraHeaders: {
          authorization: `Bearer ${token}`,
        },
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        done()
      })

      clientSocket.on('connect_error', (error) => {
        done(new Error(`Should connect with valid token: ${error.message}`))
      })
    })
  })

  describe('Connection Management', () => {
    it('should handle user-specific rooms', (done) => {
      const userId = 'user789'
      const token = jwt.sign({ id: userId, email: 'test3@example.com' }, JWT_SECRET)

      // Set up a one-time listener for this specific test
      const connectionHandler = (socket: any) => {
        // Check if socket joined the user-specific room
        const rooms = Array.from(socket.rooms)
        expect(rooms).toContain(`user:${userId}`)
        io.off('connection', connectionHandler)
        done()
      }

      io.on('connection', connectionHandler)

      clientSocket = ioClient(`http://localhost:${PORT}`, {
        auth: {
          token,
        },
      })
    })

    it('should handle disconnection', (done) => {
      const token = jwt.sign({ id: 'user999', email: 'test4@example.com' }, JWT_SECRET)

      const connectionHandler = (socket: any) => {
        socket.on('disconnect', () => {
          io.off('connection', connectionHandler)
          done()
        })
      }

      io.on('connection', connectionHandler)

      clientSocket = ioClient(`http://localhost:${PORT}`, {
        auth: {
          token,
        },
      })

      clientSocket.on('connect', () => {
        clientSocket.disconnect()
      })
    })
  })
})
