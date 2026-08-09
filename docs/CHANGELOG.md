# Changelog

Product-level notes on what shipped when. Kept in reverse-chronological
order. The individual PRs on GitHub are the authoritative record — this
file is a readable index of what actually changed and why.

Older releases (pre-2026-07-30 — the initial catalog crowdsourcing work,
staff-roles/login split, and Vercel prep) are described in the earlier
docs and in the SRS revision history. This changelog starts where those
end.

---

## 2026-08-09 · DU faculty directory seeded

- **[data/du-directory.json](../data/du-directory.json)** — 19 DU
  departments across 7 faculties, ~597 professors. Scraped from
  `du.ac.bd/body/FacultyMembers/<code>`. Two known gaps recorded in the
  file's `incomplete[]` array (Pharmacy roster incomplete on the central
  directory; Applied Statistics is not a distinct department in DU's
  official list).
- **[prisma/migrations/20260809120000_seed_du_directory/migration.sql](../prisma/migrations/20260809120000_seed_du_directory/migration.sql)** —
  the same data lifted into a proper Prisma migration so Vercel's
  `prisma migrate deploy` populates Neon on the next deploy.
- **[scripts/generate-du-seed-migration.ts](../scripts/generate-du-seed-migration.ts)** —
  regenerates the migration.sql from the JSON. Do not hand-edit the
  migration file; re-run the generator if the source directory changes.
- Idempotent: department inserts use `WHERE NOT EXISTS` covering both
  the `(uni_id, slug)` and `(uni_id, short_name)` unique keys. Professor
  inserts use `WHERE NOT EXISTS` on `(uni_id, dept_id, lower(name_en))`
  plus `ON CONFLICT (slug) DO NOTHING`.

## 2026-08-08 · Per-university email-domain eligibility gate

Some universities (starting with **Dhaka University**) only accept
reviews from students of that university. Enforced via an email-domain
suffix list on the university row + a captured domain suffix on the user
row. See [ADR-009](architecture/adrs/ADR-009-per-university-email-gate.md).

- Schema (migration `20260808120000_university_email_gate`):
  - `users.email_domain VARCHAR(253)` — only the part after the `@`,
    lowercased. `sifat@cs.du.ac.bd` → `cs.du.ac.bd`. The local part
    never touches the DB.
  - `universities.email_domain_suffixes TEXT[] NOT NULL DEFAULT '{}'` —
    accepted suffixes. Empty array = no restriction.
  - DU seeded with `ARRAY['du.ac.bd']`.
- `lib/eligibility.ts` — pure suffix-match logic, unit-testable, no DB.
- Server-side enforcement in `POST /api/reviews` after moderation and
  before any writes (returns `403 EMAIL_DOMAIN_NOT_ELIGIBLE`).
- Client-side hint in `components/review/EligibilityGate.tsx` (banner +
  disabled submit) via the read-only `GET /api/me/eligibility` endpoint.
- `lib/auth.ts` captures the domain on every sign-in.

## 2026-08-08 · User-added departments are trusted

Auto-created departments were previously stamped `unverified` and hidden
behind the merge queue until an admin approved them. Students adding a
missing department during a review is normal, not a moderation concern.
They're now created with `status='verified'` and appear in search and
the department listing immediately. Admins can still merge duplicates
through the existing merge tool.

## 2026-08-08 · Review form: course fields unlocked for new departments

The course-code and course-name inputs were `disabled` while a new
(unsaved) department was being added, blocking submission entirely. Now
they accept typed input; autocomplete stays gated on a real department
ID (nothing to scope against yet), and `POST /api/reviews` still
find-or-creates the course row.

## 2026-08-08 · Review form: typeahead dropdowns escape the card

shadcn's `<Card>` ships with `overflow-hidden`, which clipped absolute
positioned typeahead dropdowns (Course Code, Course Name, Department,
Professor) at the card border. The Section wrapper in the review form
now overrides `overflow-visible`, and the dropdowns' own scroll region
handles long lists.

## 2026-08-03 · OG images (Open Graph + Twitter cards)

