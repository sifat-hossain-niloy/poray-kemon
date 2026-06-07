# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. After finishing a session, update it before closing.

---

## Project Status

**Phase:** Professor profile complete — combined score + per-course full reviews list with sort & pagination
**Last updated:** June 2026 (Session 6)
**Active branch:** `feat/professor-profile-full` (PR open against main)

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

### Session 6 — full professor profile (this branch)

- [x] `lib/professor-stats.ts` — pure helper for combined weighted score
      across all courses (weights = review_count); 5 unit tests covering
      empty / zero-review / weighted / null-safety edges
- [x] `app/professors/[slug]/page.tsx` — added Level-1 combined-score card
      (SRS §4.6 FR-STAT-02): big overall score, recommend %, all 4 dims;
      each course card gets a "সব রিভিউ দেখুন →" link when count > 3
- [x] `app/professors/[slug]/[course-slug]/page.tsx` — new page with:
      breadcrumb, per-course aggregate header, helpful/recent sort tabs,
      10-per-page pagination, batched per-viewer vote lookup, empty state
- [x] **49 unit tests pass** (+5 new)

---

## What We Are Building Next

After this PR is merged, the next steps from SRS are:

### Step 1 — Admin panel

`app/admin/*` — password login, moderation queue, edit/hide/delete actions, manual professor merging.
New branch: `feat/admin-panel`.

### Step 2 — Integration tests

`__tests__/integration/reviews-submission.test.ts` — full API tests against the test DB (port 5435), including the anonymity transaction atomicity check.
New branch: `test/integration-reviews-api`.

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
