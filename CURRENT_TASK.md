# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. After finishing a session, update it before closing.

---

## Project Status

**Phase:** Review-form professor typeahead + canonical BD university catalog
**Last updated:** June 2026 (Session 10)
**Active branches:** `feat/professor-typeahead-with-add` (PR open) and `feat/seed-all-bd-universities` (PR open)

---

## What Has Been Done

### Session 1 — scaffold + docs

- [x] SRS v1.3, 8 ADRs, system architecture, data model, OpenAPI spec, runbook, contributing, test plan, 4 Mermaid diagrams
- [x] Next.js 16 + TS strict + Prisma 6 + Docker Compose + NextAuth v5 + Vitest + Playwright + Husky/Commitlint
- [x] Foundation libs: `lib/db.ts`, `lib/redis.ts`, `lib/strings.ts`, `lib/auth.ts`, `lib/validations/review.ts`
- [x] GitHub Actions CI/CD workflows
- [x] Prisma schema (all 10 tables) + seed for 15 BD universities

### Session 2 — database live + read paths

- [x] Initial migration applied, seed run
- [x] Postgres on port 5434 (host conflict workaround), `dotenv-cli` for db scripts
- [x] shadcn/ui (base-nova preset); Hind Siliguri as `--font-sans`
- [x] Navbar + Universities listing + University detail + Professor stub
- [x] `/search` with pg_trgm fuzzy + ILIKE UNION ALL
- [x] `/api/health`

### Session 2.5 — live debounced search

- [x] `components/search/SearchBox.tsx` — 200 ms debounce, dropdown, keyboard nav
- [x] `app/api/search/route.ts` JSON endpoint
- [x] Replaced static form on homepage + navbar

### Session 3 — write path (`feat/review-submission`, merged)

- [x] `lib/slug.ts` — ASCII slug + collision-suffix helper
- [x] `lib/moderation.ts` — two-tier keyword filter (hard block + soft flag)
- [x] `lib/aggregation.ts` — running average formula in JS for unit tests
- [x] `lib/validations/review.ts` — updated schema (find-or-create professor by id OR uni+dept+name)
- [x] `app/api/reviews/route.ts` — full anonymity transaction
- [x] `app/review/new/page.tsx` + `components/review/ReviewForm.tsx`
- [x] Unit tests: moderation (15), slug (12), aggregation (9) — **36 tests pass**
- [x] Branch + PR workflow now in effect; `gh` CLI optional
- [x] CI fix: pnpm version conflict (`fix/ci-pnpm-version-conflict`, merged)

### Session 4 — helpful voting (`feat/helpful-voting`, merged)

- [x] `app/api/reviews/[id]/helpful/route.ts` — POST toggle + GET status,
      transactional vote + counter, race-condition recovery via unique key
- [x] `components/review/HelpfulButton.tsx` — optimistic UI with rollback;
      unauthenticated click triggers Google OAuth via `signIn('google')`
- [x] `components/review/ReviewCard.tsx` — server component with stars,
      tags, recommend badge, date, helpful button; honours moderation status
- [x] `app/professors/[slug]/page.tsx` switched to dynamic; top 3 reviews
      per course rendered with per-viewer vote state in one DB round-trip

### Session 5 — report a review (`feat/report-review`, merged)

- [x] `lib/reports.ts` — pure helpers: AUTO_HIDE_THRESHOLD, shouldAutoHide(),
      Redis dedup key + TTL constants
- [x] `app/api/reports/route.ts` — auth-required POST, Redis NX dedup on
      `(userId, reviewId)`, transactional INSERT + auto-hide at 3 pending
      reports, cache invalidation when a review gets hidden
- [x] `components/review/ReportButton.tsx` — native `<dialog>` modal with
      radio reasons, optional details textarea, OAuth fallback for unauth
- [x] ReviewCard footer extended with the report button
- [x] Unit tests for the threshold + dedup-key helpers (8 cases) — 44 total

### Session 6 — full professor profile (`feat/professor-profile-full`, merged)

- [x] `lib/professor-stats.ts` — combined weighted score helper
- [x] `app/professors/[slug]/page.tsx` — Level-1 combined-score card
- [x] `app/professors/[slug]/[course-slug]/page.tsx` — full reviews list with
      sort tabs + pagination

### Session 7 — admin panel (`feat/admin-panel`, merged)

- [x] `lib/admin-auth.ts` — Web Crypto HMAC-SHA256 signed cookie (edge + node)
- [x] `middleware.ts` — gates `/admin/*` and `/api/admin/*` (except login)
- [x] `app/admin/login/page.tsx` + `app/api/admin/login/route.ts` — bcrypt
      password check against `admin_users`, sets `pk_admin_session` cookie
- [x] `app/admin/page.tsx` — dashboard with 6 live counts
- [x] `app/admin/queue/page.tsx` — moderation queue with filter tabs
      (soft_flagged / flagged_hidden / live), review actions:
      approve / hide / delete
- [x] `app/admin/reports/page.tsx` — pending reports queue with reviewer
      content + reporter note, resolve as keep / remove
