-- Sprint C.1 — BormeEvent table
-- Idempotente: usar IF NOT EXISTS y CREATE INDEX IF NOT EXISTS.
-- Aplicar a hermes_dossier (la del .env, NO hermes_dossier_v6).

BEGIN;

CREATE TABLE IF NOT EXISTS "BormeEvent" (
  id          TEXT PRIMARY KEY,
  "companyId" TEXT,
  "matchHash" TEXT NOT NULL,
  cif         TEXT,
  "companyName" TEXT NOT NULL,
  fecha       TIMESTAMP(3) NOT NULL,
  tipo        TEXT NOT NULL,
  "bormeId"   TEXT NOT NULL,
  provincia   TEXT NOT NULL,
  domicilio   TEXT,
  capital     TEXT,
  "rawText"   TEXT NOT NULL,
  fuente      TEXT NOT NULL,
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BormeEvent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "BormeEvent_matchHash_key" ON "BormeEvent"("matchHash");
CREATE INDEX IF NOT EXISTS "BormeEvent_companyId_idx" ON "BormeEvent"("companyId");
CREATE INDEX IF NOT EXISTS "BormeEvent_cif_idx" ON "BormeEvent"("cif");
CREATE INDEX IF NOT EXISTS "BormeEvent_fecha_idx" ON "BormeEvent"("fecha");
CREATE INDEX IF NOT EXISTS "BormeEvent_tipo_idx" ON "BormeEvent"("tipo");
CREATE INDEX IF NOT EXISTS "BormeEvent_companyName_idx" ON "BormeEvent"("companyName");

COMMIT;
