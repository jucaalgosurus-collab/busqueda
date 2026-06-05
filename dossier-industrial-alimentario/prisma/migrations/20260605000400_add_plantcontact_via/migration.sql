-- Añade via a PlantContact (declarada en schema.prisma desde 2026-06-03 "Plan B").
-- Tracking de método de captura: 'google_cse' | 'playwright' | 'multi_engine'.
-- Tabla vacía → no requiere backfill ni default.
ALTER TABLE "PlantContact" ADD COLUMN IF NOT EXISTS "via" TEXT;
