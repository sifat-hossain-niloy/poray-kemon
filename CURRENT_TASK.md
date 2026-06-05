# Current Task — Poray Kemon

> **For Claude Code:** Read this file first in every new session. It tells you exactly where we are and what to build next. After finishing a session, update this file before closing.

---

## Project Status

**Phase:** Pre-development — documentation complete, codebase not yet scaffolded  
**Last updated:** June 2026

---

## What Has Been Done

- [x] SRS written and finalized (v1.3) — see `poray-kemon-srs.md`
- [x] Tech stack decided (Next.js 15, PostgreSQL, Prisma, Redis, Docker, NextAuth, Tailwind + shadcn/ui)
- [x] `CLAUDE.md` created — project context for all AI tools
- [x] 8 ADRs written — `docs/architecture/adrs/`
- [x] System architecture doc — `docs/architecture/system-architecture.md`
- [x] Data model reference — `docs/architecture/data-model.md`
- [x] OpenAPI 3.1 spec — `docs/api/openapi.yaml`
- [x] Deployment runbook — `docs/deployment/runbook.md`
- [x] Contributing guide — `docs/development/contributing.md`
- [x] Test plan — `docs/development/test-plan.md`
- [x] Diagrams (ER, system, user flows, auth/anonymity) — `docs/diagrams/`

---

## What We Are Building Now

**Next task: Scaffold the project**

Steps in order:

1. Initialize Next.js 15 app with TypeScript (`pnpm create next-app`)
2. Set up `docker-compose.yml` (PostgreSQL 16 + Redis 7 + Umami)
3. Configure Prisma — write `prisma/schema.prisma` from the data model in `docs/architecture/data-model.md`
4. Run first migration + seed universities/departments
5. Set up ESLint, Prettier, Husky, Commitlint
6. Set up Tailwind CSS 4 + shadcn/ui
7. Configure NextAuth.js v5 with Google OAuth

---

## Decisions Made This Session

_(Update this section each session with any new decisions or clarifications)_

- Docs are committed to git, not gitignored
- Docker Compose used for local dev (Next.js runs on host, services in Docker)
- Production deployment: full Docker on VPS (not Vercel) — for learning purposes

---

## Open Questions / Blockers

_(List anything unresolved that needs a decision before proceeding)_

- Google OAuth credentials not yet created (need Google Cloud Console setup before auth works)
- No domain/VPS purchased yet — local development only for now

---

## Key Files to Read for Context

If this is a new session, read these in order:

1. `CURRENT_TASK.md` — this file ✓
2. `CLAUDE.md` — project overview, stack, commands, conventions
3. `poray-kemon-srs.md` — full product requirements
4. `docs/architecture/system-architecture.md` — how the system works
5. `docs/architecture/data-model.md` — database schema
