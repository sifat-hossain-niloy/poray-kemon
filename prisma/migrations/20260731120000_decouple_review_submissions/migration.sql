-- Anonymity hardening: close the two correlation vectors between
-- `reviews` and `review_submissions` that existed by accident.
--
-- Problem 1 — Sequential-id lockstep:
--   Both tables carried an auto-increment `id`, and rows were always
--   written 1:1 inside a single transaction. So `reviews.id = N` and
--   `review_submissions.id = N` referred to the same submission event.
--   Sorting either table by id lined them up perfectly.
--
-- Problem 2 — Shared transaction timestamp:
--   Both tables had `submitted_at DEFAULT now()`. Postgres `now()` is
--   transaction-scoped, so a paired write ended up with identical
--   `submitted_at` values to the microsecond — a second, independent
--   join key.
--
-- Fix (this migration):
--   * Give `review_submissions` a UUID primary key (`gen_random_uuid()`),
--     drawn from a space unrelated to `reviews.id`.
--   * Drop `review_submissions.submitted_at` entirely. The submission
--     table's only job is to answer "has this account already submitted
--     for this course?" — knowing WHEN adds nothing the app uses and
--     hands an attacker a perfect join key.
--
-- The `reviews` table is left alone: its integer id and `submitted_at`
-- carry no user identity on their own, and `submitted_at` is still
-- needed to sort reviews by recency on professor pages.
--
-- Nothing in application code reads `review_submissions.id` or
-- `review_submissions.submitted_at`, and no foreign key from any other
-- table references either column, so this migration is a schema-only
-- change with a UUID backfill for existing rows.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Drop the sequential id column and its PK/sequence.
ALTER TABLE "review_submissions" DROP CONSTRAINT "review_submissions_pkey";
ALTER TABLE "review_submissions" DROP COLUMN "id";

-- 2. Add a UUID id column with per-row random default; existing rows
--    get a fresh UUID immediately because the DEFAULT expression fires
--    for every row that would otherwise be NULL.
ALTER TABLE "review_submissions"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

-- 3. Make it the primary key.
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_pkey" PRIMARY KEY ("id");

-- 4. Drop the correlated timestamp. Duplicate check only needs
--    (user_id, professor_course_id), which the existing UNIQUE index
--    already enforces.
ALTER TABLE "review_submissions" DROP COLUMN "submitted_at";
