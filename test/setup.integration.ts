// Per-file setup for integration tests.
//
// - Mocks @/lib/redis with an in-memory store so dedup, caching, and
//   counters work without bringing up an actual Redis instance.
// - Provides a shared `redisStore` for tests that need to assert on it
//   (e.g. report dedup keys).

import { afterEach, beforeEach, vi } from 'vitest'

export const __redisStore = new Map<string, { value: string; expiresAt: number | null }>()

vi.mock('@/lib/redis', async () => {
  type SetMode = 'NX' | 'XX'

  const redis = {
    get: vi.fn(async (key: string) => {
      const entry = __redisStore.get(key)
      if (!entry) return null
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        __redisStore.delete(key)
        return null
      }
      return entry.value
    }),
    set: vi.fn(
      async (
        key: string,
        value: string,
        _exFlag?: 'EX',
        ttlSeconds?: number,
        mode?: SetMode,
      ): Promise<'OK' | null> => {
        if (mode === 'NX' && __redisStore.has(key)) {
          // Honour existing expiry — pretend it's still set
          const entry = __redisStore.get(key)!
          if (entry.expiresAt === null || Date.now() <= entry.expiresAt) return null
        }
        if (mode === 'XX' && !__redisStore.has(key)) return null
        const expiresAt = typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : null
        __redisStore.set(key, { value, expiresAt })
        return 'OK'
      },
    ),
    del: vi.fn(async (key: string) => {
      const had = __redisStore.delete(key)
      return had ? 1 : 0
    }),
    ping: vi.fn(async () => 'PONG'),
  }

  const CACHE_KEYS = {
    siteStats: 'stats:site',
    professorProfile: (slug: string) => `prof:${slug}`,
    searchResults: (hash: string) => `search:${hash}`,
  } as const

  const CACHE_TTL = {
    siteStats: 60,
    professorProfile: 60,
    searchResults: 30,
  } as const

  return {
    redis,
    getCache: vi.fn(async () => null),
    setCache: vi.fn(async () => {}),
    deleteCache: vi.fn(async (key: string) => {
      __redisStore.delete(key)
    }),
    // Mirrors the real acquireOnce in lib/redis.ts — atomic set-if-absent
    // with TTL. Returns true iff we won the lock.
    acquireOnce: vi.fn(async (key: string, ttlSeconds: number): Promise<boolean> => {
      const existing = __redisStore.get(key)
      if (existing && (existing.expiresAt === null || Date.now() <= existing.expiresAt)) {
        return false
      }
      __redisStore.set(key, { value: '1', expiresAt: Date.now() + ttlSeconds * 1000 })
      return true
    }),
    CACHE_KEYS,
    CACHE_TTL,
  }
})

// Also mock @/lib/auth so each test can inject its own session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}))

beforeEach(() => {
  __redisStore.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  __redisStore.clear()
})
