# Poray Kemon — Claude Code Context

> **New session?** Read [`CURRENT_TASK.md`](CURRENT_TASK.md) first — it tells you what's done and what to build next.

---

## Project Overview

**Poray Kemon (পড়ায় কেমন)** is an anonymous professor & course rating platform for Bangladeshi universities. The name means "How does he/she teach?" — the exact question students already ask each other.

- **SRS:** `poray-kemon-srs.md` — single source of truth for requirements
- **Domain:** `poraykemon.com`
- **Stack:** Next.js 15 · TypeScript · PostgreSQL 16 · Prisma · Redis · Docker · NextAuth.js v5

---

## Core Design Invariants

These must never be violated:

1. **`reviews` table has NO `user_id` column** — review authorship is permanently anonymous
2. **`review_submissions` table is decoupled from `reviews`** — no JOIN can ever reveal who wrote what
3. **Reading is fully public** — no login, no cookie, no tracking for read-only visitors
4. **Google OAuth only** — no email/password, no other providers
5. **No full email stored** — only the Google `sub` identifier, plus the
   email **domain suffix** (e.g. `cs.du.ac.bd`) captured on sign-in to
   power the per-university eligibility gate in `lib/eligibility.ts`. The
   local part (`sifat` in `sifat@cs.du.ac.bd`) never touches the DB.
6. **Bangladesh-only scope** — only BD universities

---

## Tech Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| Framework       | Next.js 15 (App Router, RSC, Server Actions) |
| Language        | TypeScript 5                                 |
| Database        | PostgreSQL 16                                |
| ORM             | Prisma 5                                     |
| Cache           | Redis 7                                      |
| Auth            | NextAuth.js v5 (Auth.js)                     |
| Search          | PostgreSQL `pg_trgm` + `tsvector`            |
| Containers      | Docker + Docker Compose                      |
| Reverse Proxy   | Nginx (Alpine)                               |
| Styling         | Tailwind CSS 4 + shadcn/ui                   |
| Forms           | React Hook Form + Zod                        |
| Testing         | Vitest (unit) + Playwright (E2E)             |
| Package Manager | pnpm 9                                       |
| CI/CD           | GitHub Actions                               |
| Analytics       | Umami (self-hosted, Docker)                  |
| Monitoring      | OpenTelemetry + Prometheus + Grafana         |

---

## Key Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server
docker compose up -d        # Start PostgreSQL + Redis + Umami
docker compose down         # Stop all containers

# Database
pnpm db:migrate             # Run Prisma migrations
pnpm db:seed                # Seed universities + departments
pnpm db:studio              # Open Prisma Studio

# Testing
pnpm test                   # Run Vitest unit tests
pnpm test:e2e               # Run Playwright E2E tests
pnpm test:coverage          # Coverage report

# Code Quality
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm typecheck              # tsc --noEmit

# Production
pnpm build                  # Next.js production build
docker compose -f docker-compose.prod.yml up -d
```

---

## Project Structure

```
/
├── app/                        # Next.js App Router
│   ├── (public)/               # Public route group
│   │   ├── page.tsx            # Homepage
│   │   ├── universities/       # University pages
│   │   └── professors/         # Professor + review pages
│   ├── admin/                  # Admin panel (protected)
│   ├── api/                    # API routes
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── reviews/            # Review CRUD
│   │   ├── professors/         # Professor search/fetch
│   │   └── admin/              # Admin API (session-gated)
│   └── layout.tsx
├── components/                 # Shared React components
│   ├── ui/                     # shadcn/ui base components
│   ├── professor/              # Professor-specific components
│   ├── review/                 # Review form + cards
│   └── search/                 # Search components
├── lib/                        # Shared utilities
│   ├── db.ts                   # Prisma client singleton
│   ├── redis.ts                # Redis client singleton
│   ├── auth.ts                 # NextAuth config
│   ├── moderation.ts           # Keyword filter logic
│   └── validations/            # Zod schemas
├── prisma/
│   ├── schema.prisma           # Data model
│   ├── migrations/             # Migration history
│   └── seed.ts                 # Seed script
├── docs/                       # All documentation (you are here)
├── docker/                     # Docker config files
│   ├── nginx/
│   └── postgres/
├── docker-compose.yml          # Local dev
├── docker-compose.prod.yml     # Production
└── .github/workflows/          # CI/CD pipelines
```

---

## Data Model Summary

```
University → Department → Professor → ProfessorCourse → Review
                                            │
                                       review_submissions (who reviewed what — no review content)
                                       helpful_votes (who voted on what)
```

### Key aggregate pattern

`professor_courses` stores denormalized running averages. On every new review INSERT, update using:

```sql
new_avg = ((old_avg * old_count) + new_value) / (old_count + 1)
```

Never run full `AVG()` scans.

When a review transitions between counted (live/soft_flagged) and not-counted (flagged_hidden/deleted) states, the aggregate must be updated with the reverse formula so hidden or deleted reviews stop contributing. Helpers live in `lib/aggregation-mutations.ts` and must be called from every moderation code path (admin hide/delete/approve, report auto-hide, report resolve-remove).

---

## Anonymity Contract

```
User logs in (Google OAuth)
    ↓
Submits review
    ↓
Server: check review_submissions (has this user reviewed this professor+course?)
    ├── Yes → 409 "আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন"
    └── No  → BEGIN TRANSACTION
                INSERT reviews          ← NO user_id
                INSERT review_submissions (user_id, professor_course_id)
                UPDATE professor_courses (running avg)
              COMMIT
```

Even with full DB access, you cannot determine who wrote any specific review.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://poraykemon:secret@localhost:5432/poraykemon

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=<random-32-char>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# Admin
ADMIN_SESSION_SECRET=<random-64-char>

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no type assertions unless unavoidable
- **Zod for all external input** — API routes, form submissions, env vars
- **Server Components by default** — only add `'use client'` when necessary (event handlers, hooks)
- **Server Actions for mutations** — prefer over API routes for form submissions
- **Prisma transactions** for multi-table writes (review + review_submission + aggregate update)
- **No comments explaining what** — only comment the why (hidden constraint, workaround, invariant)
- **Bangla strings in constants** — never hardcode Bangla text inline; keep in `lib/strings.ts`
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `test:`

---

## Moderation Rules

Two-tier system (see SRS §4.9):

1. **Hard block** — profanity, slurs, serious accusations → 400 before INSERT
2. **Soft flag** — short text, ALL CAPS, emotional patterns → INSERT + queue for admin

Logic lives in `lib/moderation.ts`. Never inline keyword lists in route handlers.

---

## Important Files

| File                                       | Purpose                                |
| ------------------------------------------ | -------------------------------------- |
| `poray-kemon-srs.md`                       | Product requirements — source of truth |
| `docs/architecture/system-architecture.md` | How the system works end-to-end        |
| `docs/architecture/adrs/`                  | Why each tech decision was made        |
| `docs/api/openapi.yaml`                    | Machine-readable API contract          |
| `prisma/schema.prisma`                     | Authoritative data model               |
| `docker-compose.yml`                       | Local dev environment                  |
