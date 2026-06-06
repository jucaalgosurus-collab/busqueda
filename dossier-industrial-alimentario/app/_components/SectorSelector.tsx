'use client';
// app/_components/SectorSelector.tsx — Dropdown global en header
import { useSector, SECTORS } from './SectorContext';
import { basePath } from '@/lib/utils/base-path';

export function SectorSelector() {
  const { sector, setSector } = useSector();
  return (
    <select
      aria-label="Selector de sector"
      value={sector}
      onChange={(e) => setSector(e.target.value as typeof sector)}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 'var(--text-sm)',
        border: '1px solid var(--surus-border, #cbd5e1)',
        borderRadius: 'var(--radius-md, 6px)',
        background: 'var(--surus-surface, #fff)',
        color: 'var(--surus-text, #0f172a)',
        cursor: 'pointer',
      }}
    >
      {SECTORS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
