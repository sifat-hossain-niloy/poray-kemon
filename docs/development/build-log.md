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

## Session 3 — June 2026 (`feat/review-submission`)

### What was built — the write path goes live

The anonymity contract is now exercised end-to-end. A review submission round-trips through:

1. Google session check (`auth()` from `lib/auth.ts`) — 401 if missing
2. Zod validation (`reviewSubmitSchema` in `lib/validations/review.ts`)
3. Honeypot guard
4. Keyword moderation (`lib/moderation.ts`) — hard-block returns 400, soft-flag still writes but with `moderation_status = 'soft_flagged'`
5. Find-or-create `Professor`, `Course`, `ProfessorCourse`
6. **Inside `prisma.$transaction`:**
   - Duplicate guard via `review_submissions` unique key
   - `INSERT reviews` with **NO `user_id`**
   - `INSERT review_submissions` with `(user_id, professor_course_id)`
   - `$executeRaw` UPDATE running averages on `professor_courses`
7. `deleteCache` on `stats:site` + `prof:{slug}`
8. 201 with `{ message, professor_slug, moderation_status }`

### Why the running-average is raw SQL

Prisma's typed query builder can't express the self-referencing
`((avg * count) + new) / (count + 1)` arithmetic atomically. So inside the
transaction we call `tx.$executeRaw\`UPDATE professor_courses SET ...\``.
`lib/aggregation.ts` exports the same maths in TS so the formula is
unit-tested in isolation (`**tests**/unit/aggregation.test.ts`).

### Why moderation lives in code (not in the DB)

Word lists are short, conservative, and bilingual. Keeping them in
`lib/moderation.ts` lets the keyword filter run **before** any DB write,
and lets us unit-test each branch (15 cases in
`__tests__/unit/moderation.test.ts`). A future migration can move them to
a `blocklist` table for admin editing.

### Test coverage added

- `moderation.test.ts` (15 cases): every hard-block category, every soft-flag pattern, plus precedence (hard beats soft)
- `slug.test.ts` (12 cases): ASCII normalisation, Bangla stripping, collision suffix logic
- `aggregation.test.ts` (9 cases): running average matches naive average over 10 inserts; recommendation %; weighted score

### UI

- `app/review/new/page.tsx` — RSC shell. Loads universities + departments + (optional) preselected professor in one round-trip. If the user is not authenticated, renders a `Sign in with Google` server-action button instead of the form.
- `components/review/ReviewForm.tsx` — client form with university → department cascade, find-or-create professor input (or preselected when arriving from a professor page via `?professor=<slug>`), 4 ratings, would-recommend, multi-select tag chips, optional 0–500 char text, honeypot field.

### Verified

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm test` ✓ (36 tests pass)
- Live smoke test: `POST /api/reviews` without session returns 401 with Bangla error
- `/review/new` returns 200 (auth gate page renders)

---

## Session 4 — June 2026 (`feat/helpful-voting`)

### What was built — community signal on top of reviews

A logged-in viewer can mark any review as helpful, see the count update,
and click again to remove the vote. The button is rendered inside every
`ReviewCard`; the professor profile now previews up to three reviews per
course so the button has somewhere to live.

### API design (`app/api/reviews/[id]/helpful/route.ts`)

`POST /api/reviews/:id/helpful`

1. Auth check → 401 if missing
2. Validate review id (positive integer) and existence → 404 if not
3. Inside `prisma.$transaction`:
   - Read `helpful_votes` for `(userId, reviewId)`
   - If found: DELETE the row, `decrement: 1` on `reviews.helpful_count`
   - If missing: CREATE the row, `increment: 1` on `reviews.helpful_count`
4. Return `{ voted, helpful_count }` so the client renders without a refetch

Race-condition guard: two concurrent POSTs from the same user can both
hit the "no vote" branch and race to INSERT. The unique constraint
`(user_id, review_id)` catches the loser; we map `P2002` to a 200 with
the current counter rather than 500.

`GET /api/reviews/:id/helpful` returns the same `{ voted, helpful_count }`
shape — useful if the client wants to revalidate without optimistic state.

### Client (`HelpfulButton.tsx`)

- Optimistic toggle on click — count + vote state update before the
  network round-trip; rolls back on failure
- Unauthenticated click renders an inline `সাইন ইন` prompt that runs
  `signIn('google')` directly (no full-page navigation)
- `aria-pressed` reflects vote state for screen readers
- All button labels via `STRINGS.reviewDisplay.*` — no inline Bangla

### Professor profile change

Switched from ISR (60 s) to `dynamic = 'force-dynamic'` because per-viewer
vote state can't live in a shared cache. For each course, fetches top 3
visible reviews ordered by `helpfulCount DESC, submittedAt DESC`, then
runs ONE `helpful_votes.findMany({ where: { userId, reviewId: {in: [...]} } })`
to collect the viewer's votes across the whole page. No N+1.

### Verified

- `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (36 tests still pass)
- Live smoke test:
  - `POST /api/reviews/1/helpful` (no session) → 401 with Bangla error
  - `POST /api/reviews/abc/helpful` → 400 "Invalid review id"
  - `GET /api/reviews/1/helpful` (no review) → 404

