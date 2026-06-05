-- AlterTable
ALTER TABLE "Source" ADD COLUMN "sector" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Source_sector_idx" ON "Source"("sector");
