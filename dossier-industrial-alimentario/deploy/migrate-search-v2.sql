-- HERMES-DOSSIER — Spanish FTS migration v2 (PostgreSQL 18.4 GENERATED columns)
-- 2026-06-02 — Sprint 1
-- Replaces the obsolete trigger approach (which referenced a non-existent column
-- `content_tsvector`) with a PostgreSQL 12+ GENERATED column. No trigger needed:
-- Postgres recomputes the tsvector on every INSERT/UPDATE automatically.
--
-- Requires: unaccent extension (already enabled in migrate-search.sql).

-- 1) Add generated tsvector column (immutable expression).
ALTER TABLE "Source"
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(content, ''))), 'B')
  ) STORED;

-- 2) GIN index for fast full-text search.
CREATE INDEX IF NOT EXISTS "Source_content_tsvector_idx"
  ON "Source" USING GIN (content_tsvector);

-- 3) Trigram index on company name for typo-tolerance (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx"
  ON "Company" USING GIN (name gin_trgm_ops);
