# System Architecture — Poray Kemon

**Version:** 1.0  
**Last Updated:** June 2026

---

## 1. Overview

Poray Kemon is a Next.js 15 monolith deployed on Vercel (or a Docker-based VPS), backed by a managed PostgreSQL instance and a Redis cache. It follows a **server-first** architecture — the majority of data fetching happens in React Server Components, with client-side interactivity added only where needed (search typeahead, star rating inputs, helpful voting toggle).

```
┌──────────────────────────────────────────────────────────────────┐
│                         Internet                                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                         ▼
              ┌──────────────────┐
              │   Nginx (Proxy)  │  Rate limiting, SSL termination,
              │   (Docker)       │  static asset caching
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Next.js 15 App  │  App Router, RSC, Server Actions,
              │  (Node.js)       │  API Routes, NextAuth
              └────┬─────────────┘
                   │
        ┌──────────┼────────────────┐
        │          │                │
        ▼          ▼                ▼
┌──────────┐ ┌──────────┐  ┌───────────────┐
│ PostgreSQL│ │  Redis   │  │ Google OAuth  │
│    16    │ │    7     │  │  (external)   │
│ (Docker) │ │ (Docker) │  └───────────────┘
└──────────┘ └──────────┘
        │
        ▼
┌──────────────┐
│    Umami     │  Privacy-first analytics
│  (Docker)    │  No cookies, no PII
└──────────────┘
```

---

## 2. Application Layers

### 2.1 Presentation Layer (Next.js App Router)

| Route type                                     | Rendering strategy     | Rationale                                           |
| ---------------------------------------------- | ---------------------- | --------------------------------------------------- |
| Homepage `/`                                   | ISR (60s revalidation) | Site stats change slowly; search bar is client-side |
| University pages `/universities/[slug]`        | ISR (300s)             | Rarely changes                                      |
| Department pages `/universities/[slug]/[dept]` | ISR (300s)             | Rarely changes                                      |
| Professor profile `/professors/[slug]`         | ISR (60s)              | New reviews appear within 1 min                     |
| Prof+course page `/professors/[slug]/[course]` | ISR (60s)              | Same                                                |
| Review form `/review/new`                      | Dynamic (SSR)          | Requires auth check                                 |
| Search `/search?q=`                            | Dynamic (SSR)          | Query-dependent, can't cache                        |
| Admin `/admin/*`                               | Dynamic (SSR)          | Always fresh, session-gated                         |

### 2.2 API Layer

All write operations go through **Next.js API Routes** at `/api/*`. Reads mostly use RSC data fetching directly via Prisma. API routes handle:

- `POST /api/reviews` — review submission (auth + moderation + transaction; resolves dept → professor → course with find-or-create at each layer)
- `POST /api/reviews/:id/helpful` — toggle helpful vote
- `POST /api/reports` — submit report
- `GET /api/departments/search?q=&university_id=` — scoped typeahead for the review form's department field (FR-DIR-05)
- `GET /api/professors/search?q=&university_id=&department_id=` — scoped typeahead for the review form's professor field
- `GET /api/courses/search?q=&department_id=` — twin-autocomplete that drives both course-code and course-name fields
- `GET /api/universities/search?q=` — scoped typeahead for the review form's university field
- `POST /api/university-requests` — reviewer-facing "please add this uni" ticket (FR-DIR-07); auth-gated, rate-limited
- `GET /api/search?q=` — cross-entity search for the homepage/navbar (universities + departments + professors UNION ALL)
- `POST /api/admin/departments/merge` — transactional merge of duplicate department rows (FR-DIR-06)
- `POST /api/admin/university-requests/[id]/resolve` — approve (creates University row in one tx) or reject (with optional note) a reviewer request (FR-DIR-08)
- `/api/auth/*` — NextAuth endpoints
- `/api/admin/*` — admin actions (session-gated by `middleware.ts`)

### 2.3 Data Layer