---

## Session 5 — June 2026 (`feat/report-review`)

### What was built — the report flow + 3-strike auto-hide

A logged-in viewer can flag any review as fake / offensive / personal /
wrong-professor / other. At 3 distinct pending reports on the same review,
`moderation_status` flips to `flagged_hidden` and the review is replaced
by the SRS §4.9 transparency notice. Admin can reinstate.

### API design (`app/api/reports/route.ts`)

`POST /api/reports`

1. **Auth required** — deliberate MVP deviation from the SRS. Open reports
   are an abuse vector: anyone could script 3 POSTs and hide a legitimate
   review. Requiring an authenticated session is the cheapest defence.
2. Zod validate `{ review_id, reason, details? }`
3. Confirm review exists and isn't already deleted → 404 otherwise
4. **Redis dedup**: `SET reported:{userId}:{reviewId} 1 EX 2592000 NX`.
   Atomically refuses to overwrite an existing key. If the key was already
   set, return 201 idempotently (don't leak the dedup mechanism). If Redis
   is unreachable, we proceed without dedup and log a warning — admin will
   catch any abuse from the queue.
5. `prisma.$transaction`:
   - INSERT into `reports` (no `user_id` column — the report itself stays
     anonymous; the Redis key is the only place the link briefly exists)
   - COUNT pending reports on this review
   - If count ≥ `AUTO_HIDE_THRESHOLD` (3) and the review isn't already
     hidden, UPDATE `reviews.moderation_status = 'flagged_hidden'`
   - Return whether we hid this round
6. On auto-hide, invalidate Redis caches for `stats:site` and
   `prof:{slug}`. If the DB write fails, roll back the Redis dedup key so
   the user can retry without being silently swallowed.

### Why the report itself stays user-anonymous

We don't write `user_id` to the `reports` row. The `(userId, reviewId)`
link lives ONLY in Redis with a 30-day TTL. After that window the user
can report the same review again (in case it's been edited or
reinstated). Admin sees the report content + reason + details but not
who filed it, which mirrors the review-anonymity principle and keeps the
data-protection footprint small.

### Client (`ReportButton.tsx`)

- Renders a small flag icon + "রিপোর্ট করুন" link
- Click while signed-out → triggers `signIn('google')` immediately
- Click while signed-in → opens a native `<dialog>` modal with:
  - 5 radio reasons from `REPORT_REASONS` (matches Prisma enum)
  - Optional details textarea (max 500 chars)
  - Cancel / Submit
  - Success state shows confirmation message and a close button
- Click on backdrop dismisses the dialog
- Uses `<dialog>` to avoid pulling in another shadcn primitive

### Verified

- `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (**44 tests pass**: +8 new)
- Live smoke tests:
  - `POST /api/reports` (no session) → 401 with Bangla error
  - All endpoints still 200 (homepage, university page, health)

### Decisions

| Decision                  | Reason                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Auth required for reports | Abuse-prevention; cheap; matches voting pattern                                       |
| Redis dedup (not DB)      | No migration needed; TTL gives reasonable retry window; reports table stays anonymous |
| Native `<dialog>` element | Avoid adding a new shadcn dialog primitive for a single modal                         |
| AUTO_HIDE_THRESHOLD = 3   | Matches SRS §4.9 FR-MOD-A-04                                                          |
| Idempotent dedup response | Returns 201 on duplicate so script-kiddies don't learn the threshold                  |

---

## Session 6 — June 2026 (`feat/professor-profile-full`)

### What was built — the full two-level professor view (SRS §4.6 FR-STAT-02)

The professor profile previously showed only per-course cards with a 3-review
preview. It now satisfies the SRS in full:

**Level 1 — Combined professor score (top of profile)**

- Weighted average across all courses by `review_count`
- All four rating dimensions + recommend percentage
- Total review count + course count

**Level 2 — Per-course cards (always visible)**

- Same as before, but now with a "সব {count} রিভিউ দেখুন →" link when
  the course has more reviews than the 3-review preview

**New: `/professors/[slug]/[course-slug]`**

- Full reviews list for one professor × one course
- Sort tabs: helpful (default, per SRS FR-VOTE-04) / recent
- Pagination: 10 per page via `?page=N` (capped at 1000 to defang crawlers)
- Per-course aggregate header (recommend %, all 4 rating dimensions)
- Empty state with localised copy
- Breadcrumb: universities › {uni} › {professor name} › current page

### Why `lib/professor-stats.ts` is a separate module

The combined-score math is testable in isolation (5 unit tests cover the
empty case, zero-count courses, weighted averaging, recommend-percentage,
and null-safety). The page just passes Prisma rows in and renders. Same
pattern as `lib/aggregation.ts` for per-review running averages.

### Sort URL contract

- Default (helpful): `/professors/x/y` — no `sort` param in URL
- Recent: `/professors/x/y?sort=recent`
- Page 2: `/professors/x/y?page=2` (helpful default) or `?sort=recent&page=2`

Keeping the default sort out of the URL means crawlers see only one
canonical URL for "show the most useful reviews", which is what we want
indexed. Skipping `page=1` follows the same convention.

### Verified

- `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (**49 tests**, +5 new)
- Live smoke: missing professor → 404; missing course on existing professor → 404

---

## Session 7 — June 2026 (`feat/admin-panel`)

### What was built — operator tooling for moderation

The admin panel is intentionally separate from the user-facing Google OAuth
flow (SRS §4.5 FR-MOD-05: "no social login" for admin). Admins authenticate
against `admin_users` with username + bcrypt password and receive an
HMAC-SHA256 signed cookie (`pk_admin_session`, 8-hour TTL).

### Why custom session signing (not NextAuth)

NextAuth v5 is configured for end-user Google OAuth — its session is keyed
on `googleId`, not on `admin_users.id`. Bolting admin auth into the same
NextAuth instance would conflate two distinct identity systems. The custom
HMAC-signed cookie:

- Uses Web Crypto (works in BOTH edge runtime for middleware AND node
  runtime for API routes — no separate impl needed)
- Has no library dependency
- Lives in its own cookie (`pk_admin_session`, `sameSite=strict`)
- Is short-lived (8 hours) — admin sessions don't roam
- Constant-time-ish via `subtle.verify()` (no manual byte comparison)

### Routes

| Route                                      | What                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| `GET /admin/login`                         | Login form (no chrome)                                          |
| `POST /api/admin/login`                    | Verify bcrypt password; set cookie; 303 to `?from=` or `/admin` |
| `POST /api/admin/logout`                   | Clear cookie; 303 to login                                      |
| `GET /admin`                               | Dashboard: pending reports, soft-flagged, hidden, totals        |
| `GET /admin/queue?filter=…`                | Reviews queue (soft_flagged / flagged_hidden / live)            |
| `GET /admin/reports`                       | Pending reports queue, oldest first                             |
| `PATCH /api/admin/reviews/[id]/moderation` | `{ action: 'approve'\|'hide'\|'delete' }`                       |
| `POST /api/admin/reports/[id]/resolve`     | `{ action: 'keep'\|'remove' }`                                  |
| `PATCH /api/admin/professors/[id]`         | status / designation / name updates                             |

### Middleware (`middleware.ts`)

Matches `/admin/:path*` and `/api/admin/:path*`, lets the two login endpoints
through, verifies the signed cookie via `verifyAdminSessionToken`. UI routes
without a session → 307 to `/admin/login?from=<intended path>`. API routes
without a session → JSON 401. Open-redirect guarded: `?from` must start with
`/admin` and not `//`.

### Cache invalidation

Every admin action that changes review visibility (`approve`, `hide`,
`delete`, `resolve` with `remove`) invalidates `stats:site` AND the
professor's profile cache so the public site doesn't keep serving the old
state from Redis.

### Verified

- `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (**55 tests**, +6 new)
- Live smoke:
  - Unauth `/admin` → 307 to `/admin/login`
  - Unauth `/admin/queue` → 307 to `/admin/login?from=/admin/queue`
  - Unauth `POST /api/admin/...` → 401 JSON
  - `POST /api/admin/login` with seeded `admin`/`changeme123` → 303 + cookie set
  - With cookie: `/admin`, `/admin/queue`, `/admin/reports` all 200

### Decisions

| Decision                                   | Reason                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Custom HMAC cookie (not NextAuth)          | Admin is a distinct identity space; keeps the two systems decoupled            |
| Web Crypto (not node:crypto)               | Same code runs in edge middleware AND node routes                              |
| 8h TTL                                     | Admin sessions should be short — typical moderation pass is well under 8h      |
| sameSite=strict on admin cookie            | Admin actions should never be CSRF-able from a non-admin tab                   |
| `?from=` open-redirect guard               | Only allow `/admin/...` paths after login                                      |
| Static `STRINGS.admin.*` in English        | Internal tooling; not user-facing                                              |
| Delete = mark `status='deleted'`, keep row | The public transparency placeholder (SRS §4.9) needs the row to render against |

---

## Session 8 — June 2026 (`test/integration-suite`)

### What was built — 25 DB-backed integration tests

The unit suite covers pure logic (slug, moderation, aggregation, etc.).
The integration suite covers the routes that the unit suite can't — DB
transactions, find-or-create flows, the anonymity contract at the
schema level, and the Redis dedup mechanism.

### Architecture

- **`test/global-setup.integration.ts`** runs once before any worker boots.
  Loads `.env.local` (tiny in-house parser so we don't add `dotenv` as a
  dep), pins `DATABASE_URL` to `DATABASE_URL_TEST`, then `prisma migrate
deploy` and `CREATE EXTENSION IF NOT EXISTS pg_trgm` against the test DB.
- **`test/setup.integration.ts`** mocks `@/lib/redis` with an in-memory
  store (full NX semantics + TTL emulation) and `@/lib/auth` so each test
  can inject a session via `mockSession(userId)`.
- **`test/integration-helpers.ts`** exposes `cleanDb()` (TRUNCATE w/
  RESTART IDENTITY CASCADE in dependency order), `seedMinimal()`
  (1 uni + 1 dept + 3 users), and `jsonPost()`.
- Vitest runs in a single fork (`singleFork: true`) so the Postgres test
  DB is serialised — much simpler than per-test schemas.

### Suite layout

`__tests__/integration/reviews-api.test.ts` — POST /api/reviews

- Auth 401, happy path
- **Schema-level anonymity check**: `information_schema.columns` confirms
  the `reviews` table has no `user_id` column and no review-submission FK
- Duplicate-submission 409
- Two-user weighted average (5 + 3 → 4.0)
- Honeypot 400
- Hard-block on profanity (no DB write)
- Soft-flag on ALL CAPS (DB write with `moderation_status = 'soft_flagged'`)
- Out-of-range rating, missing identifier set

`__tests__/integration/helpful-voting.test.ts` — POST/GET /api/reviews/[id]/helpful

- GET state read (unauth + 404), 401 POST, toggle on/off, cross-user
  aggregation, missing review, invalid id

`__tests__/integration/reports.test.ts` — POST /api/reports

- 401, invalid reason 400, 404 missing review
- INSERT + Redis dedup-key sanity check (introspects `__redisStore`)
- Idempotent duplicate from same user
- 2 distinct users → still live
- 3 distinct users → `moderation_status = 'flagged_hidden'`, response
  carries `auto_hidden: true, threshold: 3`

### Numbers

- 25 integration tests pass in ~5s
- 80 tests total (55 unit + 25 integration)
- All routes exercised against real Postgres (test DB, port 5435 locally)

### Decisions

| Decision                           | Reason                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Mock Redis, real Postgres          | The point of integration tests is the DB layer; ioredis is the boundary, not the unit under test |
| `singleFork: true`                 | One Postgres DB shared across tests; avoid race conditions                                       |
| `cleanDb()` per-test, not per-file | Fast (~50ms) and keeps tests independent                                                         |
| In-house env parser                | Skip `dotenv` package install for one ~20-line function                                          |
| Schema-level anonymity check       | Catches accidental migrations that re-introduce `user_id` on reviews                             |

---

## Session 9 — June 2026 (`feat/professor-typeahead-with-add` + `feat/seed-all-bd-universities`)

### What was built

- **Professor typeahead picker** in the review form. Replaces the free-text input with a debounced search dropdown scoped to the chosen university + department, plus a dashed "Add 'xxxx' as a new professor" fallback row that lets a student submit even when their professor isn't in the catalog yet. The existing `POST /api/reviews` auto-create path picks up the new name on submit.
  - `GET /api/professors/search?q=&university_id=&department_id=` — pg_trgm + ILIKE fuzzy match, joins `professor_courses` for `review_count`. Public read; no auth, no tracking.
  - `components/review/ProfessorTypeahead.tsx` — 180 ms debounce, abort-in-flight, opaque floating panel (`bg-card` + `shadow-lg`) so the form rows beneath don't bleed through, "Change" button to clear a locked-in pick.
- **Full canonical BD university catalog** seeded from the Wikipedia _List of universities in Bangladesh_ page (English names + acronyms) and the equivalent Bangla Wikipedia page (Bengali names). 161 entries total; 15 still carry curated department lists.
  - Acronyms come from Wikipedia, not generated initials — no more `BU2 / BU3 / GUB2 / PU4`. When two institutions naturally share an acronym (e.g. four candidates for "BU"), the most-recognised owner keeps the plain form; the others get readable suffixes (`BdshU` for Bangladesh University, `BritU` for Britannia, `BdU` for Bandarban).
  - **Idempotent heal-in-place**: re-running `pnpm db:seed` against an older DB rewrites stale rows by `nameEn` match, then prunes any leftover row that has no professors attached. Rows with real professors are kept and flagged for admin review rather than silently rewritten.
  - Earlier bulk seed produced `Independent University` (IU3) as a duplicate of `Independent University, Bangladesh` (IUB) because normalization didn't catch the suffix variant — this version uses Wikipedia's canonical spelling for both fields, so there's only one row per institution.

### Decisions

| Decision                                       | Reason                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope professor search by uni + dept           | A global "search Rahman" is useless; the picker only matters inside a context the student already chose                                                                             |
| Auto-create professors on review submit        | Department-typeahead is next; mirroring the same pattern (server-side auto-create when `*_id` is absent) keeps the form simple                                                      |
| Curate the catalog instead of crowdsourcing it | A blank university catalog blocks the entire review flow for 80 % of students. Wikipedia gives us a defensible starting point; admins can clean up the long tail via /admin         |
| Placeholder-rename + upsert dance              | Direct upserts hit unique-constraint collisions when stale rows hold shortNames the canonical list wants. Renaming everything to `__tmp_<id>` first decouples the order of upserts. |
| Prune by placeholder, not by `nameEn` notIn    | Means we never accidentally delete a row that has real professors attached — those rows can't have a placeholder shortName, since the upsert healed them                            |

---

## Feature Reference

As features are completed, add them here for quick lookup.

### Completed Features

| Feature               | Files                                                | Notes                                                                                                                                                 |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema         | `prisma/schema.prisma`                               | All 10 tables, anonymity contract enforced by structure                                                                                               |
| NextAuth Google OAuth | `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` | No email stored — only Google `sub`                                                                                                                   |
| Foundation libs       | `lib/db.ts`, `lib/redis.ts`, `lib/strings.ts`        | Singletons safe for Next.js dev/prod                                                                                                                  |
| Seed data             | `prisma/seed.ts`                                     | 161 Wikipedia-sourced BD universities (canonical acronyms + Bangla names + city); 15 with curated departments; idempotent heal-in-place + stale prune |
| CI pipeline           | `.github/workflows/ci.yml`                           | 4 jobs: quality → unit → integration → build                                                                                                          |

| Homepage with search | `app/page.tsx` | RSC with Redis-cached stats (60 s TTL) |
| Universities listing | `app/universities/page.tsx` | ISR 5 min, grouped by type |
| University detail page | `app/universities/[slug]/page.tsx`| ISR 5 min, lists departments |
| Professor profile (stub) | `app/professors/[slug]/page.tsx` | ISR 1 min, per-course score cards |
| Cross-entity search | `lib/search.ts`, `app/search/page.tsx` | pg_trgm fuzzy + ILIKE, UNION ALL |
| Live debounced search | `components/search/SearchBox.tsx`, `app/api/search/route.ts` | 200 ms debounce + dropdown |
| Navbar | `components/layout/Navbar.tsx` | Sticky header, inline search, auth dropdown |
| Health endpoint | `app/api/health/route.ts` | DB + Redis probes; returns 503 if either down |
| Slug helpers | `lib/slug.ts` | ASCII-safe slugs with collision suffixes |
| Moderation (2-tier) | `lib/moderation.ts` | Hard block (profanity/slurs/accusations) + soft flag (caps, length, grudge) |
| Running averages | `lib/aggregation.ts` | O(1) per-insert formula, raw-SQL equivalent in API |
| Review submission API | `app/api/reviews/route.ts` | The anonymity transaction: reviews INSERT with NO user_id, paired with review_submissions INSERT, plus running-avg UPDATE — all atomic |
| Review form page | `app/review/new/page.tsx`, `components/review/ReviewForm.tsx` | Auth-gated, find-or-create professor, 4 ratings + tags + optional text + honeypot |
| Helpful voting API | `app/api/reviews/[id]/helpful/route.ts` | POST toggle + GET status; transactional vote+counter; race-safe |
| Review card + helpful button | `components/review/ReviewCard.tsx`, `components/review/HelpfulButton.tsx` | Server card + client button with optimistic UI and sign-in fallback |
| Report a review | `app/api/reports/route.ts`, `components/review/ReportButton.tsx`, `lib/reports.ts` | Auth-required POST, Redis NX dedup, 3-strike transactional auto-hide |
| Combined professor stats | `lib/professor-stats.ts` | Weighted by review_count across all courses (SRS Level 1) |
| Full professor profile | `app/professors/[slug]/page.tsx` | Combined score card + per-course cards + 3-review preview + "see all" links |
| Per-course reviews list | `app/professors/[slug]/[course-slug]/page.tsx` | Sort (helpful/recent), pagination (10/pg), batched vote state |
| Admin auth | `lib/admin-auth.ts`, `middleware.ts` | Custom HMAC-SHA256 signed cookie (Web Crypto, edge+node) |
| Admin login | `app/admin/login/page.tsx`, `app/api/admin/login/route.ts` | Bcrypt verify, 303 + cookie, open-redirect guarded |
| Admin dashboard | `app/admin/page.tsx` | Pending reports / soft-flagged / hidden / totals |
| Moderation queue | `app/admin/queue/page.tsx` + `AdminReviewActions` | Approve / hide / delete with confirmations |
| Reports queue | `app/admin/reports/page.tsx` + `AdminReportActions` | Oldest-first; resolve keep / remove |
| Admin moderation API | `app/api/admin/reviews/[id]/moderation/route.ts`, `app/api/admin/reports/[id]/resolve/route.ts`, `app/api/admin/professors/[id]/route.ts` | Zod-validated PATCH/POST, cache invalidation |
| Integration test suite | `test/global-setup.integration.ts`, `test/setup.integration.ts`, `test/integration-helpers.ts`, `__tests__/integration/*.test.ts` | 25 DB-backed tests against the test Postgres; mocks Redis + NextAuth |
| Professor search API | `app/api/professors/search/route.ts` | Scoped to uni+dept, pg_trgm fuzzy + ILIKE, joins `professor_courses` for review_count |
| Professor typeahead picker | `components/review/ProfessorTypeahead.tsx` | Debounced (180 ms), abort-in-flight, opaque floating panel; dashed "Add 'xxxx' as a new professor" fallback row when no exact match |
| Canonical BD university catalog | `prisma/seed.ts` | 161 Wikipedia-sourced entries with canonical acronyms + Bangla names + city; placeholder-rename + upsert + prune for idempotent re-seeds |
| Department search API | `app/api/departments/search/route.ts` | Scoped to a single university; pg_trgm + ILIKE across `short_name` and `name_en`; verified rows surface first |
| Department typeahead picker | `components/review/DepartmentTypeahead.tsx` | Same debounced/opaque pattern as the professor picker; full dept list visible on focus; dashed "Add 'xxxx' as a new department" fallback |
| Department auto-create on review submit | `lib/department-parser.ts`, `resolveDepartment` in `app/api/reviews/route.ts` | Parses "CSE - Computer Science and Engineering" / "Computer Science and Engineering (CSE)" / bare "CSE" / full-name input into `shortName + nameEn`. New rows stored with `status='unverified'`. |
| Department status field | `prisma/schema.prisma`, migration `20260609193125_add_department_status` | `DepartmentStatus` enum (verified/unverified), default unverified. Seed-curated departments flip to verified on every seed run. |
| Admin merge-departments tool | `app/api/admin/departments/merge/route.ts`, `app/admin/universities/[id]/DepartmentList.tsx` | Tick ≥2 rows in the admin dept list → pick canonical target → transactional repoint of professors + courses + delete sources + mark target verified |
| Add-new-department micro-form | `components/review/DepartmentTypeahead.tsx` (the `NewDepartmentForm` sub-component) | Tapping "+ Add as new" opens a two-field inline form (Acronym + Full name) prefilled by parsing the typed query. The user explicitly confirms both fields, so we never guess at the split. New rows still land as `status='unverified'` and an admin verifies/merges via the existing tool. |
| Course search API | `app/api/courses/search/route.ts` | Scoped to a single department; pg_trgm + ILIKE across both `course_code` and `course_name`; returns `review_count` per course |
| Course twin-autocomplete fields | `components/review/CourseFields.tsx` | Shared debounced search drives a dropdown from either the code or name input; picking a hit prepopulates BOTH fields ("CSE 301" → also fills "Data Structures"); both stay editable. No "Add as new" UI — the review POST handler already auto-creates the course row on submit when the code/name combo is new. |
| University search API | `app/api/universities/search/route.ts` | pg_trgm + ILIKE over short_name / name_en / name_bn; empty-q returns the full catalog capped at 8. |
| University typeahead + request form | `components/review/UniversityTypeahead.tsx` | Replaces the plain `<select>`. Unmatched input opens a "Request '<name>' as a new university" inline form (name_en + optional name_bn + type radio). Submission creates a UniversityRequest row and swaps the typeahead for a "request received" confirmation. |
| POST /api/university-requests | `app/api/university-requests/route.ts` | Auth-gated. Rejects duplicates-with-real-uni (409), user's own pending duplicates (409), and > 5 pending per user (429). |
| Admin university-request queue | `app/admin/university-requests/*` | Status-tab filter (pending/approved/rejected). Approve panel lets admin polish short_name/slug/location_city before publishing; reject panel takes a note. Dashboard adds a live "University requests" action card. |
| Admin resolve endpoint | `app/api/admin/university-requests/[id]/resolve/route.ts` | Transactional — approve creates the University row inside the same tx as flipping the request to `approved`; reject just flips status. Unique-constraint clashes surface as 409 with a targeted error. |
| UniversityRequest schema | `prisma/schema.prisma`, migration `20260710_add_university_requests` | New table + `UniversityRequestStatus` enum. FK to `users.id` with cascade delete. |
| Vercel deployment prep | `vercel.json`, `package.json` (`vercel-build`, `postinstall`), `prisma/schema.prisma` (`directUrl`), `lib/redis.ts` (nullable client + `acquireOnce`), `.env.example` | Region-pinned to `bom1` (Mumbai). Migrations run as `prisma migrate deploy` inside the build step; failed migrations abort the deploy. Redis is now optional — the app boots without `REDIS_URL` and degrades to no-cache. |
| Deployment walkthrough | `docs/deployment/vercel-neon.md` | End-to-end guide: Neon signup → Upstash → Google OAuth prod creds → Vercel env vars → first-time seed → domain → uptime monitor. Documents tier limits and when to fall back to the VPS path. |

### Planned Features (from SRS)

| Feature                          | Priority | Status                                  |
| -------------------------------- | -------- | --------------------------------------- |
| Professor profile page (full)    | P0       | ✅ Done (`feat/professor-profile-full`) |
| Review submission form           | P0       | ✅ Done (`feat/review-submission`)      |
| University directory             | P0       | ✅ Done (Session 2)                     |
| Department pages                 | P0       | ✅ Done (Session 2)                     |
| Search API                       | P0       | ✅ Done (Session 2/2.5)                 |
| Review submission API            | P0       | ✅ Done (`feat/review-submission`)      |
| Helpful voting                   | P0       | ✅ Done (`feat/helpful-voting`)         |
| Report a review                  | P0       | ✅ Done (`feat/report-review`)          |
| Admin panel                      | P0       | ✅ Done (`feat/admin-panel`)            |
| Soft moderation (keyword filter) | P0       | ✅ Done (`feat/review-submission`)      |
| Site-wide stats                  | P0       | ✅ Done (Session 2)                     |
| About / privacy policy page      | P0       | 🔲 Not started                          |
