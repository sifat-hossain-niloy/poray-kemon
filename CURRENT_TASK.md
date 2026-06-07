# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. It tells you exactly where we are and what to build next. After finishing a session, update this file before closing.

---

## Project Status

**Phase:** Foundation complete — lib layer, auth, CI/CD, seed, homepage all committed
**Last updated:** June 2026

---

## What Has Been Done

- [x] SRS written and finalized (v1.3) — see `poray-kemon-srs.md`
- [x] Tech stack decided — Next.js 16, PostgreSQL 16, Prisma 6, Redis 7, Docker, NextAuth v5, Tailwind 4 + shadcn/ui
- [x] `CLAUDE.md` + `CURRENT_TASK.md` created
- [x] 8 ADRs, system architecture, data model, OpenAPI spec, runbook, contributing guide, test plan, 4 diagrams
- [x] Next.js 16 scaffolded (App Router, TypeScript strict mode)
- [x] All dependencies installed: Prisma, NextAuth v5, ioredis, React Hook Form, Zod, Vitest, Playwright, Husky, Commitlint, Prettier, bcryptjs
- [x] `prisma/schema.prisma` — full 10-table schema with anonymity contract
- [x] `docker-compose.yml` — PostgreSQL 16 + test DB + Redis 7 + Umami
- [x] `docker/postgres/init.sql` — pg_trgm + uuid-ossp extensions enabled on first start
- [x] Husky hooks: pre-commit (lint-staged) + commit-msg (commitlint)
- [x] Vitest config (unit + integration) + Playwright config
- [x] `.github/workflows/ci.yml` — 4-job CI pipeline (typecheck, lint, unit, integration, build)
- [x] `.github/workflows/cd.yml` — CD placeholder (Vercel + VPS options)
- [x] `lib/db.ts` — Prisma client singleton
- [x] `lib/redis.ts` — Redis singleton with `getCache` / `setCache` / `deleteCache` helpers
- [x] `lib/strings.ts` — all Bangla user-facing strings (never hardcode inline)
- [x] `lib/auth.ts` — NextAuth v5 Google OAuth (no email stored, Google sub only, internal UUID in session)
- [x] `lib/validations/review.ts` — Zod schemas for review submission (with honeypot) and report
- [x] `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- [x] `app/api/health/route.ts` — health check endpoint (DB + Redis probes)
- [x] `prisma/seed.ts` — 15 BD universities + departments + admin user
- [x] `app/layout.tsx` — Hind Siliguri font (Bengali), `lang="bn"`, SessionProvider, full OG metadata
- [x] `app/page.tsx` — RSC homepage: search bar, live site stats (Redis-cached), CTAs
- [x] Initial git commits: scaffold + foundation layer

---

## What We Are Building Now

**Next task: Database up + first migration + shadcn/ui setup**

### Step 1 — Start Docker and run migration (you do this)

```bash
docker compose up -d          # Start PostgreSQL + Redis
pnpm db:migrate               # Run first Prisma migration (name it: init_schema)
pnpm db:seed                  # Seed 15 universities + admin user
pnpm dev                      # Start dev server → http://localhost:3000
```

### Step 2 — Install shadcn/ui (tell Claude Code to run)

```bash
pnpm dlx shadcn@latest init   # Choose: New York style, Zinc base color, CSS variables yes
```

Then add base components:

```bash
pnpm dlx shadcn@latest add button input badge card separator
```

### Step 3 — Build these features next (in order):

1. **Navbar** (`components/layout/Navbar.tsx`) — logo, search, sign-in button, mobile menu
2. **University listing page** (`app/universities/page.tsx`) — filterable list (public/private/international)
3. **Professor profile page** (`app/professors/[slug]/page.tsx`) — ratings summary, per-course reviews
4. **Search** (`app/search/page.tsx`) — `pg_trgm` full-text search over professors + universities
5. **Review submission flow** (`app/review/new/page.tsx`) — multi-step form with auth gate
6. **API: POST /api/reviews** — anonymous INSERT + `review_submissions` guard + running avg update
7. **Helpful vote** (`app/api/reviews/[id]/helpful/route.ts`)
8. **Admin panel** (`app/admin/`) — login, review queue, moderation actions

---

## Decisions Made

- Next.js 16.2.7 (newer than planned 15.x — same App Router paradigm)
- Tailwind CSS 4 already bundled by create-next-app (no separate upgrade needed)
- Prisma 6 (not 5 as originally planned — fully compatible)
- `commitlint.config.cjs` in CJS format — ESM caused loading failures
- Docs committed to git (not gitignored) — required for agentic development
- Docker Compose for local services; Next.js runs on host for HMR
- bcryptjs 3.0.3 ships its own types (no `@types/bcryptjs` needed in practice)
- Homepage uses RSC with Redis cache-aside (1 min TTL) for site stats — no client bundle

---

## Open Questions / Blockers

- **Google OAuth credentials** — needed before auth sign-in works. Create at:
  https://console.cloud.google.com/ → APIs & Services → Credentials
  Redirect URI: `http://localhost:3000/api/auth/callback/google`
  Then put CLIENT_ID and CLIENT_SECRET in `.env.local`
- No domain/VPS yet — local development only for now

---

## Key Files to Read for Context

If this is a new session, read these in order:

1. `CURRENT_TASK.md` — this file
2. `CLAUDE.md` — project overview, stack, commands, conventions
3. `poray-kemon-srs.md` — full product requirements
4. `prisma/schema.prisma` — current database schema
5. `docs/architecture/system-architecture.md` — how the system works
6. `docs/development/build-log.md` — log of every feature built
