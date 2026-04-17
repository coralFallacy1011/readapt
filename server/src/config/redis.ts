import { createClient, RedisClientType } from 'redis'

let redisClient: RedisClientType | null = null

export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with max 3 seconds
        if (retries > 10) {
          console.error('Redis: Max reconnection attempts reached')
          return new Error('Max reconnection attempts reached')
        }
        const delay = Math.min(retries * 100, 3000)
        console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`)
        return delay
      },
      connectTimeout: 10000,
    },
  })

  // Error handling
  redisClient.on('error', (err) => {
    console.error('Redis client error:', err)
  })

  redisClient.on('connect', () => {
    console.log('Redis client connecting...')
  })

  redisClient.on('ready', () => {
    console.log('Redis client ready')
  })

  redisClient.on('reconnecting', () => {
    console.log('Redis client reconnecting...')
  })

  redisClient.on('end', () => {
    console.log('Redis client connection closed')
  })

  // Connect to Redis
  await redisClient.connect()

  console.log('Redis connected successfully')

  return redisClient
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.')
  }
  return redisClient
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis disconnected')
  }
}
