-- Account deletion must not reset the duplicate-review guard.
--
-- Deleting a `users` row cascades its `review_submissions`. Without a
-- tombstone, the same Google account could sign in again (new `users` row,
-- same `sub`) and review every professor+course a second time.
--
-- Each row holds HMAC-SHA256(server secret, google_sub || professor_course_id)
-- as hex, computed in application code (lib/account-tombstone.ts) so the
-- secret never appears in SQL text or statement logs.
--
-- Deliberately ONE column:
--   * no professor_course_id, so a row cannot be matched to any course, and
--     therefore not to any review;
--   * no user_id (the account is gone) and no serial id;
--   * no created_at: `review_submissions` dropped its timestamp in
--     20260731120000 so it could not be time-joined against
--     `reviews.submitted_at`; this table must not reintroduce a time axis.
CREATE TABLE "review_submission_tombstones" (
    "key_hash" CHAR(64) NOT NULL,

    CONSTRAINT "review_submission_tombstones_pkey" PRIMARY KEY ("key_hash")
);
