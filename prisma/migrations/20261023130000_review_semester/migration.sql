-- Optional semester on reviews (SRS Phase 2: semester tracking).
CREATE TYPE "SemesterTerm" AS ENUM ('spring', 'summer', 'fall');

ALTER TABLE "reviews"
  ADD COLUMN "semester_term" "SemesterTerm",
  ADD COLUMN "semester_year" SMALLINT;

-- A term without a year (or vice versa) is meaningless; years outside a
-- sane window are typos.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_semester_pair_chk"
  CHECK ((semester_term IS NULL) = (semester_year IS NULL)),
  ADD CONSTRAINT "reviews_semester_year_chk"
  CHECK (semester_year IS NULL OR semester_year BETWEEN 2000 AND 2100);
