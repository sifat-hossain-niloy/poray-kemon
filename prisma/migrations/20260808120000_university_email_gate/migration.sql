-- Add per-university email eligibility rules + capture the user's email
-- domain (NOT the full address) so we can enforce them. The reviews table
-- stays untouched — anonymity contract (see CLAUDE.md) is not affected.

-- 1. Universities: nullable list of accepted email-domain suffixes. Empty
--    array = no restriction, anyone signed in may review.
ALTER TABLE "universities"
    ADD COLUMN "email_domain_suffixes" TEXT[] NOT NULL DEFAULT '{}';

-- 2. Users: capture ONLY the domain portion of the OAuth email (e.g.
--    "cs.du.ac.bd" from "student@cs.du.ac.bd"). The full address never
--    lives in our DB — the domain alone is all the gate needs. Nullable +
--    non-unique — many students share a domain.
ALTER TABLE "users"
    ADD COLUMN "email_domain" VARCHAR(253);

-- 3. Seed the initial gate: Dhaka University requires a *.du.ac.bd address.
--    Additional universities can be gated later via a similar UPDATE or via
--    an admin UI (out of scope here).
UPDATE "universities"
   SET "email_domain_suffixes" = ARRAY['du.ac.bd']
 WHERE "slug" = 'du';
