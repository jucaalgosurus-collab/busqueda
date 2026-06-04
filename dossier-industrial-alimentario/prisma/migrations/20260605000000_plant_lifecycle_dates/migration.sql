-- E.10: añadir openedAt / closedAt a Plant para lifecycle explícito de sede.
-- Backfill suave: si una planta tiene status terminal, copiamos createdAt como
-- closedAt. Si no, openedAt = createdAt. Esto da coherencia histórica al
-- grafo de sedes.

ALTER TABLE "Plant" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "Plant" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Backfill histórico
UPDATE "Plant"
SET "openedAt" = "createdAt"
WHERE "openedAt" IS NULL;

UPDATE "Plant"
SET "closedAt" = "createdAt"
WHERE "closedAt" IS NULL
  AND "status" IN ('cerrada', 'vendida', 'en_desmantelamiento');

-- Índices para queries por ventana de tiempo
CREATE INDEX IF NOT EXISTS "Plant_openedAt_idx" ON "Plant" ("openedAt");
CREATE INDEX IF NOT EXISTS "Plant_closedAt_idx" ON "Plant" ("closedAt");
