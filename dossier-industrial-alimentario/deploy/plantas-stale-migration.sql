-- /opt/hermes-dossier/apps/dossier-industrial/deploy/plantas-stale-migration.sql
-- Sprint B.8 — Plantas stale 3 escaneos (diario)
-- Añade isStale + staleReason + staleAt + staleCheckedAt a Plant
-- Idempotente: usa IF NOT EXISTS. Se puede aplicar múltiples veces.

BEGIN;

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS "isStale" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS "staleReason" TEXT;

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS "staleAt" TIMESTAMP(3);

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS "staleCheckedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Plant_isStale_idx" ON "Plant"("isStale");
CREATE INDEX IF NOT EXISTS "Plant_staleCheckedAt_idx" ON "Plant"("staleCheckedAt");

COMMIT;
