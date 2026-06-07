import Redis from 'ioredis'

// Singleton pattern — same reasoning as lib/db.ts.
// ioredis reconnects automatically; no manual retry loop needed.
const globalForRedis = globalThis as unknown as { redis: Redis }

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Exponential backoff: 50ms, 100ms, 200ms, then give up
      if (times > 3) return null
      return Math.min(times * 50, 200)
    },
    lazyConnect: true,
  })

  client.on('error', (err) => {
    // Log but don't crash — app should degrade gracefully if Redis is down
    console.error('[Redis] Connection error:', err.message)
  })

  return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ── Cache helpers ─────────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // Cache write failure is non-fatal — app continues without cache
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch {
    // Non-fatal
  }
}

// ── Cache key constants ───────────────────────────────────────────────────────

export const CACHE_KEYS = {
  siteStats: 'stats:site',
  professorProfile: (slug: string) => `prof:${slug}`,
  searchResults: (queryHash: string) => `search:${queryHash}`,
} as const

export const CACHE_TTL = {
  siteStats: 60, // 1 minute
  professorProfile: 60, // 1 minute — new reviews appear within 1 min
  searchResults: 30, // 30 seconds
} as const
