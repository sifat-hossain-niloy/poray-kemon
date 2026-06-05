# Auth & Anonymity Flow — Poray Kemon

This document visualizes the core privacy architecture — how login is required but anonymity is preserved.

---

## The Anonymity Contract

```mermaid
flowchart LR
    subgraph PublicRead["Read Path (No Login)"]
        Visitor["Any visitor"]
        ProfPage["Professor page"]
        ReviewCard["Review card\n(no author info)"]

        Visitor --> ProfPage --> ReviewCard
    end

    subgraph WriteAuth["Write Path (Login Required)"]
        GoogleLogin["Google OAuth\n(returns sub + name)"]

        subgraph DB["Database"]
            UsersTable["users table\n— id (UUID)\n— google_id (sub)\n— display_name"]
            ReviewsTable["reviews table\n— id\n— professor_course_id\n— ratings\n— tags\n— text\n❌ NO user_id"]
            SubmissionsTable["review_submissions\n— user_id ✓\n— professor_course_id ✓\n— submitted_at\n❌ NO review_id\n❌ NO review content"]
        end

        GoogleLogin --> UsersTable
        UsersTable --> SubmissionsTable
        ReviewsTable -.->|"No shared key\nNo JOIN possible"| SubmissionsTable
    end
```

---

## What Each Table Knows

```mermaid
graph TD
    subgraph reviewsTable["reviews table"]
        R1["Review #1\nteaching: 4/5\ngrading: 3/5\ntext: 'great teacher...'\n⚠️ NO identity info"]
        R2["Review #2\nteaching: 5/5\n..."]
    end

    subgraph submissionsTable["review_submissions table"]
        S1["user_id: abc-123\nreviewed: CSE 301 by Dr. Rahman\n⚠️ NO review content"]
        S2["user_id: xyz-456\nreviewed: CSE 301 by Dr. Rahman"]
    end

    subgraph link["What an attacker can determine"]
        Q1["Q: Who wrote Review #1?\nA: IMPOSSIBLE — no link"]
        Q2["Q: Did user abc-123 review CSE 301?\nA: YES (but not what they wrote)"]
        Q3["Q: What did user abc-123 write?\nA: IMPOSSIBLE — reviews table has no user_id"]
    end

    R1 -.->|"No foreign key"| S1
    R2 -.->|"No foreign key"| S2
```

---

## Full Authentication Sequence

```mermaid
sequenceDiagram
    actor Student
    participant Browser
    participant NextJS as Next.js Server
    participant Google as Google OAuth
    participant Redis as Redis (Sessions)
    participant Postgres as PostgreSQL

    Note over Student, Postgres: Step 1 — Initiate OAuth

    Student->>Browser: Click "রিভিউ লিখুন"
    Browser->>NextJS: GET /review/new
    NextJS-->>Browser: Redirect to /api/auth/signin (no session)
    Browser-->>Student: Show "সাইন ইন করুন" prompt

    Student->>Browser: Click "Google দিয়ে সাইন ইন করুন"
    Browser->>NextJS: GET /api/auth/signin/google
    NextJS->>Google: Redirect to accounts.google.com\n?client_id=...&state=csrf_token

    Note over Student, Postgres: Step 2 — Google Consent

    Google-->>Student: Google consent screen
    Student->>Google: Approves
    Google->>NextJS: GET /api/auth/callback/google\n?code=AUTH_CODE&state=csrf_token

    Note over Student, Postgres: Step 3 — Token Exchange

    NextJS->>Google: POST /token {code, client_secret}
    Google-->>NextJS: {access_token, id_token}\nid_token contains: sub, name, email, ...

    Note over NextJS: Extract ONLY: sub, name\nDeliberately DROP: email, picture

    Note over Student, Postgres: Step 4 — User Record

    NextJS->>Postgres: INSERT INTO users (google_id=sub, display_name=name)\nON CONFLICT (google_id) DO UPDATE SET last_active=NOW()
    Postgres-->>NextJS: {id: "uuid-1234"}

    Note over Student, Postgres: Step 5 — Session

    NextJS->>Redis: SET session:{random_token}\n{userId: "uuid-1234", displayName: "Sifat"}\nEX 2592000 (30 days)
    NextJS-->>Browser: Set-Cookie: session={random_token}\nhttpOnly; Secure; SameSite=Lax

    Browser-->>Student: Redirected to /review/new\nShows review form

    Note over Student, Postgres: Step 6 — Submit Review

    Student->>Browser: Fills form, clicks submit
    Browser->>NextJS: POST /api/reviews\n{professor_id, course_code, ratings, text, tags}\nCookie: session={random_token}

    NextJS->>Redis: GET session:{random_token}
    Redis-->>NextJS: {userId: "uuid-1234"}

    NextJS->>Postgres: BEGIN TRANSACTION

    NextJS->>Postgres: SELECT FROM review_submissions\nWHERE user_id='uuid-1234'\nAND professor_course_id=42
    Postgres-->>NextJS: 0 rows (not yet reviewed)

    NextJS->>Postgres: INSERT INTO reviews\n(professor_course_id=42, ratings...)\n⚡ NO user_id column
    NextJS->>Postgres: INSERT INTO review_submissions\n(user_id='uuid-1234', professor_course_id=42)
    NextJS->>Postgres: UPDATE professor_courses SET avg_...=running_avg WHERE id=42
    NextJS->>Postgres: COMMIT

    NextJS-->>Browser: 201 {message: "রিভিউ জমা হয়েছে"}
    Browser-->>Student: Success confirmation
```

---

## Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Anonymous: Visit site

    Anonymous --> LoggingIn: Click sign in
    LoggingIn --> Authenticated: OAuth success\n(session cookie set)
    LoggingIn --> Anonymous: OAuth cancelled/failed

    Authenticated --> Authenticated: Any request\n(sliding 30-day TTL reset)
    Authenticated --> Anonymous: Logout\n(session deleted from Redis)
    Authenticated --> Anonymous: 30 days inactivity\n(TTL expires in Redis)
    Authenticated --> Anonymous: Admin revokes session\n(admin deletes Redis key)
```

---

## What is NEVER Stored

| Data                         | Stored?  | Why Not                                                |
| ---------------------------- | -------- | ------------------------------------------------------ |
| Email address                | ❌ Never | Reduces PII; Google sub is sufficient; PDPO compliance |
| IP address                   | ❌ Never | Could identify anonymous reviewers                     |
| Review authorship            | ❌ Never | Core anonymity promise                                 |
| Google profile picture       | ❌ Never | Not needed; reduces PII                                |
| Access token / Refresh token | ❌ Never | Discarded after `sub` extraction                       |
| Review text linked to user   | ❌ Never | Structural impossibility (no shared key)               |