```
API Route / Server Action
        │
        ▼
   Zod validation       ← reject malformed input at the boundary
        │
        ▼
   lib/moderation.ts    ← keyword check (hard block or soft flag)
        │
        ▼
   Prisma Client        ← type-safe queries, transactions
        │
        ▼
   PostgreSQL 16        ← ACID transactions, full-text search
```

### 2.4 Caching Layer (Redis)

| Key pattern                  | TTL | Purpose                     |
| ---------------------------- | --- | --------------------------- |
| `stats:site`                 | 60s | Homepage site-wide stats    |
| `prof:${slug}`               | 60s | Professor profile aggregate |
| `search:${hash}`             | 30s | Search result pages         |
| `session:${token}`           | 30d | NextAuth session store      |
| `ratelimit:review:${userId}` | N/A | Submission guard (future)   |

Redis is used for **read-through caching** — not write-through. Cache is invalidated explicitly on writes via `revalidateTag` (Next.js) or `redis.del()`.

---

## 3. Authentication & Session Flow

```
Browser                     Next.js                  Google OAuth
   │                           │                          │
   │── GET /api/auth/signin ──►│                          │
   │                           │── redirect ─────────────►│
   │                           │                          │ user consents
   │                           │◄─── code ───────────────│
   │                           │                          │
   │                           │── exchange code ────────►│
   │                           │◄── { sub, name } ───────│
   │                           │                          │
   │                           │ UPSERT users (google_id, display_name)
   │                           │ (no email stored)
   │                           │
   │◄── Set-Cookie: session ───│
   │    (30-day expiry)        │
```

Session is stored in Redis (via NextAuth adapter). The session object contains only `{ userId, displayName }` — no email, no Google tokens after exchange.

The Google profile's email address is read once inside the `signIn` callback, split at the `@`, and only the **domain suffix** is written to `users.email_domain` (see [ADR-009](adrs/ADR-009-per-university-email-gate.md)). The full address never touches the DB and is not carried into the session.

---

## 4. Review Submission Flow (Critical Path)

```
Client                      Server (API Route)              Database
  │                               │                              │
  │── POST /api/reviews ─────────►│                              │
  │   (requires session cookie)   │                              │
  │                               │ 1. Verify session (401 if missing)
  │                               │ 2. Zod validate body
  │                               │ 3. Check honeypot field
  │                               │ 4. Run moderation check
  │                               │    ├─ hard block → 400
  │                               │    └─ soft flag → mark for queue
  │                               │ 4b. Per-university eligibility gate
  │                               │    ├─ lookup universities.email_domain_suffixes
  │                               │    ├─ if empty: allow (no restriction)
  │                               │    └─ else compare users.email_domain
  │                               │       └─ mismatch → 403 EMAIL_DOMAIN_NOT_ELIGIBLE
  │                               │ 5. Find/create Course record
  │                               │ 6. Find/create ProfessorCourse record
  │                               │ 7. BEGIN TRANSACTION ─────────►│
  │                               │    a. CHECK review_submissions  │
  │                               │       └─ exists → ROLLBACK, 409 │
  │                               │    b. INSERT reviews (no user_id)│
  │                               │    c. INSERT review_submissions  │
  │                               │    d. UPDATE professor_courses   │
  │                               │       (running avg formula)      │
  │                               │    COMMIT ─────────────────────►│
  │                               │ 8. Invalidate Redis cache        │
  │                               │ 9. revalidatePath professor page │
  │◄── 201 { message } ──────────│                              │
```

The transaction in step 7 guarantees:

- A review is ALWAYS paired with a submission record
- The duplicate check and insert are atomic — no race conditions
- Aggregates are always consistent with review count

---

## 5. Database Design Principles

### 5.1 Anonymity by Schema

The anonymity guarantee is structural, not policy-based:

```sql
reviews              review_submissions
────────────         ──────────────────
id                   id
professor_course_id  user_id           ← who
teaching_quality     professor_course_id ← reviewed what
...                  submitted_at
-- NO user_id
```