- [x] Action APIs: PATCH `/api/admin/reviews/[id]/moderation`,
      POST `/api/admin/reports/[id]/resolve`, PATCH `/api/admin/professors/[id]`
- [x] Cache invalidation on every state change (stats:site + prof:{slug})
- [x] 6 unit tests for HMAC signing (round-trip, tampered payload, tampered
      signature, wrong secret, expired, malformed) — 55 tests total

### Session 8 — integration test suite (this branch)

- [x] `test/global-setup.integration.ts` — loads `.env.local` (in-house parser,
      no `dotenv` dep), pins `DATABASE_URL` to the test DB, runs
      `prisma migrate deploy`, enables `pg_trgm` on the test DB
- [x] `test/setup.integration.ts` — mocks `@/lib/redis` with an in-memory
      store (full NX semantics) and `@/lib/auth` (per-test session injection)
- [x] `test/integration-helpers.ts` — `cleanDb()` (TRUNCATE w/ CASCADE),
      `seedMinimal()` (1 uni + 1 dept + 3 users), `mockSession()`,
      `mockUnauthenticated()`, `jsonPost()`
- [x] `__tests__/integration/reviews-api.test.ts` — 10 tests:
      auth gate, happy path, **schema-level anonymity check**, duplicate
      guard, two-user weighted average, honeypot, hard-block, soft-flag,
      bad rating, missing identifiers
- [x] `__tests__/integration/helpful-voting.test.ts` — 8 tests:
      GET state, GET 404, POST 401, toggle ON, toggle OFF, cross-user
      aggregation, missing review, invalid id
- [x] `__tests__/integration/reports.test.ts` — 7 tests:
      401, 400 invalid reason, 404 missing review, INSERT + Redis dedup
      key, idempotent dup, 2 reports = no auto-hide, 3 reports = auto-hide
- [x] All 25 integration tests + 55 unit tests = **80 tests pass** in ~5s

### Session 9 — auth fix + i18n toggle (two PRs)

`fix/auth-google-sub`:

- [x] `lib/auth.ts` rewritten to key `users.google_id` on the real Google
      `sub` (from `account.providerAccountId`), not NextAuth's generated
      UUID. Fixes the bug where `/review/new` bounced authenticated users
      back to sign-in because the session callback couldn't find their row.
- [x] Session augmented so `session.user.id` is typed everywhere
- [x] `internalUserId` cached on the JWT to avoid a DB round-trip per request

`feat/i18n-toggle`:

- [x] `lib/i18n/strings-bn.ts` — Bangla bundle (source of truth for the `Strings` type)
- [x] `lib/i18n/strings-en.ts` — full English mirror
- [x] `lib/i18n/shared.ts` — pure helpers (Locale type, stringsFor, cookie name)
- [x] `lib/i18n/index.ts` — server-only `getLocale()` / `getStrings()` via `next/headers`
- [x] `lib/i18n/client.tsx` — `LocaleProvider` + `useLocale()` + `useStrings()`
- [x] `app/api/locale/route.ts` — public POST that sets the `pk_lang` cookie
- [x] `components/i18n/LanguageToggle.tsx` — pill toggle in the navbar
- [x] Root layout + Navbar + Homepage + SearchBox refactored to use the live strings
- [x] Legacy `STRINGS` re-export in `lib/strings.ts` kept for the rest of the app
      — progressive migration; other pages stay Bangla-only for now

### Session 10 — professor typeahead + canonical BD university catalog (two PRs, both merged)

`feat/professor-typeahead-with-add`:

- [x] `app/api/professors/search/route.ts` — scoped (uni+dept) pg_trgm fuzzy + ILIKE search, joins `professor_courses` for `review_count`. Public.
- [x] `components/review/ProfessorTypeahead.tsx` — debounced (180 ms), abort in-flight on each keystroke, opaque floating panel (`bg-card` + `shadow-lg`) so course-field rows don't bleed through.
- [x] Dashed "Add 'xxxx' as a new professor" fallback row when no exact match. On submit, the existing `POST /api/reviews` auto-create path creates the Professor row — no extra client-side work.
- [x] `ReviewForm.tsx` rewired: picker is disabled until both uni and dept are chosen; switching either clears the selection.

`feat/seed-all-bd-universities`:

- [x] `prisma/seed.ts` rewritten to use a curated Wikipedia-sourced catalog (161 entries). English from `List_of_universities_in_Bangladesh`, Bangla from the equivalent page on bn.wikipedia.
- [x] Acronyms are Wikipedia-canonical. No more generated initials, no more `BU/BU1/BU2` numeric suffixes. Where two institutions naturally share an acronym, the most-recognised owner keeps the plain form and the rest get readable suffixes (`BdshU`, `BritU`, `BdU`, etc.).
- [x] Each row carries `nameEn`, `nameBn`, `shortName`, `slug`, `locationCity`, `type` — no auto-generation, no inference.
- [x] **Idempotent heal-in-place re-seed**: every existing `short_name`/`slug` is parked under a `__tmp_<id>` namespace first, canonical upserts run in a clean field, then any row still holding a placeholder is pruned if it has no professors (or flagged for admin review if it does). Cascades departments before pruning so FKs stay clean.
- [x] Departments table unchanged; only the 15 detailed unis still carry a curated department list. The remaining ~146 are filled in by the Session 11 department typeahead.

