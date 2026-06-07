# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. After finishing a session, update it before closing.

---

## Project Status

**Phase:** Read paths working — homepage, universities listing, university detail, professor stub, search
**Last updated:** June 2026 (Session 2)

---

## What Has Been Done

### Session 1 — scaffold + docs

- [x] SRS v1.3, 8 ADRs, system architecture, data model, OpenAPI spec, runbook, contributing, test plan, 4 Mermaid diagrams
- [x] Next.js 16 + TS strict + Prisma 6 + Docker Compose + NextAuth v5 + Vitest + Playwright + Husky/Commitlint
- [x] Foundation libs: `lib/db.ts`, `lib/redis.ts`, `lib/strings.ts`, `lib/auth.ts`, `lib/validations/review.ts`
- [x] GitHub Actions CI/CD workflows
- [x] Prisma schema (all 10 tables) + seed for 15 BD universities

### Session 2 — database live + read paths

- [x] Initial migration applied (`20260607123727_init_schema`)
- [x] Seed run: 15 universities, 60 departments, 1 admin user
- [x] Fixed: dotenv-cli in db scripts (Prisma CLI reads `.env.local`)
- [x] Fixed: Postgres on port 5434 (host had conflicting 5432)
- [x] shadcn/ui initialized with base-nova preset; 7 base components added
- [x] Hind Siliguri set as `--font-sans` → all shadcn renders in Bengali
- [x] `components/layout/Navbar.tsx` — sticky header, search input, auth dropdown
- [x] `/universities` — listing page, grouped by type, ISR 5 min
- [x] `/universities/[slug]` — university detail with department cards
- [x] `/professors/[slug]` — professor stub with per-course score cards
- [x] `/search` — fully working: pg_trgm UNION ALL across universities, departments, professors
- [x] `/api/health` — DB + Redis probes
- [x] Smoke-tested live: all routes return 200, search returns ranked results

---

## What We Are Building Next

The read path is now navigable. The next milestone is the **write path** — submitting reviews. This is where the anonymity contract gets exercised for the first time.

### Step 1 — Review submission API (highest priority)

`app/api/reviews/route.ts` (POST):

1. Verify session via `auth()` from `lib/auth.ts` — reject 401 if missing
2. Validate body with `reviewSubmitSchema` from `lib/validations/review.ts`
3. Check honeypot field — reject 400 if populated
4. Run `lib/moderation.ts` (not yet written) — hard block vs soft flag
5. Find-or-create `Course` record (lookup by `departmentId + courseCode`)
6. Find-or-create `ProfessorCourse` record
7. **Inside `prisma.$transaction`:**
   - SELECT from `review_submissions` for `(userId, professorCourseId)` → 409 if exists
   - INSERT `reviews` (NO `userId` column)
   - INSERT `review_submissions` (userId, professorCourseId)
   - `$executeRaw` UPDATE running averages on `professor_courses`
8. Invalidate Redis cache: `prof:{slug}` + `stats:site`
9. Return 201

### Step 2 — Moderation module (`lib/moderation.ts`)

Two-tier system per SRS §4.9:

- Hard-block list: Bangla/English profanity, slurs, accusations → 400
- Soft-flag patterns: ALL CAPS, <20 chars, 3+ exclamation marks, grudge phrases → INSERT with `moderation_status = 'soft_flagged'`

### Step 3 — Review form UI (`app/review/new/page.tsx`)

- Multi-step form using React Hook Form + Zod
- Steps: pick university → pick department → search/pick professor → enter course → ratings + tags + text
- Auth gate: if not logged in, show "Sign in with Google" CTA
- Pre-fill if `?professor=<slug>` query param is set

### Step 4 — Helpful voting

`app/api/reviews/[id]/helpful/route.ts` — toggle vote, requires auth

### Step 5 — Report a review

`app/api/reports/route.ts` — public (no auth required); triggers auto-hide at 3 reports

### Step 6 — Admin panel

`app/admin/*` — password login, moderation queue, manual review/edit/hide/delete

---

## Decisions Made

### Session 1

- Next.js 16.2.7 (vs planned 15.x), Prisma 6, Tailwind 4
- `commitlint.config.cjs` in CJS format (ESM caused loading failures)
- Docs committed to git (not gitignored) — required for agentic dev
- Docker Compose for services; Next.js runs on host for HMR
- bcryptjs ships own types

### Session 2

- shadcn uses **base-nova** preset (Base UI primitives) — components take a
  `render` prop instead of Radix's `asChild`
- Hind Siliguri as `--font-sans` so shadcn components inherit Bengali script
- Search uses raw SQL (`$queryRaw`) for `UNION ALL + similarity() + ILIKE` —
  Prisma's query builder can't express this in one round-trip
- Postgres dev on 5434, test DB on 5435 (host had local 5432)
- `dotenv-cli` in every `db:*` script

---

## Open Questions / Blockers

- **Google OAuth credentials** — still needed before sign-in works.
  https://console.cloud.google.com/ → APIs & Services → Credentials
  Redirect URI: `http://localhost:3000/api/auth/callback/google`
- `lib/moderation.ts` not yet written — needed before review submission API
- Profanity word lists not yet sourced (Bangla + English)

---

## Key Files to Read for Context

If this is a new session, read in order:

1. `CURRENT_TASK.md` — this file
2. `CLAUDE.md` — overview, conventions
3. `poray-kemon-srs.md` — product requirements
4. `prisma/schema.prisma` — DB schema
5. `lib/auth.ts` + `lib/db.ts` + `lib/redis.ts` — how state is accessed
6. `lib/search.ts` — search implementation
7. `docs/development/build-log.md` — what's been built and how