There is no foreign key from `reviews` to `review_submissions`. No JOIN can ever link a specific review to a specific user.

### 5.2 Denormalized Aggregates

`professor_courses` stores running averages to avoid expensive `AVG()` scans:

```sql
-- On each INSERT into reviews:
UPDATE professor_courses SET
  avg_teaching_quality = ((avg_teaching_quality * review_count) + $new) / (review_count + 1),
  review_count = review_count + 1
WHERE id = $professor_course_id;
```

This scales to millions of reviews with O(1) update cost.

### 5.3 Search Strategy

PostgreSQL native full-text search using `pg_trgm` (trigram similarity) and `tsvector`:

```sql
-- professors table:
ALTER TABLE professors ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', name_en || ' ' || COALESCE(name_bn, ''))
  ) STORED;

CREATE INDEX professors_search_idx ON professors USING GIN(search_vector);

-- Fuzzy search query:
SELECT * FROM professors
WHERE search_vector @@ plainto_tsquery('simple', $query)
   OR name_en ILIKE '%' || $query || '%'
ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $query)) DESC;
```

---

## 6. Infrastructure

### 6.1 Local Development (Docker Compose)

```
docker-compose.yml
├── postgres     PostgreSQL 16 on :5432
├── redis        Redis 7 on :6379
├── umami        Umami analytics on :3001
└── nginx        Reverse proxy on :80 (proxies to Next.js on :3000)

Next.js runs on host (pnpm dev) for HMR. DB services run in Docker.
```

### 6.2 Production Options

**Option A — Vercel + Managed services (recommended for launch)**

```
Vercel              → Next.js app (serverless functions)
Supabase            → PostgreSQL 16
Upstash             → Redis (serverless Redis)
Vercel Analytics    → replaced by self-hosted Umami
```

**Option B — Full Docker on VPS (full control, more learning)**

```
VPS (DigitalOcean / Hetzner)
├── docker-compose.prod.yml
│   ├── nginx (SSL via Certbot)
│   ├── nextjs (multi-stage Docker image)
│   ├── postgres (with persistent volume)
│   ├── redis (with persistence)
│   └── umami
└── GitHub Actions → SSH deploy on push to main
```

Option B is recommended for learning Docker in production.

---

## 7. Observability Stack

```
Next.js app
    │ OpenTelemetry SDK
    ▼
OTEL Collector (Docker)
    ├──► Prometheus ──► Grafana dashboards
    └──► Loki        ──► Grafana log explorer
```

Key metrics to track:

- Review submission latency (P50, P95, P99)
- DB query time (Prisma instrumented)
- Redis hit rate
- Error rate by route
- Auth success/failure rate

---

## 8. Security Model

| Threat                        | Mitigation                                                   |
| ----------------------------- | ------------------------------------------------------------ |
| Review spam / mass submission | One-review-per-account per professor+course (DB constraint)  |
| Bot submissions               | Google OAuth required + honeypot field                       |
| XSS                           | React escapes by default; Zod strips unexpected fields       |
| SQL injection                 | Prisma parameterized queries — no raw SQL in app code        |
| CSRF                          | NextAuth CSRF token on all POST endpoints                    |
| Admin panel takeover          | Session-based auth, bcrypt passwords, no public registration |
| PII exposure                  | No email stored; `reviews` has no `user_id`; no IP logged    |
| DDoS                          | Nginx rate limiting + Vercel/CDN edge protection             |

---

## 9. Scalability Path

| Milestone          | Bottleneck             | Solution                                               |
| ------------------ | ---------------------- | ------------------------------------------------------ |
| 0–10k reviews      | None                   | Current architecture                                   |
| 10k–100k reviews   | Search query time      | Add GIN index on tsvector (already planned)            |
| 100k–1M reviews    | Professor page load    | ISR + Redis cache (already planned)                    |
| 1M+ reviews        | DB write throughput    | Read replica for search; Prisma read replica support   |
| High traffic burst | Serverless cold starts | Vercel edge functions for search; CDN for static pages |
