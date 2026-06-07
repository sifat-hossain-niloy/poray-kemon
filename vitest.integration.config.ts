import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globals: true,
    // globalSetup runs ONCE before any worker spawns — load .env.local,
    // pin DATABASE_URL to the test DB, and apply pending migrations.
    globalSetup: ['./test/global-setup.integration.ts'],
    // Per-test-file setup — mocks Redis, exposes the helpers.
    setupFiles: ['./test/setup.integration.ts'],
    include: ['**/__tests__/integration/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // serialise — all tests share one Postgres DB
      },
    },
    testTimeout: 30000,
    hookTimeout: 60000, // migrations can take a moment on cold start
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
