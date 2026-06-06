// app/admin/surus/pipeline/_lib/pipeline.ts — Constantes del pipeline
// Sprint CRM.1 — 5 etapas comerciales Surus

export const PIPELINE_STAGES = [
  { id: 'nuevo', label: 'Nuevo', color: '#64748b' },
  { id: 'cualificado', label: 'Cualificado', color: '#0ea5e9' },
  { id: 'propuesta', label: 'Propuesta', color: '#f59e0b' },
  { id: 'negociacion', label: 'Negociación', color: '#8b5cf6' },
  { id: 'cerrado', label: 'Cerrado', color: '#10b981' },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]['id'];

export function isValidStage(stage: string | null | undefined): stage is PipelineStageId {
  return PIPELINE_STAGES.some((s) => s.id === stage);
}