Sharing a poraykemon.com link in Messenger, WhatsApp, iMessage, X, or
Slack now generates a rich preview card. Next.js file-based OG image
handlers at each page-type root; Vercel invokes them on demand.

- `app/opengraph-image.tsx` — default site card.
- `app/professors/[publicId]/opengraph-image.tsx` — name + dept + uni +
  rating + review count.
- `app/universities/[slug]/opengraph-image.tsx` — short name + full name
  - counts.
- `app/universities/[slug]/departments/[deptSlug]/opengraph-image.tsx`
  — dept + uni + counts.
- `app/blog/[slug]/opengraph-image.tsx` — post title.
- `app/twitter-image.tsx` — matches the default site card.
- Design matches the live site: white background, near-black rounded
  `প` tile, Hind Siliguri (Bengali + Latin) via Fontsource. Shared
  branding in `lib/og/branding.tsx`.
- All page-type meta bumped from `twitter:summary` to
  `twitter:summary_large_image`.

## 2026-08-03 · Next 16 upgrade: middleware → proxy

`middleware.ts` renamed to `proxy.ts` and its exported function from
`middleware` → `proxy` (Next 16 file convention). No behaviour change.

## 2026-08-02 · Homepage: top-rated professors leaderboard

`components/homepage/TopProfessorsLeaderboard.tsx` — top 10 professors
by `overall_score`, min 3 reviews to qualify, cached in Redis (5 min
TTL). Renders `null` when the list is empty (fresh install).

## 2026-08-02 · Moderation aggregate rollback

Hidden and deleted reviews used to keep contributing to `avg_*` and
`overall_score` on `professor_courses`. The reverse of the running-average
formula now runs whenever a review transitions between counted
(live/soft_flagged) and not-counted (flagged_hidden/deleted) states.
Helpers live in `lib/aggregation-mutations.ts` and are called from
every moderation code path: admin hide/delete/approve, report auto-hide,
and report resolve-remove.

## 2026-08-02 · Share buttons

`components/share/ShareButton.tsx` — Web Share API on mobile, dropdown
fallback everywhere else (Facebook, WhatsApp, Messenger, X, copy link).
Wired into professor pages (labeled variant in header) and each review
card (icon-only). Each review card gets `id="r-<id>" scroll-mt-20` so
a shared link deep-scrolls to it.

## 2026-08-02 · Admin security regression fix

After the `/en/`/`/bn/` locale URL split, admin routes accessible via
`/en/admin/*` were bypassing the admin-auth branch of the proxy.
`proxy.ts` now strips the locale prefix on non-localized paths (a 307
that re-enters the proxy) so admin auth runs. Also broadened
`isProtectedAdminPath` to explicitly cover `/moderator/*`.

## 2026-08-02 · SEO polish

- Full sitemap.xml with locale alternates (`xhtml:link` per URL).
- `BreadcrumbList` JSON-LD on university, department, and professor
  pages via `lib/seo/breadcrumbs.ts`.
- `ItemList` JSON-LD on `/universities` covering the first 100
  universities.
- Richer meta + intro copy on `/universities` (title, description,
  content).
- FAQ page at `/faq` with `FAQPage` JSON-LD (bilingual).
- Two seed blog posts at `/blog/*` with `BlogPosting` JSON-LD.

## 2026-07-31 · Path-based locale routing + hreflang

URLs now split by locale: `/en/professors/...`, `/bn/professors/...`.
The proxy rewrites `/en/foo` → `/foo` with an `x-locale` header;
`getLocale()` reads that header first, cookie fallback.
`localeAlternates()` in `lib/i18n/alternates.ts` emits
`alternates.languages` for every page (`en` / `bn` / `x-default`).
Sitemap emits both variants per URL.

## 2026-07-29 (pre-changelog)

Earlier work covered in the SRS and prior blog posts:

- Staff role separation (admin / moderator) + separate login pages.
- Anonymous-by-construction blog post explaining the anonymity contract.
- Deployment runbook (`docs/deployment/runbook.md`) — URLs, env vars,
  break-glass, migration escape hatches.
- Homepage anonymity disclaimer + navbar polish.
