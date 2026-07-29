# Operations Reference — Poray Kemon

The "you'll forget this in six months" file. URLs, accounts, one-off setup
steps, and the escape hatches for changing pieces of the stack.

If any URL or invariant below changes, update this file in the same PR.

---

## 1. Admin & Moderator URLs

| Purpose                    | URL (prod)                               | Notes                                              |
| -------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Admin login page           | `https://poraykemon.com/admin/login`     | Username **or** email + password                   |
| Moderator login page       | `https://poraykemon.com/moderator/login` | Same POST endpoint, different landing UI           |
| Admin dashboard            | `/admin`                                 | Moderators land here too; admin-only nav is hidden |
| Change **my** password     | `/admin/settings`                        | Self-service, requires current password            |
| Manage users / promote     | `/admin/users`                           | `super_admin` only                                 |
| Moderation queue           | `/admin/queue`                           |                                                    |
| Reports queue              | `/admin/reports`                         |                                                    |
| University requests queue  | `/admin/university-requests`             |                                                    |
| Universities catalog admin | `/admin/universities`                    |                                                    |

Auth endpoint (both roles): `POST /api/admin/login` — accepts JSON _or_
form-encoded (`login` field = username **or** email, plus `password`).
See [app/api/admin/login/route.ts](../../app/api/admin/login/route.ts).

### There is NO "forgot password" flow

We deliberately have no email-based reset — we don't store admin emails as
recovery addresses, and we don't run outgoing mail. Two ways to recover:

1. **You know the current password** → sign in and use `/admin/settings`
   (POST `/api/admin/me/password`, [route](../../app/api/admin/me/password/route.ts)).
2. **You're locked out** → reset via direct DB update (see §7).

If a proper self-serve reset is added later, it must not introduce an
email column on `admin_users` without ADR-level review.

---

## 2. Admin credentials

### Bootstrap account

Created by [prisma/seed.ts](../../prisma/seed.ts) (line ~1552):

```
username:      admin
role:          super_admin
password:      value of $ADMIN_SEED_PASSWORD at seed time,
               or the string "changeme123" if the env var is unset.
```

The seed does an **upsert** by `username`: on subsequent runs it does **not**
overwrite the password — only the role is forced back to `super_admin`. So
whatever password you set via `/admin/settings` (or via SQL) survives
re-seeding.

### Current production password

**Not stored anywhere Claude can see** — only the bcrypt hash is in
`admin_users.password_hash` on Neon. If you've forgotten it:

- Best: use another `super_admin` account to reset it via `/admin/users`
  (if we add that button; today only self-service exists — see the follow-up
  in §7).
- Fallback: bcrypt-hash a new password and `UPDATE admin_users` directly
  (§7 has the exact SQL).

### Never do

