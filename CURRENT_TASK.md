# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. It tells you exactly where we are and what to build next. After finishing a session, update this file before closing.

---

## Project Status

**Phase:** Scaffolded — git initialized, all dependencies installed, initial commit made
**Last updated:** June 2026

---

## What Has Been Done

- [x] SRS written and finalized (v1.3) — see `poray-kemon-srs.md`
- [x] Tech stack decided — Next.js 16, PostgreSQL 16, Prisma 6, Redis 7, Docker, NextAuth v5, Tailwind 4 + shadcn/ui
- [x] `CLAUDE.md` + `CURRENT_TASK.md` created
- [x] 8 ADRs, system architecture, data model, OpenAPI spec, runbook, contributing guide, test plan, 4 diagrams
- [x] Next.js 16 scaffolded (App Router, TypeScript strict mode)
- [x] All dependencies installed: Prisma, NextAuth v5, ioredis, React Hook Form, Zod, Vitest, Playwright, Husky, Commitlint, Prettier
- [x] `prisma/schema.prisma` — full 10-table schema with anonymity contract
- [x] `docker-compose.yml` — PostgreSQL 16 + test DB + Redis 7 + Umami
- [x] `docker/postgres/init.sql` — pg_trgm + uuid-ossp extensions enabled on first start
- [x] Husky hooks: pre-commit (lint-staged) + commit-msg (commitlint)
- [x] Vitest config (unit + integration) + Playwright config
- [x] Initial git commit on `main` — clean working tree

---

## What We Are Building Now

**Next task: Local dev environment + first database migration**

Steps in order:

1. `cp .env.example .env.local` and fill in local values
2. `docker compose up -d` — start PostgreSQL + Redis
3. `pnpm db:migrate` — run first Prisma migration (creates all tables)
4. Write `prisma/seed.ts` — seed universities + departments from SRS Appendix A
5. `pnpm db:seed` — run seed script
6. Install shadcn/ui components (`pnpm dlx shadcn@latest init`)
7. Write `lib/db.ts` — Prisma client singleton
8. Write `lib/redis.ts` — Redis client singleton
9. Write `lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts` — NextAuth config
10. Build the homepage (`app/page.tsx`) — search bar + site stats

---

## Decisions Made

- Next.js 16.2.7 (newer than planned 15.x — same App Router paradigm)
- Tailwind CSS 4 already bundled by create-next-app (no separate upgrade needed)
- Prisma 6 (not 5 as originally planned — fully compatible)
- `commitlint.config.cjs` in CJS format — ESM caused loading failures
- Docs committed to git (not gitignored) — required for agentic development
- Docker Compose for local services; Next.js runs on host for HMR

---

## Open Questions / Blockers

- Google OAuth credentials not yet created — needed before auth features work
- No domain/VPS yet — local development only for now
- `prisma/seed.ts` not yet written

---

## Key Files to Read for Context

If this is a new session, read these in order:

1. `CURRENT_TASK.md` — this file
2. `CLAUDE.md` — project overview, stack, commands, conventions
3. `poray-kemon-srs.md` — full product requirements
4. `prisma/schema.prisma` — current database schema
5. `docs/architecture/system-architecture.md` — how the system works
