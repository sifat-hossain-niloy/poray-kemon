# ADR-007: Testing Strategy — Vitest + Playwright

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

We need a testing strategy that:

- Catches regressions in the review submission flow (the most critical path)
- Validates the anonymity contract at the database level
- Tests the moderation keyword filter
- Verifies the end-to-end user flow for submitting and reading reviews
- Runs in CI without a full browser environment (for unit/integration tests)

---

## Decision

Use **Vitest** for unit and integration tests, **Playwright** for end-to-end tests.

---

## Rationale

### Why Vitest over Jest

| Factor              | Vitest                     | Jest                     |
| ------------------- | -------------------------- | ------------------------ |
| Speed               | 2-5× faster (Vite-based)   | Slower (Babel transform) |
| ESM support         | Native                     | Requires configuration   |
| TypeScript          | Native (no ts-jest needed) | Requires ts-jest         |
| Next.js integration | Good                       | Requires more config     |
| API compatibility   | Jest-compatible            | Standard                 |

Vitest is a drop-in Jest replacement with better performance and native TypeScript support.

### Why Playwright over Cypress

| Factor        | Playwright                  | Cypress                          |
| ------------- | --------------------------- | -------------------------------- |
| Multi-browser | Chromium + Firefox + WebKit | Chromium only (paid for Firefox) |
| Parallelism   | Native (worker-based)       | Limited (paid)                   |
| Docker/CI     | Official Docker image       | More complex CI setup            |
| Auto-wait     | Built-in                    | Built-in                         |
| Speed         | Faster                      | Slower for full runs             |

---

## Test Pyramid

```
          ┌──────────┐
          │   E2E    │  ~20 tests (Playwright)
          │  Tests   │  Full user flows, browser
          ├──────────┤
          │Integration│  ~40 tests (Vitest + real DB)
          │  Tests   │  API routes, DB transactions
          ├──────────┤
          │  Unit    │  ~100 tests (Vitest, mocked)
          │  Tests   │  Moderation, validation, utilities
          └──────────┘
```

### What to test at each level

**Unit tests (Vitest, no DB):**

- `lib/moderation.ts` — keyword detection (hard block + soft flag)
- `lib/validations/` — Zod schema validation edge cases
- Running average formula in isolation
- Slug generation for professor URLs
- Tag normalization

**Integration tests (Vitest + test database):**

- `POST /api/reviews` — full submission flow including DB state
- Duplicate submission prevention (review_submissions constraint)
- Transaction atomicity — if aggregate update fails, review is rolled back
- `POST /api/reviews/:id/helpful` — vote toggle
- Admin API routes — report resolution, review deletion

**E2E tests (Playwright):**

- Homepage loads with search
- Search for a professor and navigate to profile
- Submit a review (mock Google OAuth)
- Attempt duplicate review — see error message
- Report a review
- Admin login and review moderation

---

## Test Database Strategy

Integration tests use a **separate test database** (not mocks):

```
docker-compose.test.yml
└── postgres-test   PostgreSQL on :5433 (separate port)
```

Before each test suite: run migrations + seed minimal data.  
After each test: `TRUNCATE` all tables (within a transaction, then rollback) to restore state.

We do NOT mock Prisma — the integration tests hit a real PostgreSQL instance. This prevents the class of bugs where mocked queries pass but real queries fail (e.g., constraint violations, transaction behavior).

---

## Consequences

**Positive:**

- Vitest tests run in parallel — full unit suite in <10 seconds
- Playwright tests provide confidence that Bangla text renders correctly
- Real DB in integration tests catches constraint bugs that mocks would miss

**Negative:**

- Integration tests require a running PostgreSQL instance (handled by Docker Compose in CI)
- E2E tests are slow (~2-5 minutes) — run on PR, not on every commit
- Google OAuth in E2E must be mocked (can't use real OAuth in CI) — use NextAuth's test adapter

**Constraints:**

- Coverage target: 80% on `lib/` utilities, 70% on API routes
- All tests must pass before merge to `main`
- E2E tests run against a production build (`pnpm build && pnpm start`), not `pnpm dev`