### Session 11 — department typeahead + admin merge tool (`feat/department-typeahead-with-add`)

- [x] `DepartmentStatus` enum + migration `20260609193125_add_department_status`. Seed-curated rows flip to `verified`; user-created rows default to `unverified`.
- [x] `GET /api/departments/search?q=&university_id=` — pg_trgm + ILIKE search; empty-query returns the full uni dept list; verified rows ranked first.
- [x] `components/review/DepartmentTypeahead.tsx` — same opaque debounced/floating-panel pattern as `ProfessorTypeahead`; amber "Pending review" badge on unverified hits; dashed "Add 'xxxx' as a new department" fallback row.
- [x] `lib/department-parser.ts` (pure, 10 unit tests) — parses `"CSE - Computer Science and Engineering"`, `"Computer Science and Engineering (CSE)"`, bare `"CSE"`, `"C.S.E."`, or any full-name string into `{shortName, nameEn}`.
- [x] `resolveDepartment` in `app/api/reviews/route.ts` — runs before `resolveProfessor`. Case-insensitive find-or-create within the university; non-colliding slug; falls back to null `shortName` if a casing collision sneaks through.
- [x] `ReviewForm.tsx` rewired: the dept `<select>` is gone; a free-text professor input is shown when the dept is a new (unsaved) one (no `department_id` to typeahead-scope by).
- [x] `POST /api/admin/departments/merge` — transactional: sanity-check shared-university, repoint `professors.department_id` + `courses.department_id`, mark target verified, delete sources. Cross-uni and `target ∈ sources` rejected.
- [x] `app/admin/universities/[id]/DepartmentList.tsx` — checkbox column + merge banner that appears when ≥2 rows selected. "Pending review" badge on unverified rows.
- [x] `lib/search.ts` dept branch uses `COALESCE(d.short_name, d.name_en)` so user-created rows with null shortName don't render as `"BUET · null"`.
- [x] All 25 integration tests + 65 unit tests still pass.
- [x] **Follow-up polish**: dropdown panel now caps at `max-h-[60vh]` with `overflow-y-auto` so universities with many departments scroll cleanly (same fix applied to `ProfessorTypeahead`).
- [x] **Add-new is now a two-field micro-form** (`NewDepartmentForm`). Tapping "+ Add as new" no longer instantly stages the raw text — it opens an inline panel with explicit _Acronym_ and _Full name_ inputs, pre-filled by parsing the user's query (so "CSE - Computer Science and Engineering" auto-splits). The user always sees and confirms both fields before submission. New rows still flow through `status='unverified'` and surface in the admin merge tool for verification.
- [x] `POST /api/reviews` accepts `department_short_name` alongside `department_name_en` and skips the legacy text-parser when both are explicit — the typeahead micro-form always sends both.

---

## What We Are Building Next

After these PRs are merged, the next steps are:

### Step 1 — Department typeahead + add-as-new

Same pattern as professor: scoped search endpoint, debounced typeahead,
"Add 'CSE - Computer Science and Engineering' as a new department"
fallback with smart abbreviation/full-name parsing on the server.
The review POST handler will auto-create a Department row when
`department_id` is absent.

### Step 2 — Admin merge tool

Once add-as-new is live for departments, admins need a "Merge
departments" action so duplicates ("CSE" + "Computer Science and
Engineering" + "C.S.E.") can be collapsed into one canonical row.

---

## Decisions Made

### Session 3

- Review API design: accept either `professor_id` (when known) OR
  `university_id + department_id + professor_name_en` (find-or-create).
  No separate "create professor" endpoint.
- Slug collision strategy: try plain → suffix with university short name →
  suffix with `-2`, `-3`, etc. Cap at 50 attempts.
- Running averages computed in raw SQL inside the transaction because
  Prisma can't express self-referencing arithmetic. Same formula in JS
  (`lib/aggregation.ts`) for unit tests.
- Moderation lives in code, not the DB. Bilingual word lists.
  Hard-block precedence over soft-flag.
- Review text is optional. If provided, must be 20–500 chars.
- "would_recommend" stored as boolean; aggregated as a percentage.
- Course difficulty and attendance strictness are **informational only**
  per SRS Q1 — they don't affect `overall_score`.

---

## Open Questions / Blockers

- **Google OAuth credentials** — still needed before actual sign-in works.
  https://console.cloud.google.com/ → APIs & Services → Credentials
  Redirect URI: `http://localhost:3000/api/auth/callback/google`
- No domain/VPS yet — local only.
- `gh` CLI not installed — PRs created via the URL printed by `git push`.

---

## Key Files to Read for Context

If this is a new session, read in order:

1. `CURRENT_TASK.md` — this file
2. `CLAUDE.md` — overview, conventions
3. `poray-kemon-srs.md` — product requirements
4. `prisma/schema.prisma` — DB schema
5. `app/api/reviews/route.ts` — the anonymity transaction
6. `lib/moderation.ts` — content rules
7. `docs/development/build-log.md` — what's been built and how
