# Vercel + Neon + Upstash — production deployment

**Version:** 1.0
**Last Updated:** July 2026
**Target audience:** Solo maintainer, non-commercial deployment, 50 concurrent max.

This is the "just works" hosting path for Poray Kemon. Zero servers to patch, Mumbai edge for Bangladesh latency, all three services offer generous free tiers that suit this app's scale for the foreseeable future.

The alternative path (single VPS running `docker-compose.prod.yml`) is still fully supported and lives in [`runbook.md`](./runbook.md). Keep that available as an escape hatch.

---

## Stack

| Layer           | Service                                        | Cost    | Notes                                                                           |
| --------------- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| Next.js runtime | [Vercel Hobby](https://vercel.com/pricing)     | Free    | 100 GB bandwidth/mo, edge cached. Region pinned to `bom1` (Mumbai).             |
| PostgreSQL      | [Neon](https://neon.tech) free tier            | Free    | 0.5 GB storage (fits ~2M reviews), auto-suspends when idle. PITR up to 7 days.  |
| Redis           | [Upstash Redis](https://upstash.com) free tier | Free    | 500 k commands/mo, 256 MB. Optional — the app falls back to no-cache if unset.  |
| Domain          | Namecheap / Cloudflare / BTCL                  | ~$10/yr | `.com` from Namecheap or `.com.bd` via BTCL. Point DNS at Vercel's nameservers. |
| Monitoring      | UptimeRobot free tier                          | Free    | Ping `/api/health` every 5 min.                                                 |

**Total recurring cost:** ~$10/yr (domain only).

**License compliance:** Vercel Hobby's ToS forbids commercial use. This project's SRS commits to "no paid features" (§1.4) which qualifies. If you ever monetize (donation button, sponsored content, ads), move to Vercel Pro ($20/user/mo) or switch to the VPS path.

---

## One-time setup (~30 minutes)

### 1. Neon Postgres

1. Sign up at https://neon.tech with your GitHub account (free tier, no card required).
2. **Create a project**:
   - Name: `poraykemon`
   - Region: **AWS Asia Pacific (Mumbai) — ap-south-1** (lowest latency to BD)
   - Postgres version: **16** (matches local dev)
3. On the project dashboard → **Connection Details**:
   - Copy the **pooled** connection string (labelled "Pooled connection" or ending in `-pooler.ap-south-1.aws.neon.tech`). This is your `DATABASE_URL`.
   - Copy the **direct** connection string (no `-pooler` in the hostname). This is your `DIRECT_URL`. Prisma migrations must use this one.
4. Under **Settings → Roles**: rotate the password if the initial one was ever shown on-screen elsewhere.

### 2. Upstash Redis (optional but recommended)

1. Sign up at https://upstash.com with GitHub.
2. **Create Database**:
   - Name: `poraykemon`
   - Type: **Regional**
   - Region: **AWS ap-south-1 (Mumbai)** to match Neon.
   - Eviction: **allkeys-lru** (cache-friendly).
3. On the database dashboard → copy the **TLS URL** (starts with `rediss://…`). This is your `REDIS_URL`.

Skip this section entirely if you want to defer Redis — the app will run cache-less until you provide a URL later.

### 3. Google OAuth (production credentials)

1. Go to https://console.cloud.google.com/ → your existing OAuth project.
2. **Credentials → OAuth 2.0 Client ID** → edit the existing client (or create a new one for production if you want separation).
3. Add to **Authorized JavaScript origins**:
   - `https://poraykemon.com`
   - `https://www.poraykemon.com`
4. Add to **Authorized redirect URIs**:
   - `https://poraykemon.com/api/auth/callback/google`
   - `https://www.poraykemon.com/api/auth/callback/google`
5. Copy the client ID and client secret — you'll paste these into Vercel next.

### 4. Vercel deploy

1. Sign up at https://vercel.com with your GitHub account.
2. **Import Project** → select the `poray-kemon` repo.
3. Framework preset auto-detects as **Next.js**. Leave the defaults — `vercel.json` in the repo pins `buildCommand: pnpm vercel-build` and `regions: [bom1]`.
4. **Environment Variables** — add these for the **Production** environment (also add to Preview + Development if you want previews to work against a Neon branch):

   | Key                    | Value                                               |
   | ---------------------- | --------------------------------------------------- |
   | `DATABASE_URL`         | Neon pooled connection string                       |
   | `DIRECT_URL`           | Neon direct connection string                       |
   | `NEXTAUTH_SECRET`      | `openssl rand -base64 32`                           |
   | `NEXTAUTH_URL`         | `https://poraykemon.com`                            |
   | `GOOGLE_CLIENT_ID`     | from step 3                                         |
   | `GOOGLE_CLIENT_SECRET` | from step 3                                         |
   | `ADMIN_SESSION_SECRET` | `openssl rand -base64 48`                           |
   | `NEXT_PUBLIC_SITE_URL` | `https://poraykemon.com`                            |
   | `REDIS_URL`            | _(optional)_ Upstash `rediss://…` URL               |
   | `ADMIN_SEED_PASSWORD`  | strong password — used once to seed the first admin |

5. Click **Deploy**. Vercel runs `pnpm install`, `prisma generate` (via `postinstall`), then `pnpm vercel-build` which runs `prisma migrate deploy` against Neon before building Next.js. First deploy takes ~3-5 minutes.

### 5. First-time seed

The seed script (`prisma/seed.ts`) is NOT auto-run on Vercel deploys — it's a one-time bootstrap. Run it locally against the Neon database:

```bash
# Point local dev at prod Neon temporarily
export DATABASE_URL="<neon pooled>"
export DIRECT_URL="<neon direct>"

pnpm db:seed
```

You should see:

```
🌱 Seeding database...
  ✓ BUET — 7 departments
  ...
  ✓ Universities — 161 added, 0 updated, 0 stale pruned, 0 kept
  ✓ Admin user created (username: admin)
✅ Seed complete — 161 universities, 60 departments
```

**Change the admin password immediately** via the admin login flow.

### 6. Domain

1. **Buy** the domain — recommended: Namecheap or Cloudflare Registrar (~$10/yr for `.com`), or BTCL for `.com.bd`.
2. **In Vercel** → project settings → **Domains** → add `poraykemon.com` (and `www.poraykemon.com` as a redirect).
3. Vercel shows you the DNS records to add (usually an A record `@ → 76.76.21.21` and a CNAME `www → cname.vercel-dns.com`). Add them at your registrar.
4. DNS propagates in a few minutes. TLS certificate is auto-issued by Vercel.
5. Update `NEXTAUTH_URL` in Vercel's env vars to match the final domain (redeploy).

### 7. Uptime monitor

1. Sign up at https://uptimerobot.com (free tier: 50 monitors, 5-min intervals).
2. Add a monitor:
   - Type: **HTTPS**
   - URL: `https://poraykemon.com/api/health`
   - Interval: **5 minutes**
   - Alert contact: your email
3. That's it.

---

## Continuous deployment

Vercel auto-deploys every push to `main`. No manual step needed.

- **Preview deployments**: every PR gets its own `https://poraykemon-git-<branch>-<team>.vercel.app` URL. If you enable **Neon → Branching**, each PR can also get its own database branch.
- **Rollback**: Vercel dashboard → **Deployments** → click any prior successful deploy → "Promote to Production." Instant.
- **Migrations**: run as part of `vercel-build`. If a migration fails, the deploy fails, production stays on the previous version.

---

## When to worry

### You've hit a limit

| Signal                                            | Trigger                           | Fix                                                                                                          |
| ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Vercel: bandwidth alert at 80 GB                  | Getting close to 100 GB/mo        | Cloudflare in front to absorb bandwidth (free), or move to Vercel Pro.                                       |
| Neon: storage alert at 400 MB                     | Close to 512 MB free-tier ceiling | Delete stale rejected/approved university requests; delete old moderation logs; upgrade to Neon $19/mo tier. |
| Upstash: 400 k commands / mo                      | Approaching 500 k limit           | Increase cache TTLs in `lib/redis.ts`; upgrade to Upstash paid ($0.20 per 100 k commands).                   |
| Neon: compute time exhausted (191 hrs/mo on free) | Very-high traffic month           | Neon $19/mo tier removes the compute cap.                                                                    |

### Something else

- **Deploy fails with `P1001` / `P3009`** — usually a migration issue. Check the build log; connect to Neon directly with `psql` if needed.
- **Google OAuth `redirect_uri_mismatch`** — the Vercel-assigned domain doesn't match `NEXTAUTH_URL`. Update the OAuth client and `NEXTAUTH_URL` to your real domain.
- **Cold-start latency on `/api/reviews`** — Prisma cold starts on Vercel serverless are ~500 ms. Acceptable at 50 concurrent; if it bites, move heavy endpoints to Edge Runtime or precompute more.

---

## Escape hatch — moving to a VPS later

Everything you built here is portable. If you ever need to leave Vercel:

1. Provision a VPS (see `runbook.md` §8).
2. Copy `.env.production` from Vercel's env-var dump.
3. `git clone` + `docker compose -f docker-compose.prod.yml up -d`.
4. Point DNS at the VPS IP.

Nothing about the Vercel deployment locks you in.
