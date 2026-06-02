-- HERMES-DOSSIER — Spanish FTS migration v3 (trigger-based, Postgres 18.4)
-- 2026-06-02 — Sprint 1
-- PostgreSQL 18 marks to_tsvector(regconfig, text) as STABLE, not IMMUTABLE,
-- so we cannot use a GENERATED column. We go back to a trigger, but write to a
-- real column we manage ourselves (instead of relying on Prisma schema).

-- 1) Add a real text column (not tsvector type, to avoid Prisma sync conflicts).
--    We will store the tsvector as text-cast column managed by the trigger.
ALTER TABLE "Source"
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector;

-- 2) Trigger function: recomputes tsvector on INSERT/UPDATE.
CREATE OR REPLACE FUNCTION source_tsvector_update() RETURNS trigger AS $$
BEGIN
  NEW.content_tsvector :=
    setweight(to_tsvector('spanish', unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(NEW.content, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Bind trigger to the table.
DROP TRIGGER IF EXISTS source_tsvector_trigger ON "Source";
CREATE TRIGGER source_tsvector_trigger
  BEFORE INSERT OR UPDATE OF title, content ON "Source"
  FOR EACH ROW EXECUTE FUNCTION source_tsvector_update();

-- 4) GIN index for fast full-text search.
CREATE INDEX IF NOT EXISTS "Source_content_tsvector_idx"
  ON "Source" USING GIN (content_tsvector);

-- 5) Trigram index on company name for typo-tolerance (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx"
  ON "Company" USING GIN (name gin_trgm_ops);

-- 6) Backfill existing rows so the column is populated for the 7 seed sources.
UPDATE "Source" SET title = title WHERE content_tsvector IS NULL;
