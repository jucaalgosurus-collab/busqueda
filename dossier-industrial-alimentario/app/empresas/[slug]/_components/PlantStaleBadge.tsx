// app/empresas/[slug]/_components/PlantStaleBadge.tsx — Sprint B.8
//
// Badge amarillo para plantas sin novedad en 21d. Sin estado client.
// Server Component — no JS, solo render. Color: --color-warn (amarillo).

import type { Plant } from '@prisma/client';

type Props = {
  plant: Pick<Plant, 'id' | 'name' | 'isStale' | 'staleReason' | 'staleAt' | 'staleCheckedAt'>;
};

const STALE_REASON_LABEL: Record<string, string> = {
  sin_novedad_21d: 'sin novedad 21d',
  cerrada_registrada: 'cerrada registrada',
  estado_terminal: 'estado terminal',
  planta_recien_creada: 'planta recién creada',
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export function PlantStaleBadge({ plant }: Props) {
  if (!plant.isStale) return null;
  const reasonLabel = STALE_REASON_LABEL[plant.staleReason ?? ''] ?? plant.staleReason ?? '—';
  return (
    <span
      className="surus-pill surus-pill--warn"
      title={`Última actividad: ${formatDate(plant.staleAt)}`}
      aria-label={`Planta sin novedad: ${reasonLabel}, marcada el ${formatDate(plant.staleAt)}`}
    >
      <span className="surus-pill__icon" aria-hidden="true">⚠</span>
      <span>{reasonLabel}</span>
    </span>
  );
}
