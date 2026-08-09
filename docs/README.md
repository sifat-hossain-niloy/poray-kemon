# Documentation Index — Poray Kemon

---

## Architecture

| Document                                                   | Description                                             |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| [Tech Stack](architecture/tech-stack.md)                   | Final technology choices with rationale                 |
| [System Architecture](architecture/system-architecture.md) | End-to-end system design, request flows, infrastructure |
| [Data Model](architecture/data-model.md)                   | Full table definitions, constraints, indexes            |

### Architecture Decision Records (ADRs)

| ADR                                                               | Decision                                     |
| ----------------------------------------------------------------- | -------------------------------------------- |
| [ADR-001](architecture/adrs/ADR-001-nextjs-app-router.md)         | Next.js 15 App Router as the framework       |
| [ADR-002](architecture/adrs/ADR-002-postgresql-prisma.md)         | PostgreSQL 16 + Prisma ORM                   |
| [ADR-003](architecture/adrs/ADR-003-docker-containerization.md)   | Docker + Docker Compose                      |
| [ADR-004](architecture/adrs/ADR-004-nextauth-google-oauth.md)     | NextAuth.js v5 + Google OAuth only           |
| [ADR-005](architecture/adrs/ADR-005-redis-caching.md)             | Redis 7 for caching and sessions             |
| [ADR-006](architecture/adrs/ADR-006-tailwind-shadcn.md)           | Tailwind CSS 4 + shadcn/ui                   |
| [ADR-007](architecture/adrs/ADR-007-testing-strategy.md)          | Vitest (unit/integration) + Playwright (E2E) |
| [ADR-008](architecture/adrs/ADR-008-pnpm-monorepo.md)             | pnpm as package manager                      |
| [ADR-009](architecture/adrs/ADR-009-per-university-email-gate.md) | Per-university email-domain eligibility gate |

---

## API

| Document                         | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| [OpenAPI Spec](api/openapi.yaml) | Machine-readable REST API contract (OpenAPI 3.1) |

---

## Deployment

| Document                         | Description                                             |
| -------------------------------- | ------------------------------------------------------- |
| [Runbook](deployment/runbook.md) | First-time setup, env vars, Docker ops, CI/CD, rollback |

---

## Development

| Document                                          | Description                                                    |
| ------------------------------------------------- | -------------------------------------------------------------- |
| [Contributing Guide](development/contributing.md) | Branch strategy, commit convention, code standards, PR process |
| [Test Plan](development/test-plan.md)             | Test pyramid, test cases per layer, coverage targets           |

---

## Diagrams

All diagrams use **Mermaid** syntax — render in GitHub, VS Code (with Mermaid extension), or [mermaid.live](https://mermaid.live).

| Diagram                                                  | Description                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| [ER Diagram](diagrams/er-diagram.md)                     | Entity relationships and anonymity contract                               |
| [System Architecture](diagrams/system-architecture.md)   | Infrastructure, request flows, Docker network, CI/CD pipeline             |
| [User Flows](diagrams/user-flows.md)                     | Read path, review submission, helpful voting, reporting, admin moderation |
| [Auth & Anonymity Flow](diagrams/auth-anonymity-flow.md) | OAuth sequence, session lifecycle, what is never stored                   |

---

## Release history

| Document                  | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| [Changelog](CHANGELOG.md) | Product-level notes on what shipped when, newest first |

---

## Source of Truth

The **[SRS](../poray-kemon-srs.md)** (Software Requirements Specification) is the single source of truth for product requirements. All architecture decisions in this `/docs` folder serve the requirements defined there.

If there is ever a conflict between a document here and the SRS, **the SRS wins**.
