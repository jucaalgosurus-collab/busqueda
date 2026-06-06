-- Sprint CRM.1 — Pipeline comercial Surus
-- 5 etapas: nuevo → cualificado → propuesta → negociacion → cerrado
-- Null = empresa sin clasificar (no aparece en Kanban hasta que se asigne)

ALTER TABLE "Company" ADD COLUMN "pipelineStage" TEXT;
CREATE INDEX "Company_pipelineStage_idx" ON "Company"("pipelineStage");
