# Deployment Runbook — Poray Kemon

**Version:** 1.0  
**Last Updated:** June 2026

---

## 1. Prerequisites

### Local Machine

```bash
# Required tools
node --version      # 20.x LTS
pnpm --version      # 9.x
docker --version    # 24+
docker compose version  # 2.x (plugin, not standalone)
git --version       # 2.x

# Install pnpm if missing
npm install -g pnpm@9
```

### Accounts Required

- GitHub account (repo hosting + CI/CD)
- Google Cloud Console account (OAuth credentials)
- Vercel account (Option A deployment) OR VPS provider (Option B)

---

## 2. First-Time Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/poray-kemon.git
cd poray-kemon

# 2. Install dependencies
pnpm install

# 3. Copy env file and fill in values
cp .env.example .env.local

# 4. Start Docker services (PostgreSQL + Redis + Umami)
docker compose up -d

# 5. Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U poraykemon

# 6. Run database migrations
pnpm db:migrate

# 7. Seed initial data (universities + departments + admin user)
pnpm db:seed

# 8. Start development server
pnpm dev
```

Open http://localhost:3000. Admin panel at http://localhost:3000/admin.

---

## 3. Environment Variables

Create `.env.local` from `.env.example`:

```env
# ── Database ──────────────────────────────────────────
DATABASE_URL="postgresql://poraykemon:secret@localhost:5432/poraykemon"

# ── Redis ─────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── NextAuth ──────────────────────────────────────────
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

# ── Google OAuth ──────────────────────────────────────
# Get from: https://console.cloud.google.com/
# Authorized origins: http://localhost:3000
# Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"

# ── Admin ─────────────────────────────────────────────
ADMIN_SESSION_SECRET="<generate with: openssl rand -base64 48>"

# ── App ───────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NODE_ENV="development"
```

**Never commit `.env.local` to git.** It is in `.gitignore`.

---

## 4. Google OAuth Setup

1. Go to https://console.cloud.google.com/
2. Create a new project: "Poray Kemon"
3. Enable the **Google+ API** (or Google Identity)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://poraykemon.com` (production)
7. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://poraykemon.com/api/auth/callback/google`
8. Copy **Client ID** and **Client Secret** to `.env.local`

---

## 5. Database Operations

```bash
# Run all pending migrations
pnpm db:migrate

# Create a new migration after editing prisma/schema.prisma
pnpm db:migrate:create --name add_professor_search_index

# Seed the database
pnpm db:seed

# Reset database (WARNING: deletes all data)
pnpm db:reset

# Open Prisma Studio (GUI for viewing data)
pnpm db:studio

# Connect to PostgreSQL directly
docker compose exec postgres psql -U poraykemon -d poraykemon
```

### Backup & Restore (Production)

```bash
# Backup
docker compose exec postgres pg_dump -U poraykemon poraykemon > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker compose exec -T postgres psql -U poraykemon poraykemon < backup_20260601_120000.sql
```

---

## 6. Docker Operations

### Development

```bash
# Start all services in background
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f postgres

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v

# Rebuild a service
docker compose build nextjs

# Check service health
docker compose ps
```

### Production

```bash
# Pull latest images and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-build

# Build and deploy new app version
docker compose -f docker-compose.prod.yml build nextjs
docker compose -f docker-compose.prod.yml up -d nextjs

# View production logs
docker compose -f docker-compose.prod.yml logs -f nextjs

# Zero-downtime restart (one container at a time)
docker compose -f docker-compose.prod.yml up -d --scale nextjs=2
# wait for health check to pass
docker compose -f docker-compose.prod.yml up -d --scale nextjs=1
```

---

## 7. CI/CD Pipeline

GitHub Actions runs on every push:

### On push to any branch:

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test` (Vitest unit tests)

### On push to `main`:

1. All above checks
2. Build Docker image
3. Run integration tests (against test DB in Docker)
4. Run Playwright E2E tests
5. Push image to GitHub Container Registry
6. Deploy to production (SSH + docker compose pull + up)

### On PR to `main`:

1. All checks
2. Preview deployment (Vercel) or staging environment

---

## 8. Production Deployment (Docker on VPS)

### 8.1 First-time host setup (Ubuntu 22.04 LTS / Debian 12)

```bash
# Install Docker engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker

# App directory
sudo mkdir -p /opt/poraykemon && sudo chown "$USER:$USER" /opt/poraykemon
cd /opt/poraykemon

# Clone — only really needed for the compose file + nginx config; the app
# itself runs from the GHCR image pulled below.
git clone https://github.com/sifat-hossain-niloy/poray-kemon.git .

# Configure production env
cp .env.production.example .env.production
chmod 600 .env.production
$EDITOR .env.production   # fill in real secrets
```

### 8.2 Bootstrap TLS via Certbot (webroot mode)

```bash
# Bring up Postgres + Redis + Next.js first so the webroot is reachable
docker compose -f docker-compose.prod.yml up -d postgres redis nextjs

