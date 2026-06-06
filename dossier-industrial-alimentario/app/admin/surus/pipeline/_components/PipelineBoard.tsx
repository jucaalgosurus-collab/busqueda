'use client';
// app/admin/surus/pipeline/_components/PipelineBoard.tsx — Kanban con drag&drop nativo
// Sprint CRM.1 — Drag&Drop con HTML5 DnD API (sin librería externa)
import { useState, useTransition } from 'react';
import { basePath } from '@/lib/utils/base-path';

export interface PipelineCompany {
  id: string;
  slug: string;
  name: string;
  sector: string;
  subsector: string;
  hqCity: string | null;
  tier: string;
  facturacionM: number | null;
  empleadosTotal: number | null;
}

export interface StageColumn {
  id: string;
  label: string;
  color: string;
  companies: PipelineCompany[];
}

interface BoardProps {
  initialStages: StageColumn[];
}

export function PipelineBoard({ initialStages }: BoardProps) {
  const [stages, setStages] = useState<StageColumn[]>(initialStages);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const companyId = e.dataTransfer.getData('text/company-id');
    const sourceStageId = e.dataTransfer.getData('text/source-stage');
    if (!companyId || sourceStageId === targetStageId) return;

    // Optimistic update
    const previous = stages;
    const next = stages.map((s) => {
      if (s.id === sourceStageId) {
        return { ...s, companies: s.companies.filter((c) => c.id !== companyId) };
      }
      if (s.id === targetStageId) {
        const moved = previous
          .find((s) => s.id === sourceStageId)
          ?.companies.find((c) => c.id === companyId);
        return moved ? { ...s, companies: [...s.companies, moved] } : s;
      }
      return s;
    });
    setStages(next);

    startTransition(async () => {
      try {
        const res = await fetch(
          `${basePath()}/api/admin/surus/pipeline/${companyId}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stage: targetStageId }),
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        // Rollback
        setStages(previous);
      }
    });
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`,
        gap: 'var(--space-3)',
        overflowX: 'auto',
        paddingBottom: 'var(--space-3)',
      }}
    >
      {stages.map((stage) => {
        const isOver = dragOverStage === stage.id;
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
            style={{
              background: isOver
                ? 'rgba(14, 165, 233, 0.08)'
                : 'var(--surus-surface, #f8fafc)',
              border: `1px solid ${isOver ? stage.color : 'var(--surus-border, #e2e8f0)'}`,
              borderRadius: 'var(--radius-md, 6px)',
              padding: 'var(--space-3)',
              minHeight: 400,
              transition: 'background 120ms, border-color 120ms',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-3)',
                paddingBottom: 'var(--space-2)',
                borderBottom: `2px solid ${stage.color}`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: stage.color,
                  display: 'inline-block',
                }}
              />
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flex: 1,
                }}
              >
                {stage.label}
              </h2>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft, #64748b)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stage.companies.length}
              </span>
            </header>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {stage.companies.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--surus-text-soft, #64748b)',
                    textAlign: 'center',
                    padding: 'var(--space-4) 0',
                  }}
                >
                  {pending ? 'Moviendo…' : 'Arrastra aquí'}
                </p>
              ) : (
                stage.companies.map((c) => (
                  <CompanyCard key={c.id} company={c} sourceStageId={stage.id} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompanyCard({
  company,
  sourceStageId,
}: {
  company: PipelineCompany;
  sourceStageId: string;
}) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/company-id', company.id);
        e.dataTransfer.setData('text/source-stage', sourceStageId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        padding: 'var(--space-3)',
        background: 'var(--surus-bg, #fff)',
        border: '1px solid var(--surus-border, #e2e8f0)',
        borderRadius: 'var(--radius-sm, 4px)',
        cursor: 'grab',
        fontSize: 'var(--text-sm)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
        <a
          href={`${basePath()}/empresas/${company.slug}`}
          style={{ color: 'inherit', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {company.name}
        </a>
      </div>
      <div
        style={{
          color: 'var(--surus-text-soft, #64748b)',
          fontSize: 'var(--text-xs)',
        }}
      >
        {company.subsector} · {company.hqCity ?? '—'}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
        }}
      >
        {company.facturacionM != null && (
          <span>{company.facturacionM.toFixed(0)}M€</span>
        )}
        {company.empleadosTotal != null && (
          <span>· {company.empleadosTotal} emp.</span>
        )}
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{company.tier}</span>
      </div>
    </article>
  );
}
