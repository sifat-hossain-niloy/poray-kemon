# ADR-005: Redis 7 for Caching and Session Storage

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

Two distinct needs require an in-memory data store:

1. **Session storage** — NextAuth sessions must be persisted server-side (non-JWT strategy)
2. **Read caching** — frequently accessed data (professor profiles, site stats, search results) should not hit PostgreSQL on every request

---

## Decision

Use **Redis 7** (Docker, Alpine) for both session storage and application-level caching.

---

## Rationale

### Why Redis over alternatives

| Option              | Sessions | Caching | Notes                                                           |
| ------------------- | -------- | ------- | --------------------------------------------------------------- |
| Redis               | ✅       | ✅      | Purpose-built, TTL native, fast                                 |
| PostgreSQL          | ✅       | ⚠️      | Sessions work but polling overhead; caching is an antipattern   |
| In-memory (Node.js) | ❌       | ⚠️      | Lost on restart; doesn't work across multiple Next.js instances |
| Vercel KV           | ✅       | ✅      | SaaS Redis — good for Vercel deployment, not self-hosted        |
| Upstash             | ✅       | ✅      | Serverless Redis — best for Vercel, has free tier               |

Redis is the standard choice and serves both needs with the same service.

### Caching Strategy

**Cache-aside** pattern (not write-through):

1. Request comes in
2. Check Redis → cache hit → return
3. Cache miss → query PostgreSQL → store in Redis with TTL → return

Cache is invalidated explicitly on writes:

- New review submitted → `DEL prof:${slug}` + `DEL stats:site`
- Admin hides a review → `DEL prof:${slug}`

### What to cache (and what NOT to cache)

**Cache:**

- `stats:site` (60s) — total reviews, professors, universities counts
- `prof:${slug}` (60s) — professor profile + all course aggregates
- `search:${queryHash}` (30s) — search results for common queries

**Do NOT cache:**

- Review submission responses (always fresh)
- Admin panel data (must be real-time)
- Individual review lists (use ISR/Next.js cache instead)
- Auth session lookups (handled by NextAuth adapter, not app code)

---

## Consequences

**Positive:**

- Professor profile pages served from Redis in <5ms (vs ~50ms PostgreSQL query)
- Session lookups are O(1) key-value reads
- TTL-based expiry is automatic — no cache invalidation job needed for time-based staleness
- Redis Pub/Sub available for future real-time features (notification when a new review is posted)

**Negative:**

- Additional service to operate (Docker container, monitoring)
- Cache invalidation bugs are silent — stale data until TTL expires
- Redis data loss on `docker compose down -v` in dev (acceptable) or misconfigured production volume (dangerous)

**Constraints:**

- Redis must be configured with `maxmemory-policy allkeys-lru` — evict LRU keys when memory limit is hit (prevents OOM)
- Production Redis must have `appendonly yes` persistence — survives container restarts without losing sessions
- Never cache data containing `user_id` or anything that could compromise anonymity
- Use `ioredis` (not the deprecated `redis` package) for the Node.js client
