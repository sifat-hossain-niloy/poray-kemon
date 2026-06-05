# ADR-002: PostgreSQL 16 + Prisma ORM

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

The data model is inherently relational: `University → Department → Professor → ProfessorCourse → Review`. We need:

- ACID transactions (review insert + submission record + aggregate update must be atomic)
- Array column support (review tags stored as `TEXT[]`)
- Full-text search without a separate search service
- Type-safe queries from TypeScript
- Schema migration tooling

Candidates evaluated: PostgreSQL + Prisma, PostgreSQL + Drizzle, MySQL + Prisma, MongoDB, Supabase (with raw SQL).

---

## Decision

Use **PostgreSQL 16** as the database and **Prisma 5** as the ORM.

---

## Rationale

### PostgreSQL over MySQL

PostgreSQL's `TEXT[]` array type is directly useful for storing review tags without a separate join table. MySQL lacks native array columns. PostgreSQL's `pg_trgm` extension provides fuzzy search natively — no Elasticsearch needed for MVP.

### Prisma over Drizzle

| Factor               | Prisma                                 | Drizzle                        |
| -------------------- | -------------------------------------- | ------------------------------ |
| Type safety          | Excellent (auto-generated types)       | Excellent (schema-inferred)    |
| Migration tooling    | `prisma migrate dev` — excellent       | `drizzle-kit` — good but newer |
| Raw SQL escape hatch | `$queryRaw`                            | Native SQL-first design        |
| Studio / GUI         | Prisma Studio built-in                 | No built-in GUI                |
| Community + docs     | Larger, more mature                    | Growing fast                   |
| Learning value       | Industry-standard in Next.js ecosystem | Worth learning, but secondary  |

Prisma's `$transaction` API is critical for the review submission flow where we must atomically write to `reviews`, `review_submissions`, and update `professor_courses`.

Drizzle is an excellent choice and may be worth migrating to in Phase 2 for performance-critical paths, but Prisma's developer experience and tooling are better for the initial build.

---

## Consequences

**Positive:**

- Full type safety from DB schema to TypeScript — no runtime casting
- `prisma migrate dev` generates SQL migrations automatically
- Prisma Studio for quick data inspection during development
- Built-in connection pooling (important for serverless on Vercel)

**Negative:**

- Prisma Client generates a large bundle — mitigated by edge runtime exclusion
- Complex raw queries (e.g., the running average update) must use `$queryRaw` or `$executeRaw`
- N+1 query risk if `include` is used carelessly — always check query count in development

**Constraints:**

- The running average UPDATE on `professor_courses` must be done as raw SQL inside the transaction — Prisma's update API cannot express the `(old_avg * old_count + new_val) / (old_count + 1)` formula atomically
- Use `prisma.$transaction([...])` (interactive transactions) for the review submission path
- Never use Prisma outside of server-side code (Server Components, API routes, Server Actions)
