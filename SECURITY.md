# Security policy

If you've found a vulnerability — please disclose it privately first.

- Open a **private security advisory** on GitHub:
  https://github.com/sifat-hossain-niloy/poray-kemon/security/advisories/new
- Or email the maintainer directly. Don't post details in public issues.

We'll triage within 48 hours. A fix typically lands within 7 days for
moderate issues and 24 hours for anything critical.

## Scope

In scope:

- The application code in this repo
- Authentication / authorization (NextAuth Google OAuth, admin cookie)
- The anonymity contract (`reviews` having no `user_id`, etc.)
- Moderation bypasses
- Rate-limiting bypasses

Out of scope:

- Third-party services we don't operate (Google OAuth, Vercel, etc.)
- Social engineering against maintainers
- Physical attacks on infrastructure

## Hardening checklist (operator-facing)

When deploying:

- [ ] `NEXTAUTH_SECRET` and `ADMIN_SESSION_SECRET` are randomly generated
      (≥ 32 bytes) — never reused from another env
- [ ] `.env.production` is `chmod 600` and owned by the deploy user
- [ ] `docker compose -f docker-compose.prod.yml` is used — never the dev one
- [ ] Postgres port (5432) is NOT published to the host — only the internal
      Docker network reaches it
- [ ] Nginx is the only thing exposed to the public internet (80, 443)
- [ ] TLS certs renew automatically (Certbot container — see runbook)
- [ ] DB backups run on a cron (the runbook has the script)
- [ ] Admin seed password (`changeme123`) has been changed before first launch
- [ ] Google OAuth redirect URI in Google Cloud Console exactly matches
      `https://<domain>/api/auth/callback/google`

## Known design decisions

- **No IP addresses persisted**. Nginx logs IPs short-term to disk for ops
  debugging; nothing in the database does. Honor that boundary.
- **Reports are auth-required** (deviation from SRS) — opening reports to
  anonymous traffic was an abuse vector.
- **Admin session is HMAC-signed**, not JWT, and lives in `pk_admin_session`
  with `sameSite=strict`. It's intentionally separate from the user-facing
  NextAuth session.

If a future change touches any of the above invariants, treat it as a
security-sensitive PR and have a second pair of eyes review it.
