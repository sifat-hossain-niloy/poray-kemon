import Redis from 'ioredis'

// ─────────────────────────────────────────────────────────────────────────────
// Redis client — singleton, ioredis-compatible.
//
// REDIS_URL is OPTIONAL. When unset (or when the URL is unreachable) the
// helpers below degrade to no-ops — reads return null, writes are dropped.
// This lets the app boot on Vercel before Upstash is provisioned, and it
// lets local dev / integration tests skip Redis entirely.
//
// Upstash Redis Free tier is fully compatible: use their `rediss://…` URL
// (TLS on port 6379) as REDIS_URL and this file needs no changes.
// ─────────────────────────────────────────────────────────────────────────────

const globalForRedis = globalThis as unknown as { redis: Redis | null }

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null
      return Math.min(times * 50, 200)
    },
    lazyConnect: true,
    // Upstash / most managed Redis providers require TLS on `rediss://` URLs.
    // ioredis auto-detects TLS from the URL scheme, so no extra config here.
  })

  client.on('error', (err) => {
    // Log but don't crash — the cache helpers below already treat every Redis
    // failure as a soft miss.
    console.error('[Redis] Connection error:', err.message)
  })

  return client
}

export const redis: Redis | null = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ── Cache helpers ─────────────────────────────────────────────────────────────
// Every helper is safe to call even when `redis` is null. Cache misses look
// identical to a Redis outage: read returns null, writes are dropped.

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const value = await redis.get(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // Non-fatal — app continues without cache
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    // Non-fatal
  }
}

// NX-based single-writer helper used by /api/reports for dedup. Returns
// true iff we won the lock. If Redis is absent, returns true — the SQL
// unique constraint on (user_id, review_id) is our fallback dedup.
export async function acquireOnce(key: string, ttlSeconds: number): Promise<boolean> {
  if (!redis) return true
  try {
    const res = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
    return res === 'OK'
  } catch {
    return true
  }
}

// ── Cache key constants ───────────────────────────────────────────────────────

export const CACHE_KEYS = {
  siteStats: 'stats:site',
  professorProfile: (slug: string) => `prof:${slug}`,
  searchResults: (queryHash: string) => `search:${queryHash}`,
  topProfessors: 'leaderboard:top-professors',
} as const

export const CACHE_TTL = {
  siteStats: 60, // 1 minute
  professorProfile: 60, // 1 minute — new reviews appear within 1 min
  searchResults: 30, // 30 seconds
  topProfessors: 300, // 5 minutes — leaderboard doesn't move that fast
} as const
