# ADR-009 · Per-university email-domain eligibility gate

**Status:** Accepted
**Date:** 2026-08-08

## Context

Some universities (starting with Dhaka University) require that only
their own students can submit reviews of their professors. The catalog
still needs to be publicly readable — the restriction is on
**authorship**, not on discovery. A simple "signed in with Google" gate
is not enough; we need proof (however soft) that the reviewer belongs
to the institution.

Google OAuth exposes the reviewer's verified email, whose domain
suffix is a strong-enough signal — a `@cs.du.ac.bd` account only exists
because the university's identity provider issued it. This has been the
default institutional-affiliation proxy for years and is what
comparable rating sites (RateMyProfessors, Uniplaces, etc.) also use.

Constraints:

1. The **anonymity contract** (SRS §4.1, `reviews.user_id` does not
   exist) must not weaken. No cross-table join can ever recover who
   wrote what.
2. We do not want to store the full email address — extra PII, extra
   attack surface, and unnecessary since only the domain is needed.
3. Rules must be per-university and configurable without a code push —
   BUET, NSU, and BRAC may adopt gates later with different suffix
   lists.
4. Enforcement must be server-side. A client-only banner is UX; the
   server is the source of truth.

## Decision

Two schema additions, one library, one endpoint, one client component.

### Schema

`users.email_domain VARCHAR(253)` — the domain portion of the OAuth
email, lowercased, e.g. `cs.du.ac.bd`. Nullable and non-unique. The
local part of the email (`sifat` in `sifat@cs.du.ac.bd`) never touches
the DB.

`universities.email_domain_suffixes TEXT[] NOT NULL DEFAULT '{}'` —
list of accepted suffixes for that university. Empty array = no
restriction.

Match rule (in `lib/eligibility.ts`): a user's domain satisfies a
suffix when they are equal (`du.ac.bd == du.ac.bd`) or when the domain
ends with `.<suffix>` (`cs.du.ac.bd` matches `du.ac.bd`). The dot
boundary rejects `evildu.ac.bd`.

### Flow

1. Google sign-in → `signIn` callback pulls the domain via
   `emailToDomain(profile.email)` and upserts `users.email_domain`.
   The full email address is discarded at the same tick.
2. On the review form, `EligibilityGate` calls `GET /api/me/eligibility?university_id=X`
   whenever the picked university changes. If the check fails, the
   banner renders and the submit button is disabled.
3. `POST /api/reviews` runs the same check server-side after
   moderation and before any writes. On failure returns
   `403 EMAIL_DOMAIN_NOT_ELIGIBLE`.

### Anonymity impact

Zero. `reviews` gains no columns; `review_submissions` still stores
only `(user_id, professor_course_id)`. `email_domain` lives in `users`
alone, where it can be joined with `review_submissions` to identify
that "someone in the CSE department reviewed professor X on course Y"
— but that was already true (users could be joined to submissions by
`user_id` under the existing schema). The domain adds no new signal
that could pierce anonymity of a specific review.

## Alternatives considered

- **Store full email.** Rejected — larger PII footprint, more to leak,
  and the local part is not needed.
- **Institutional SSO per university.** Rejected for v1 — huge
  integration cost, most BD universities do not run SAML/OIDC in a
  form we can consume; Google Workspace domains are already the
  practical stand-in.
- **Manual verification via student ID upload.** Rejected — high
  moderation cost, PII spike, poor UX.
- **Config-file rules instead of DB rows.** Rejected — requires a code
  deploy to onboard a new gated university and cannot be edited by
  admins.

## Consequences

- Any admin can gate a new university by updating one array column:
  `UPDATE universities SET email_domain_suffixes = ARRAY['buet.ac.bd'] WHERE slug='buet'`.
- Users who signed in before the migration have `email_domain = NULL`
  and will fail the gate on gated universities until their next
  sign-in (the `jwt` callback intentionally does not touch the DB per
  request). Advertised as "sign out and sign back in".
- Users on a personal Gmail can still submit reviews for un-gated
  universities. The gate is a per-university constraint, not a
  platform-wide login requirement.

## References

- `lib/eligibility.ts` — the match logic.
- `app/api/reviews/route.ts` — server enforcement.
- `app/api/me/eligibility/route.ts` — client hint endpoint.
- `components/review/EligibilityGate.tsx` — the inline banner.
- `prisma/migrations/20260808120000_university_email_gate/migration.sql` —
  schema change.
- CLAUDE.md — invariant #5 (updated) reflects the domain-only storage.
