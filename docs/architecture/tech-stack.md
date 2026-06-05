# Tech Stack — Poray Kemon

**Version:** 1.0  
**Last Updated:** June 2026  
**Philosophy:** Future-proof, self-hostable, learn-as-you-build

---

## Final Stack

| Layer                | Technology                           | Version   | ADR                                                |
| -------------------- | ------------------------------------ | --------- | -------------------------------------------------- |
| **Framework**        | Next.js (App Router)                 | 15.x      | [ADR-001](adrs/ADR-001-nextjs-app-router.md)       |
| **Language**         | TypeScript                           | 5.x       | —                                                  |
| **Database**         | PostgreSQL                           | 16        | [ADR-002](adrs/ADR-002-postgresql-prisma.md)       |
| **ORM**              | Prisma                               | 5.x       | [ADR-002](adrs/ADR-002-postgresql-prisma.md)       |
| **Cache + Sessions** | Redis                                | 7.x       | [ADR-005](adrs/ADR-005-redis-caching.md)           |
| **Auth**             | NextAuth.js v5 (Auth.js)             | 5.x       | [ADR-004](adrs/ADR-004-nextauth-google-oauth.md)   |
| **Search**           | PostgreSQL `pg_trgm` + `tsvector`    | built-in  | [ADR-002](adrs/ADR-002-postgresql-prisma.md)       |
| **Containers**       | Docker + Docker Compose              | 27.x      | [ADR-003](adrs/ADR-003-docker-containerization.md) |
| **Reverse Proxy**    | Nginx (Alpine)                       | 1.27      | [ADR-003](adrs/ADR-003-docker-containerization.md) |
| **Styling**          | Tailwind CSS                         | 4.x       | [ADR-006](adrs/ADR-006-tailwind-shadcn.md)         |
| **UI Components**    | shadcn/ui (Radix UI)                 | latest    | [ADR-006](adrs/ADR-006-tailwind-shadcn.md)         |
| **Forms**            | React Hook Form + Zod                | 7.x / 3.x | —                                                  |
| **Testing (unit)**   | Vitest                               | 2.x       | [ADR-007](adrs/ADR-007-testing-strategy.md)        |
| **Testing (E2E)**    | Playwright                           | 1.x       | [ADR-007](adrs/ADR-007-testing-strategy.md)        |
| **Package Manager**  | pnpm                                 | 9.x       | [ADR-008](adrs/ADR-008-pnpm-monorepo.md)           |
| **Linting**          | ESLint + Prettier                    | 9.x / 3.x | —                                                  |
| **Git Hooks**        | Husky + lint-staged                  | 9.x       | —                                                  |
| **Commits**          | Commitlint (conventional)            | 19.x      | —                                                  |
| **Analytics**        | Umami (self-hosted)                  | 2.x       | —                                                  |
| **Observability**    | OpenTelemetry + Prometheus + Grafana | latest    | —                                                  |
| **CI/CD**            | GitHub Actions                       | —         | —                                                  |
| **Hosting (App)**    | Vercel or Docker on VPS              | —         | —                                                  |
| **Hosting (DB)**     | Supabase or Docker self-hosted       | —         | —                                                  |

---

## Why This Stack is Future-Proof

### Next.js 15 + React 19

React Server Components + Server Actions are the direction the React ecosystem is moving. Learning them now means you're ahead of the curve. The App Router is stable and has full industry adoption.

### PostgreSQL 16

PostgreSQL is the most capable open-source relational database. It handles:

- Full-text search natively (no Elasticsearch needed for MVP)
- Array columns for tags
- ACID transactions for the review submission flow
- Up to hundreds of millions of rows without architectural changes

### Prisma 5

The dominant ORM in the TypeScript/Next.js ecosystem. Generates fully type-safe queries from your schema. When you eventually need raw performance, you can drop to `$queryRaw` or migrate specific paths to Drizzle.

### Redis 7

Still the standard in-memory data store. Used for sessions, caching, pub/sub. Knowledge transfers to any future project.

### Docker + Docker Compose

Container knowledge is foundational for modern backend engineering. This project will teach you:

- Multi-stage builds (minimize image size)
- Docker networking (services talk to each other by name)
- Volumes (persistent data)
- Health checks (dependency ordering)
- Production deployment patterns

### shadcn/ui

Unlike traditional component libraries, shadcn/ui gives you full ownership of the code. You copy components into your project and modify them freely. This is increasingly the preferred approach for production apps that need design flexibility.

---

## Dependencies to Install

### Production dependencies

```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@prisma/client": "^5.0.0",
  "next-auth": "^5.0.0",
  "ioredis": "^5.0.0",
  "react-hook-form": "^7.0.0",
  "zod": "^3.0.0",
  "@hookform/resolvers": "^3.0.0"
}
```

### Development dependencies

```json
{
  "typescript": "^5.0.0",
  "prisma": "^5.0.0",
  "@types/node": "^20.0.0",
  "@types/react": "^19.0.0",
  "tailwindcss": "^4.0.0",
  "vitest": "^2.0.0",
  "@vitest/coverage-v8": "^2.0.0",
  "@testing-library/react": "^16.0.0",
  "playwright": "^1.0.0",
  "@playwright/test": "^1.0.0",
  "eslint": "^9.0.0",
  "prettier": "^3.0.0",
  "husky": "^9.0.0",
  "lint-staged": "^15.0.0",
  "@commitlint/cli": "^19.0.0",
  "@commitlint/config-conventional": "^19.0.0"
}
```

---

## Node.js Version

Use **Node.js 20 LTS** (Iron). Specified in `.nvmrc` and `package.json`:

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## What We Deliberately Did NOT Include

| Technology                  | Why skipped                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| GraphQL / tRPC              | REST is simpler for this use case; the API surface is small and well-defined     |
| Elasticsearch / Meilisearch | PostgreSQL `pg_trgm` is sufficient for professor name search at this scale       |
| Zustand / Redux             | State is server-fetched via RSC; no complex client state needed                  |
| Stripe / payment            | No paid features (core design principle)                                         |
| Email service               | No email stored or sent (design principle)                                       |
| React Native / mobile       | Web-first, mobile-responsive (scope decision)                                    |
| Kubernetes                  | Docker Compose is sufficient; K8s is Phase 3+                                    |
| Microservices               | Single Next.js app; splitting would add complexity with no benefit at this scale |
