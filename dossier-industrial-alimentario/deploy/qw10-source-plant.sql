-- QW-10: Add Source.plantId (noticia → sede)
-- Permite asociar cada hallazgo a su sede concreta, y por tanto a sus responsables.
-- Migración idempotente: no falla si la columna ya existe.

ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "plantId" TEXT;
CREATE INDEX IF NOT EXISTS "Source_plantId_idx" ON "Source"("plantId");

-- FK con SetNull: si una planta se borra, el Source queda sin sede (no se pierde la noticia).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Source_plantId_fkey' AND table_name = 'Source'
  ) THEN
    ALTER TABLE "Source"
      ADD CONSTRAINT "Source_plantId_fkey"
      FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
