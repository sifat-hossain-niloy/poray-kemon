import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

// Used by uptime monitors (UptimeRobot etc.) and Docker health checks.
// Redis is optional: unset REDIS_URL → status 'skipped', not 'error'.
export async function GET() {
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {}

  try {
    await db.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  if (redis === null) {
    checks.redis = 'skipped'
  } else {
    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'error'
    }
  }

  // Skipped counts as healthy — a deployment without Redis is a valid config.
  const healthy = Object.values(checks).every((v) => v === 'ok' || v === 'skipped')

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  )
}
