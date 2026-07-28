// ─────────────────────────────────────────────────────────────────────────────
// Vitest globalSetup — runs ONCE before any test file is loaded.
//
// Responsibilities:
// 1. Load .env.local (locally; in CI the values are already in process.env)
// 2. Pin DATABASE_URL to DATABASE_URL_TEST so `lib/db.ts`'s singleton uses
//    the test database when first imported
// 3. Apply pending Prisma migrations on the test DB
// 4. Ensure `pg_trgm` exists (the test DB doesn't run docker/postgres/init.sql)
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Tiny .env parser — only handles KEY=VALUE and double/single quoted values.
 * Avoids pulling in the `dotenv` package (it's only a transitive dep of
 * `dotenv-cli` and Vite's resolver can't see it).
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Don't clobber values already set by CI
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export default async function setup() {
  // 1. Load .env.local if present (no-op if missing — CI sets vars directly)
  loadEnvFile(resolve(process.cwd(), '.env.local'))

  // 2. Point Prisma at the test DB. Must happen before lib/db imports.
  const testUrl = process.env.DATABASE_URL_TEST
  if (!testUrl) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Add it to .env.local (locally) or to the CI env.',
    )
  }
  process.env.DATABASE_URL = testUrl
  // Prisma requires DIRECT_URL when the schema declares it (see
  // prisma/schema.prisma). Locally there's no pooler, so DIRECT_URL and
  // DATABASE_URL are the same connection string.
  process.env.DIRECT_URL = testUrl

  // 3. Apply migrations (idempotent — `prisma migrate deploy` only runs pending ones)
  try {
    execSync('pnpm prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
      stdio: 'inherit',
    })
  } catch (err) {
    throw new Error(`prisma migrate deploy failed: ${(err as Error).message}`)
  }

  // 4. pg_trgm — only needed if the search() path is exercised. Cheap to enable.
  //    Use psql via execSync so we don't need to bring up Prisma's runtime here.
  try {
    execSync(
      `psql "${testUrl}" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";"`,
      { stdio: 'pipe' },
    )
  } catch {
    // psql may not be on PATH in some sandboxes — that's fine. Tests that
    // require pg_trgm will fail explicitly, which is better than silent skips.
  }
}
