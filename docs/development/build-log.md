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

## Session 2 — June 2026

### What was built

#### Database & seeding

- First migration applied: `20260607123727_init_schema` (all 10 tables created)
- Seed run: 15 BD universities, 60 departments, 1 admin user

#### Foundation fixes

- `dotenv-cli` wired into every `db:*` script so Prisma CLI reads `.env.local`
  (Next.js reads `.env.local` natively; Prisma CLI defaults to `.env` only).
- Docker Postgres moved off port 5432 → **5434** (and test DB to **5435**) to
  coexist with a host-installed Postgres that already binds `localhost:5432`.

#### UI foundation

- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge), auto-added by shadcn
- shadcn/ui initialized with **base-nova** preset (Base UI primitives — note:
  these use a `render` prop, not Radix's `asChild`)
- Components installed: `button`, `input`, `card`, `badge`, `separator`,
  `avatar`, `dropdown-menu`
- Root layout switched to use Hind Siliguri AS `--font-sans` directly — every
  shadcn component now renders in Bengali script without per-component overrides
- `components/layout/Navbar.tsx` (client) — sticky header with logo, inline
  search input that GETs to `/search`, Google sign-in button or avatar+dropdown

#### Pages

- `/` (homepage) — RSC with Redis-cached site stats, displays ১৫ universities
- `/universities` (ISR 5 min) — all universities grouped by `public` /
  `private` / `international`, with department + professor counts per card
- `/universities/[slug]` (ISR 5 min) — university detail page listing
  departments with professor counts
- `/professors/[slug]` (ISR 1 min) — professor profile with per-course rating
  cards (empty state when no reviews yet)
- `/search?q=…` — fully-functional search powered by `pg_trgm`. UNION ALL
  across universities, departments, and professors with `similarity()` ranking
  and ILIKE substring matching. Bangla queries work (tested: `ঢাকা` → DU).

#### Other

- `/api/health` — DB + Redis health probe endpoint for Docker/uptime monitors
- Auth callback narrowed: `profile?.sub` guard prevents writing `undefined`
  to JWT; session defaults `email = ''`, `image = null` instead of casting

### Anatomy of the search query (`lib/search.ts`)

We don't use Elasticsearch — Postgres `pg_trgm` is enough for the MVP scale.
The query:

1. Enabled in `docker/postgres/init.sql`: `CREATE EXTENSION pg_trgm` runs on
   first container start
2. `lib/search.ts` exports `search(query, limit)` which runs ONE raw SQL
   `UNION ALL` across the three searchable tables
3. Each branch computes a `similarity(col, query)` score AND an `ILIKE` filter:
   ILIKE catches substring matches, similarity catches typos (e.g. `Rhmn`
   matches `Rahman` because their trigram overlap is high)
4. `ORDER BY score DESC` ranks across all kinds, capped at `LIMIT 20`
5. Anonymity check: this query never touches `reviews` or `review_submissions`,
   so privacy guarantees are preserved

### Key decisions

| Decision                              | Reason                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| shadcn `base-nova` preset (Base UI)   | What `shadcn init -d` defaulted to. Uses `render` prop pattern instead of `asChild`. |
| Hind Siliguri as `--font-sans`        | One font covers Bengali AND Latin → shadcn components render in Bangla automatically |
| Postgres on 5434 (not 5432)           | Host machine had a conflicting Postgres on 5432                                      |
| `dotenv-cli` in db scripts            | Prisma CLI doesn't read `.env.local` like Next.js does                               |
| Raw SQL for search (not Prisma query) | Prisma can't express `UNION ALL` + `similarity()` + `ILIKE` in one query             |

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

| Homepage with search | `app/page.tsx` | RSC with Redis-cached stats (60 s TTL) |
| Universities listing | `app/universities/page.tsx` | ISR 5 min, grouped by type |
| University detail page | `app/universities/[slug]/page.tsx`| ISR 5 min, lists departments |
| Professor profile (stub) | `app/professors/[slug]/page.tsx` | ISR 1 min, per-course score cards |
| Cross-entity search | `lib/search.ts`, `app/search/page.tsx` | pg_trgm fuzzy + ILIKE, UNION ALL |
| Navbar | `components/layout/Navbar.tsx` | Sticky header, inline search, auth dropdown |
| Health endpoint | `app/api/health/route.ts` | DB + Redis probes; returns 503 if either down |

### Planned Features (from SRS)

| Feature                          | Priority | Status                                   |
| -------------------------------- | -------- | ---------------------------------------- |
| Professor profile page (full)    | P0       | 🟡 Stub only — needs reviews list & sort |
| Review submission form           | P0       | 🔲 Not started                           |
| University directory             | P0       | 🔲 Not started                           |
| Department pages                 | P0       | 🔲 Not started                           |
| Search API                       | P0       | 🔲 Not started                           |
| Review submission API            | P0       | 🔲 Not started                           |
| Helpful voting                   | P0       | 🔲 Not started                           |
| Report a review                  | P0       | 🔲 Not started                           |
| Admin panel                      | P0       | 🔲 Not started                           |
| Soft moderation (keyword filter) | P0       | 🔲 Not started                           |
| Site-wide stats                  | P0       | 🔲 Not started                           |
| About / privacy policy page      | P0       | 🔲 Not started                           |
