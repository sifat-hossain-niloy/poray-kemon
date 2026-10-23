import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/__tests__/unit/**/*.test.ts', '**/__tests__/unit/**/*.test.tsx'],
    // Claude Code session worktrees live inside the repo; their copies of the
    // suite must not run (or fail) as part of this checkout's.
    exclude: ['**/node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'app/api/**'],
      exclude: ['lib/db.ts', 'lib/redis.ts'],
      thresholds: {
        global: {
          lines: 75,
          functions: 75,
          branches: 70,
          statements: 75,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
