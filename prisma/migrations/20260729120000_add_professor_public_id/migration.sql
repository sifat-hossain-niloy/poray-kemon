-- Opaque, defamation-safe public identifier for professor URLs.
--
-- Requirements:
--   * 8 characters from Crockford's base32 alphabet minus vowels and I/L
--     (so no accidental words, no visually ambiguous chars).
--   * Random, not derived from the sequential id — leaks nothing about
--     signup order or count.
--   * Postgres-side generation so every INSERT (Prisma, admin API, seed,
--     raw SQL) gets one automatically. No app-code hunting.

-- Crockford base32 minus vowels: 0-9 B-D F-H J K M N P Q R S T V W X Y Z
-- 32 characters. Excludes A/E/I/O/U (so no words) and I/L/O (ambiguity).
CREATE OR REPLACE FUNCTION pk_gen_public_id(len integer) RETURNS text AS $$
DECLARE
  alphabet text := '0123456789BCDFGHJKMNPQRSTVWXYZ';  -- 30 chars (see note)
  result text := '';
  i integer := 0;
BEGIN
  -- Note: 30 char alphabet, len=8 → 30^8 ≈ 6.5e11 codes. Plenty for a
  -- professor catalog of any realistic size, with collision probability
  -- well under 10^-6 at 10^5 rows.
  FOR i IN 1..len LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Add the column nullable + unique so we can backfill without violating.
ALTER TABLE professors ADD COLUMN public_id VARCHAR(8);
CREATE UNIQUE INDEX professors_public_id_key ON professors(public_id);

-- Backfill: retry-on-collision loop for each existing row.
DO $$
DECLARE
  prof_row RECORD;
  new_id text;
BEGIN
  FOR prof_row IN SELECT id FROM professors WHERE public_id IS NULL LOOP
    LOOP
      new_id := pk_gen_public_id(8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM professors WHERE public_id = new_id);
    END LOOP;
    UPDATE professors SET public_id = new_id WHERE id = prof_row.id;
  END LOOP;
END $$;

-- Now lock it down + wire up the default so future INSERTs auto-fill.
ALTER TABLE professors ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE professors ALTER COLUMN public_id SET DEFAULT pk_gen_public_id(8);