# Issue certificates
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email admin@poraykemon.com --agree-tos --no-eff-email \
  -d poraykemon.com -d www.poraykemon.com

# Start nginx
docker compose -f docker-compose.prod.yml up -d nginx certbot
```

The `certbot` service runs a tiny shell loop that calls `certbot renew --quiet`
every 12 hours. Renewed certs are picked up by nginx on the next reload —
restart nginx after renewal: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.

### 8.3 Apply migrations + seed

```bash
# Migrations run inside the container so the image has Prisma + the schema
docker compose -f docker-compose.prod.yml exec -T nextjs \
  node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma

# Seed universities + admin user (only on first deploy)
docker compose -f docker-compose.prod.yml exec -T nextjs \
  node prisma/seed.ts || true
```

### 8.4 Automated deployment via CD workflow

`.github/workflows/cd.yml` builds the production image on every push to `main`
(and on any `v*` tag) and pushes it to GHCR. To wire the deploy step:

1. Create a deploy SSH key on the VPS:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/poraykemon_deploy -N ""
   cat ~/.ssh/poraykemon_deploy.pub >> ~/.ssh/authorized_keys
   ```
2. Add repository secrets in GitHub Settings → Secrets and variables → Actions:
   - `SSH_PRIVATE_KEY` — contents of `~/.ssh/poraykemon_deploy` (the private key)
   - `SERVER_HOST` — VPS IP or hostname
   - `SERVER_USER` — SSH user (often `deploy` or `ubuntu`)
3. Add repo variable `DEPLOY_ENABLED=true` (Settings → Variables → Actions)
4. Open `.github/workflows/cd.yml` and flip `if: false` → `if: vars.DEPLOY_ENABLED == 'true'`
   on the `deploy` job, then push.

After this, every push to `main` automatically:

1. Builds the multi-stage Docker image (cached via GHA layer cache)
2. Pushes to `ghcr.io/sifat-hossain-niloy/poray-kemon:sha-<short>` + `latest`
3. SSHes into the VPS and runs `docker compose pull nextjs && up -d nextjs`
4. Applies any pending Prisma migrations

### 8.5 Image tagging strategy

| Tag           | Source               | Use                     |
| ------------- | -------------------- | ----------------------- |
| `latest`      | every push to `main` | day-to-day deploys      |
| `sha-<short>` | every commit         | precise rollbacks       |
| `v1.2.3`      | git tag              | named releases          |
| `main`        | every push to `main` | same as `latest`, alias |

To roll back: `IMAGE_TAG=sha-abc1234 docker compose -f docker-compose.prod.yml up -d nextjs`.

---

## 9. Monitoring & Health Checks

```bash
# Check all services are healthy
docker compose ps

# Application health endpoint
curl http://localhost:3000/api/health

# Database health
docker compose exec postgres pg_isready -U poraykemon

# Redis health
docker compose exec redis redis-cli ping

# View Grafana dashboards
open http://localhost:3002  # (grafana service)

# View Umami analytics
open http://localhost:3001
```

---

## 10. Rollback Procedure

```bash
# On VPS — rollback to previous Docker image
docker compose -f docker-compose.prod.yml stop nextjs
docker tag ghcr.io/your-org/poray-kemon:previous ghcr.io/your-org/poray-kemon:current
docker compose -f docker-compose.prod.yml up -d nextjs

# If a migration caused issues — rollback is manual
# 1. Identify the migration in prisma/migrations/
# 2. Write a reverse migration SQL
# 3. Apply it via psql
# 4. Update prisma/migrations/ accordingly
```

**Important:** Prisma does not support automatic migration rollback. Always test migrations on a copy of production data before applying.

---

## 11. Admin Account Setup

The admin user is created via the seed script. To manually create or change the admin password:

```bash
# Generate bcrypt hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 12).then(console.log)"

# Insert admin user
docker compose exec postgres psql -U poraykemon -d poraykemon -c \
  "INSERT INTO admin_users (username, password_hash) VALUES ('admin', '<hash>') ON CONFLICT DO NOTHING;"
```

Admin panel: `https://poraykemon.com/admin`

---

## 12. Troubleshooting

| Issue                              | Command                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| Port 5432 already in use           | `lsof -i :5432` → stop conflicting service                     |
| Next.js build fails                | `pnpm typecheck` to see TS errors first                        |
| Prisma migration pending           | `pnpm db:migrate`                                              |
| Redis connection refused           | `docker compose restart redis`                                 |
| Google OAuth redirect_uri_mismatch | Check authorized URIs in Google Console match `NEXTAUTH_URL`   |
| Sessions not persisting            | Check `NEXTAUTH_SECRET` is set and matches between deployments |
