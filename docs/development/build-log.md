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

### Planned Features (from SRS)

| Feature                          | Priority | Status                                                          |
| -------------------------------- | -------- | --------------------------------------------------------------- |
| Professor profile page (full)    | P0       | 🟡 Stub with 3-review preview — full sort/pagination still TODO |
| Review submission form           | P0       | ✅ Done (`feat/review-submission`)                              |
| University directory             | P0       | ✅ Done (Session 2)                                             |
| Department pages                 | P0       | ✅ Done (Session 2)                                             |
| Search API                       | P0       | ✅ Done (Session 2/2.5)                                         |
| Review submission API            | P0       | ✅ Done (`feat/review-submission`)                              |
| Helpful voting                   | P0       | ✅ Done (`feat/helpful-voting`)                                 |
| Report a review                  | P0       | ✅ Done (`feat/report-review`)                                  |
| Admin panel                      | P0       | 🔲 Not started                                                  |
| Soft moderation (keyword filter) | P0       | ✅ Done (`feat/review-submission`)                              |
| Site-wide stats                  | P0       | ✅ Done (Session 2)                                             |
| About / privacy policy page      | P0       | 🔲 Not started                                                  |
