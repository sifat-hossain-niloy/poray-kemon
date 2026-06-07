# Build Log — Poray Kemon

A chronological record of every feature built, the decisions made while building it, and how it works.

> Update this file at the end of every development session.

---

## Session 1 — June 2026

### What was built

#### Documentation & Architecture (pre-code)

- SRS v1.3 finalized — 11 sections covering all features, data model, API spec
- 8 ADRs written documenting every major tech decision
- System architecture document — end-to-end design with diagrams
- Data model reference — all 10 tables with column-level documentation
- OpenAPI 3.1 spec — every endpoint with request/response schemas
- Deployment runbook, contributing guide, test plan
- 4 Mermaid diagram files (ER, system, user flows, auth/anonymity)

#### Project Scaffold

- Next.js 16.2.7 with App Router, TypeScript 5 strict mode
- Prisma 6 schema — full 10-table schema written from the data model doc
- Docker Compose — PostgreSQL 16, Redis 7, test DB, Umami analytics
- All dependencies installed: NextAuth v5, ioredis, Zod, React Hook Form, Vitest, Playwright
- Husky pre-commit (lint-staged) + commit-msg (commitlint) hooks live
- GitHub Actions CI (4 jobs) + CD (placeholder) workflows

#### Foundation Layer

- `lib/db.ts` — Prisma client singleton (prevents connection pool exhaustion in dev)
- `lib/redis.ts` — ioredis client singleton with reconnect strategy
- `lib/strings.ts` — all user-facing Bangla strings in one place
- `lib/validations/review.ts` — Zod schema for review submission
- `lib/auth.ts` — NextAuth v5 config (Google OAuth, no email stored)
- `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `prisma/seed.ts` — 20 universities + departments seeded from SRS Appendix A

#### UI Foundation

- Bangla font (Hind Siliguri) loaded via next/font/google
- `app/layout.tsx` updated with font, metadata, html lang="bn"
- shadcn/ui initialized with Neutral color palette
- `components/ui/` — base shadcn components installed

---

### Key decisions made this session

| Decision                              | Reason                                                            |
| ------------------------------------- | ----------------------------------------------------------------- |
| Next.js 16 instead of 15              | create-next-app shipped 16 — same paradigm, newer features        |
| Prisma 6 instead of 5                 | Newer, fully compatible, already available                        |
| `commitlint.config.cjs` in CJS format | ESM format caused loading failures with commitlint                |
| Docs committed to git                 | Required for agentic development — new sessions need to read them |

---

## Session 2 — (next session)

> Fill in when the session is complete.

### What was built

- [ ] First Prisma migration (`pnpm db:migrate`)
- [ ] Seed data applied (`pnpm db:seed`)
- [ ] Homepage — search bar + site stats
- [ ] Professor search API (`GET /api/professors/search`)
- [ ] University listing page

---

## Feature Reference

As features are completed, add them here for quick lookup.

### Completed Features

| Feature               | Files                                                | Notes                                                   |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Prisma schema         | `prisma/schema.prisma`                               | All 10 tables, anonymity contract enforced by structure |
| NextAuth Google OAuth | `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` | No email stored — only Google `sub`                     |
| Foundation libs       | `lib/db.ts`, `lib/redis.ts`, `lib/strings.ts`        | Singletons safe for Next.js dev/prod                    |
| Seed data             | `prisma/seed.ts`                                     | 20 BD universities + departments                        |
| CI pipeline           | `.github/workflows/ci.yml`                           | 4 jobs: quality → unit → integration → build            |

### Planned Features (from SRS)

| Feature                          | Priority | Status         |
| -------------------------------- | -------- | -------------- |
| Homepage with search             | P0       | 🔲 Not started |
| Professor profile page           | P0       | 🔲 Not started |
| Review submission form           | P0       | 🔲 Not started |
| University directory             | P0       | 🔲 Not started |
| Department pages                 | P0       | 🔲 Not started |
| Search API                       | P0       | 🔲 Not started |
| Review submission API            | P0       | 🔲 Not started |
| Helpful voting                   | P0       | 🔲 Not started |
| Report a review                  | P0       | 🔲 Not started |
| Admin panel                      | P0       | 🔲 Not started |
| Soft moderation (keyword filter) | P0       | 🔲 Not started |
| Site-wide stats                  | P0       | 🔲 Not started |
| About / privacy policy page      | P0       | 🔲 Not started |
