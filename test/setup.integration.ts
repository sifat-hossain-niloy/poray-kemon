import { execSync } from 'child_process'
import { beforeAll } from 'vitest'

beforeAll(async () => {
  // Ensure test DB migrations are up to date
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
  })
})
