# System Architecture Diagram — Poray Kemon

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["Client (Browser)"]
        Browser["Browser\n(React + Tailwind)"]
    end

    subgraph Edge["Edge / CDN"]
        CDN["Vercel Edge / CDN\nStatic assets, ISR pages"]
    end

    subgraph AppServer["Application Server (Docker)"]
        Nginx["Nginx\n:80/:443\nSSL termination\nRate limiting"]
        NextJS["Next.js 15\n:3000\nApp Router + API Routes\nServer Components"]
    end

    subgraph DataLayer["Data Layer (Docker)"]
        Postgres["PostgreSQL 16\n:5432\nReviews, Professors\nAggregates"]
        Redis["Redis 7\n:6379\nSessions + Cache"]
    end

    subgraph Observability["Observability (Docker)"]
        Umami["Umami\n:3001\nPrivacy-first analytics"]
        Prometheus["Prometheus\n:9090\nMetrics collection"]
        Grafana["Grafana\n:3002\nDashboards"]
    end

    subgraph External["External Services"]
        Google["Google OAuth\nIdentity provider"]
    end

    Browser -->|HTTPS| CDN
    CDN -->|Cache miss| Nginx
    Nginx -->|Proxy| NextJS
    NextJS -->|Prisma ORM| Postgres
    NextJS -->|ioredis| Redis
    NextJS -->|OAuth exchange| Google
    Browser -->|Pageview beacon| Umami
    NextJS -->|OTEL metrics| Prometheus
    Prometheus -->|Data source| Grafana
```

---

## Request Flow by Route Type

```mermaid
flowchart TD
    Request["Incoming Request"]

    Request --> IsStatic{Is it a\nstatic/ISR page?}

    IsStatic -->|Yes - CDN hit| CacheHit["Return cached HTML\n< 50ms"]
    IsStatic -->|Yes - cache miss| ISRGenerate["Next.js generates page\nfetch from PostgreSQL\nstore in CDN\n< 500ms"]
    IsStatic -->|No - dynamic| Dynamic["Next.js SSR\nfetch from PostgreSQL\nor Redis cache"]

    Dynamic --> IsAuth{Requires\nauthentication?}
    IsAuth -->|No| ServePublic["Serve response"]
    IsAuth -->|Yes - has session| ServeAuth["Serve authenticated response"]
    IsAuth -->|Yes - no session| Return401["Return 401\nor redirect to login"]
```

---

## Review Submission Transaction

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextAPI as Next.js API Route
    participant Redis
    participant Postgres

    User->>Browser: Fill review form + click submit
    Browser->>NextAPI: POST /api/reviews (with session cookie)

    NextAPI->>Redis: Validate session token
    Redis-->>NextAPI: { userId, displayName }

    Note over NextAPI: Zod validate body
    Note over NextAPI: Check honeypot field
    Note over NextAPI: Run moderation check

    NextAPI->>Postgres: BEGIN TRANSACTION

    NextAPI->>Postgres: SELECT FROM review_submissions\nWHERE user_id=$1 AND professor_course_id=$2
    Postgres-->>NextAPI: Result

    alt Already reviewed
        NextAPI->>Postgres: ROLLBACK
        NextAPI-->>Browser: 409 "আপনি ইতিমধ্যে রিভিউ দিয়েছেন"
    else First review
        NextAPI->>Postgres: INSERT INTO reviews\n(NO user_id)
        NextAPI->>Postgres: INSERT INTO review_submissions\n(user_id, professor_course_id)
        NextAPI->>Postgres: UPDATE professor_courses\n(running average formula)
        NextAPI->>Postgres: COMMIT

        NextAPI->>Redis: DEL prof:{slug}
        Note over NextAPI: revalidatePath professor page

        NextAPI-->>Browser: 201 "রিভিউ জমা হয়েছে"
    end
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextAuth as NextAuth.js
    participant Google as Google OAuth
    participant Postgres
    participant Redis

    User->>Browser: Click "Google দিয়ে সাইন ইন করুন"
    Browser->>NextAuth: GET /api/auth/signin/google

    NextAuth->>Google: Redirect with client_id + state
    Google-->>User: Google consent screen
    User->>Google: Grants permission

    Google->>NextAuth: GET /api/auth/callback/google?code=...
    NextAuth->>Google: Exchange code for tokens
    Google-->>NextAuth: { sub, name, ... }

    Note over NextAuth: Extract only: sub, name\nDrop email intentionally

    NextAuth->>Postgres: UPSERT users\n(google_id=sub, display_name=name)
    Postgres-->>NextAuth: { id (UUID) }

    NextAuth->>Redis: SET session:{token} { userId, displayName } EX 2592000
    NextAuth-->>Browser: Set-Cookie: session={token}\n(httpOnly, secure, sameSite=lax)

    Browser-->>User: Signed in as {displayName}
```

---

## Docker Compose Network

```mermaid
graph LR
    subgraph DockerNetwork["Docker Network: poraykemon_net"]
        Nginx["nginx\n:80, :443"]
        NextJS["nextjs\n:3000"]
        Postgres["postgres\n:5432"]
        Redis["redis\n:6379"]
        Umami["umami\n:3000 internal"]
        Prometheus["prometheus\n:9090"]
        Grafana["grafana\n:3000 internal"]
    end

    subgraph Host["Host Machine"]
        HostPorts["Exposed ports:\n80, 443 (nginx)\n5432 (dev only)\n6379 (dev only)\n3001 (umami)\n3002 (grafana)"]
    end

    Nginx --> NextJS
    Nginx --> Umami
    NextJS --> Postgres
    NextJS --> Redis
    Prometheus --> NextJS
    Grafana --> Prometheus

    Host <-->|port mapping| HostPorts
```

---

## CI/CD Pipeline

```mermaid
flowchart LR
    Push["git push\nfeature branch"] --> CI["GitHub Actions\nCI Pipeline"]

    CI --> TypeCheck["pnpm typecheck\nTypeScript"]
    CI --> Lint["pnpm lint\nESLint + Prettier"]
    CI --> Unit["pnpm test:unit\nVitest"]

    TypeCheck --> Gate1{All pass?}
    Lint --> Gate1
    Unit --> Gate1

    Gate1 -->|No| Fail["❌ PR blocked"]
    Gate1 -->|Yes| Integration["pnpm test:integration\n(Docker test DB)"]

    Integration --> Gate2{Pass?}
    Gate2 -->|No| Fail
    Gate2 -->|Yes| PRReady["✅ PR ready to merge"]

    PRReady -->|Merge to main| Build["Docker build\nmulti-stage"]
    Build --> E2E["Playwright E2E\n(production build)"]
    E2E --> Gate3{Pass?}
    Gate3 -->|No| Rollback["🔄 Rollback\nnotify team"]
    Gate3 -->|Yes| Deploy["🚀 Deploy\ndocker compose up -d"]
```
