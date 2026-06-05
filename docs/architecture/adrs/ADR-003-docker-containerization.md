# ADR-003: Docker + Docker Compose for Containerization

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

We need a reproducible local development environment and a path to self-hosted production deployment. The team wants to learn Docker as part of this project. We also need to run multiple services (PostgreSQL, Redis, Umami, Nginx) with consistent configuration across environments.

---

## Decision

Use **Docker** for all services and **Docker Compose** for orchestration. Next.js runs on the host in development (for HMR) and in a Docker container in production.

---

## Rationale

### Why Docker

- **Reproducibility** — every developer gets the same PostgreSQL version, the same Redis configuration, the same Nginx setup
- **Production parity** — local and production environments are identical (avoid "works on my machine")
- **Service isolation** — PostgreSQL, Redis, Umami each run in their own container with defined resource limits
- **Learning value** — Docker is a fundamental modern infrastructure skill; using it here provides hands-on experience

### Development vs Production split

In **development**, Next.js runs on the host (`pnpm dev`) to preserve Hot Module Replacement. All backing services (DB, Redis) run in Docker. This is the standard pattern — Docker inside Docker for HMR is painful.

In **production**, Next.js is also containerized using a multi-stage build to minimize image size:

```
Stage 1 (builder): node:20-alpine → pnpm install → pnpm build
Stage 2 (runner):  node:20-alpine → copy .next/standalone → ~150MB image
```

### Why Docker Compose over Kubernetes

Kubernetes is overkill for MVP. Docker Compose provides:

- Simple `docker compose up -d` / `docker compose down`
- Environment variable injection via `.env`
- Named volumes for data persistence
- Health checks and dependency ordering (`depends_on`)

Kubernetes is the right path if the platform needs to scale to multiple VPS nodes. That's a Phase 3 concern.

---

## Service Map

| Service    | Image                                            | Port    | Data                     |
| ---------- | ------------------------------------------------ | ------- | ------------------------ |
| `postgres` | `postgres:16-alpine`                             | 5432    | Named volume `pgdata`    |
| `redis`    | `redis:7-alpine`                                 | 6379    | Named volume `redisdata` |
| `umami`    | `ghcr.io/umami-software/umami:postgresql-latest` | 3001    | Uses same postgres       |
| `nginx`    | `nginx:alpine`                                   | 80, 443 | Config bind mount        |
| `nextjs`   | Custom multi-stage                               | 3000    | Stateless                |

---

## Consequences

**Positive:**

- New developers run `docker compose up -d` and are ready to code in minutes
- Production deployment is `docker compose -f docker-compose.prod.yml pull && docker compose up -d`
- Each service can be scaled, replaced, or upgraded independently
- Health checks prevent app startup before DB is ready

**Negative:**

- Docker Desktop required on macOS/Windows — adds setup step
- Volume management requires care (never `docker compose down -v` in production)
- Multi-stage builds add CI build time (~2-3 minutes)

**Constraints:**

- Always use `alpine`-based images to minimize attack surface and image size
- Never store secrets in Dockerfiles or docker-compose.yml — use `.env` files excluded from git
- Production `docker-compose.prod.yml` must use `restart: unless-stopped` for all services
- Database backups must be handled outside Docker (cron + `pg_dump` to S3 or similar)