- Commit any password (seed default excluded — that's a placeholder).
- Add an `email` column to `admin_users` as a recovery channel without an ADR.
- Store admin passwords in a shared password manager entry that's visible
  to non-admins.

---

## 3. Hosting & external accounts

| Service          | Purpose                               | How to find it                                                                                                                                                                 |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vercel**       | App hosting, edge, cron               | Project name: `poray-kemon`. `vercel-build` runs `prisma migrate deploy && next build`                                                                                         |
| **Neon**         | Postgres 16, region `ap-south-1`      | Two branches typically: `main` (prod), plus dev branches. `DATABASE_URL` = pooled, `DIRECT_URL` = direct (Prisma needs both)                                                   |
| **Upstash**      | Redis (rate-limits, cache, dedup)     | Global REST-compatible endpoint used via `ioredis` in `lib/redis.ts`                                                                                                           |
| **Google Cloud** | OAuth 2.0 client                      | Console → APIs & Services → Credentials. Redirect URIs must include `https://poraykemon.com/api/auth/callback/google` **and** `http://localhost:3000/api/auth/callback/google` |
| **Spaceship**    | Domain registrar for `poraykemon.com` | DNS is delegated to Vercel — A/CNAME records live in Spaceship, point at Vercel                                                                                                |
| **GitHub**       | Repo + CI (Actions)                   | `sifat-hossain-niloy/poray-kemon` (see origin remote)                                                                                                                          |

Whoever owns each account: keep the login trail in a **separate** password
manager entry per service. If you rotate a Google OAuth secret, remember to
also rotate it in Vercel env vars — nothing else will remind you.

---

## 4. Environment variables

Complete list — everything the app reads is here.

| Name                   | Where     | Purpose                                                                                                                                                                                 |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | required  | Postgres, pooled (Neon PgBouncer). Prisma runtime uses this.                                                                                                                            |
| `DIRECT_URL`           | required  | Postgres, direct. Prisma **migrate** uses this — pooler is incompatible with migrations. Locally set equal to `DATABASE_URL`.                                                           |
| `REDIS_URL`            | required  | Upstash `redis://…` URL                                                                                                                                                                 |
| `NEXTAUTH_SECRET`      | required  | Random 32+ chars. Rotating invalidates all user sessions.                                                                                                                               |
| `NEXTAUTH_URL`         | required  | `https://poraykemon.com` in prod, `http://localhost:3000` local                                                                                                                         |
| `GOOGLE_CLIENT_ID`     | required  | From Google Cloud Console                                                                                                                                                               |
| `GOOGLE_CLIENT_SECRET` | required  | From Google Cloud Console                                                                                                                                                               |
| `ADMIN_SESSION_SECRET` | required  | Random 64+ chars — signs the admin session cookie (Web Crypto HMAC). Rotating logs out every admin & moderator immediately.                                                             |
| `ADMIN_SEED_PASSWORD`  | seed only | Overrides the seed default `changeme123`. Not read at runtime.                                                                                                                          |
| `NEXT_PUBLIC_SITE_URL` | required  | Canonical URL — used for OG tags, sitemap                                                                                                                                               |
| `DATABASE_URL_TEST`    | dev/test  | Points at the isolated test Postgres. **Required** for `pnpm test` (integration setup in [test/global-setup.integration.ts](../../test/global-setup.integration.ts) throws without it). |

### Where they live

- **Production:** Vercel dashboard → Project → Settings → Environment
  Variables. Set on `Production` **and** `Preview` (previews break otherwise).
- **Local:** `.env.local` (never commit — `.env.example` is the template).
- **CI:** GitHub Actions secrets. Only needs the test DB URL, not the prod one.

### Rotating a secret

1. Generate new value.
2. Update Vercel (Production + Preview).
3. Redeploy (Vercel auto-redeploys on env change, but confirm).
4. If it's `NEXTAUTH_SECRET` or `ADMIN_SESSION_SECRET`, note that every
   existing session becomes invalid on the next request.

---

## 5. Database bootstrap requirements (easy to forget)

A fresh Postgres (whether Neon, RDS, or self-hosted) needs three things
before the app works. `docker/postgres/init.sql` does this for local Docker;
on Neon / anything managed, you run it manually **once per database**.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

- `pg_trgm` — powers every fuzzy search (professor typeahead, department
  search, university request dedupe). If it's missing, search silently
  returns nothing and the app appears "broken" without a stacktrace.
- `uuid-ossp` — historically used; may be redundant now, but cheap to enable.

Then run migrations:

```bash
pnpm prisma migrate deploy
pnpm db:seed      # optional, only for a fresh DB
```

On Vercel these are wired into `vercel-build`:

```json
"vercel-build": "prisma migrate deploy && next build"
```

Do not remove `prisma migrate deploy` from that script — Vercel's build
container is the only place migrations run in production.

---

## 6. Anonymity invariants (must survive any refactor / migration)

If you migrate the DB, change the ORM, or restructure the review flow,
these must remain true. There is a CI test that fails the build if any
of them regress — do not disable it.

1. `reviews` table has **no** `user_id` column and **no** relation to `users`.
2. `review_submissions` has `(user_id, professor_course_id)` unique — nothing else that could correlate to a review row.
3. `users` table has **no** `email` column.
4. Review write path inserts both rows in a single transaction, with **no** shared identifier (no shared ULID, no shared timestamp-with-microseconds, nothing correlatable).
5. Public professor display names always go through `obfuscateName()` from [lib/name-obfuscation.ts](../../lib/name-obfuscation.ts). Search results, meta titles, breadcrumbs — all of them.

See [docs/blog/anonymous-by-construction.md](../blog/anonymous-by-construction.md)
for the reasoning.

---

## 7. Break-glass procedures

### 7.1 Reset the admin password directly in the database

Use this only when you're locked out of every admin account.

```bash
# 1. Generate a bcrypt hash (cost 12, matching the app):
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'NEW-PASSWORD-HERE'
```

```sql
-- 2. Paste the hash from step 1 in place of $2a$12$...
UPDATE admin_users
SET password_hash = '$2a$12$REPLACE_ME',
    last_login    = NULL
WHERE username = 'admin';
```

Sign in at `/admin/login` with `admin` + the new password, then immediately
change it via `/admin/settings` (which uses cost-12 bcrypt too, so the hash
in the DB will be regenerated — that's fine).

### 7.2 Promote a user to super_admin

Only one row can have `role = 'super_admin'` (enforced by a partial unique
index). To transfer:

```sql
BEGIN;
UPDATE admin_users SET role = 'admin'      WHERE username = 'admin';
UPDATE admin_users SET role = 'super_admin' WHERE username = 'someone-else';
COMMIT;
```

### 7.3 Verify all seeded departments are marked `verified`

If new departments show "Pending review" on prod, the migration set them to
`unverified`. Quick fix (SQL) plus permanent fix (seed) — the permanent fix
is already in [prisma/seed.ts](../../prisma/seed.ts).

```sql
UPDATE departments
SET status = 'verified'
WHERE university_id IN (
  SELECT id FROM universities
  WHERE short_name IN ('BUET','DU','NSU','BRACU','IUB','AIUB','RUET','CUET',
                       'KUET','SUST','IUT','DIU','EWU','UIU','MIST')
);
```

### 7.4 Force-clear all user sessions

Rotate `NEXTAUTH_SECRET` in Vercel. Every existing session cookie stops
verifying on the next request.

### 7.5 Force-clear all admin sessions

Rotate `ADMIN_SESSION_SECRET` in Vercel. Same effect for `/admin` and
`/moderator`.

---

## 8. Migrating pieces of the stack

Notes for future-you when a piece needs replacing.

### 8.1 Neon → any other Postgres

Requirements the new host must meet:

- Postgres **16+** (schema uses features introduced through 15; 16 is what we test on).
- `pg_trgm` extension available and enabled — see §5.
- Both **pooled** and **direct** connection strings exposed (Prisma needs
  `DATABASE_URL` = pooled, `DIRECT_URL` = direct). If the host has no pooler,
  set both to the same direct URL — this is what local dev does.
- SSL required (`?sslmode=require`) is fine and expected.
- Region: pick one close to Bangladesh (Neon `ap-south-1` = Mumbai gives
  ~40-80ms). Any region works, but ≥ 200ms round-trips make Server Actions
  visibly sluggish.

Migration steps:

```bash
# Dump prod:
pg_dump "$OLD_URL" --no-owner --no-acl --clean --if-exists > dump.sql
# Restore into the new DB (extensions first!):
psql "$NEW_URL" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql "$NEW_URL" < dump.sql
# Sanity-check the count matches:
psql "$NEW_URL" -c 'SELECT COUNT(*) FROM universities;'
```

Then flip `DATABASE_URL` + `DIRECT_URL` in Vercel and redeploy.

### 8.2 Vercel → self-hosted / other host

The app is a plain Next.js 15 App Router build. Anything that runs
`next build` + `next start` works. What you'll need to reproduce:

- `node 20` runtime.
- Serve `.next/` + `public/` with the standard Next.js server.
- Run `prisma migrate deploy` before starting.
- Recreate all env vars from §4.
- Update Google OAuth redirect URIs to include the new origin.

Docker: `docker-compose.prod.yml` in the repo is a working reference.

### 8.3 Upstash → any Redis

Only two things matter:

- Redis 6+ (we use `SET NX EX` — universally supported).
- Reachable from Vercel's serverless functions (public URL with password).

Swap `REDIS_URL` and redeploy. Nothing else to migrate — Redis holds only
ephemeral data (rate-limit counters, dedup markers, cache). Losing all of
it is not a data-loss event.

### 8.4 Prisma → another ORM (Drizzle, Kysely, hand-written SQL)

If you ever do this:

- The schema is defined in [prisma/schema.prisma](../../prisma/schema.prisma).
  Reproduce it exactly — especially the anonymity invariants in §6.
- Migrations live under [prisma/migrations/](../../prisma/migrations/). If
  you cut over, freeze the Prisma migration history first (`prisma migrate
resolve --applied ...` for the last one) so the new tool has a clean base.
- Keep `prisma migrate deploy` running until the last write path is
  converted — the two can coexist as long as one owns migrations at a time.

### 8.5 NextAuth → any other auth

The **only** thing that must survive: user identity is Google `sub` (the
opaque OIDC subject identifier), stored as `users.google_id`. Not email.
Not full name. Any replacement must:

- Accept Google as an OIDC provider.
- Expose the `sub` claim.
- Not persist the `email` claim to our DB.

The admin/moderator login is **not** NextAuth — it's a separate HMAC-signed
cookie in [lib/admin-auth.ts](../../lib/admin-auth.ts). Replacing NextAuth
does not touch admin auth (and vice versa).

---

## 9. Scaling notes

Current sizing assumptions. Revisit when any of them stops holding.

| What              | Current                    | When to revisit                                                                                                              |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Vercel plan       | Hobby                      | > 100 GB-hrs/mo, or need team members                                                                                        |
| Neon plan         | Free tier                  | DB > 500 MB, or > 1 project needed                                                                                           |
| Upstash plan      | Free tier                  | > 10 k commands/day                                                                                                          |
| Reviews / month   | assumed < 1 k              | Aggregates use running-avg (`professor_courses.avg_*`) so this scales fine; the concern is Postgres row count for cold reads |
| Search hits / min | assumed < 60               | If pg_trgm gets slow, add a real search index (Meilisearch / Typesense); do not migrate to Elastic without an ADR            |
| Read traffic      | ISR / cached RSC responses | Add Cloudflare in front if origin egress becomes a cost issue                                                                |

### Aggregate integrity — the one thing not to break

Every review INSERT also updates `professor_courses.avg_*` and `review_count`
in the same transaction using the running-average formula:

```
new_avg = ((old_avg * old_count) + new_value) / (old_count + 1)
```

If you ever recompute these from scratch (`AVG()` over `reviews`), gate it
behind a maintenance script and lock the table — a partial rebuild followed
by concurrent writes will corrupt the averages.

---

## 10. Domain & DNS

- Registrar: **Spaceship**.
- Nameservers: Vercel's (delegated). If you migrate off Vercel, the NS
  records at Spaceship need updating first, then propagate DNS at the new
  host.
- Certificate: automatic via Vercel (Let's Encrypt). Nothing to renew.
- `apex` + `www` both point at Vercel; `www` redirects to apex (Vercel config).

Expiry: check Spaceship every 6 months — a lapsed domain kills the app harder
than anything else in this document. Consider enabling auto-renew there.

---

## 11. If you're reading this cold and need a running instance in 30 minutes

1. `pnpm install`
2. `docker compose up -d` (starts Postgres on 5434, Redis on 6379)
3. Copy `.env.example` → `.env.local`, fill in **`DATABASE_URL`**,
   **`REDIS_URL`**, **`NEXTAUTH_SECRET`** (any 32 chars), **`ADMIN_SESSION_SECRET`**
   (any 64 chars). Google OAuth vars can be left blank if you don't need to
   test sign-in.
4. `pnpm prisma migrate deploy`
5. `pnpm db:seed` — creates the admin bootstrap account (username `admin`,
   password `changeme123` unless you set `ADMIN_SEED_PASSWORD`).
6. `pnpm dev`
7. Sign in at `http://localhost:3000/admin/login` and change the password.

That's the whole loop.
