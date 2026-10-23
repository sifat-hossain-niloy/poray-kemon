-- Site-wide recency index for the /reviews feed and the trending-professors
-- widget, which both scan reviews by submitted_at across all professors.
CREATE INDEX IF NOT EXISTS "reviews_submitted_at_idx" ON "reviews"("submitted_at" DESC);
