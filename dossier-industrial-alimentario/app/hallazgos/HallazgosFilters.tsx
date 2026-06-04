// app/hallazgos/HallazgosFilters.tsx — URL-driven filter bar
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { INDUSTRIAS, labelDeIndustria } from '@/lib/industria';

export function HallazgosFilters({
  ccaas,
  initial,
  base,
}: {
  ccaas: string[];
  initial: { q?: string; ccaa?: string; signal?: string; stale?: string; industria?: string };
  base: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial.q ?? '');

  const apply = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    router.push(`${base}/hallazgos?${sp.toString()}`);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        alignItems: 'end',
      }}
    >
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft)',
            marginBottom: 4,
          }}
        >
          Búsqueda full-text
        </label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pescanova, ERE, cierre…"
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
            fontSize: 'var(--text-sm)',
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft)',
            marginBottom: 4,
          }}
        >
          CCAA
        </label>
        <select
          value={initial.ccaa ?? ''}
          onChange={(e) => apply({ ccaa: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <option value="">— Todas —</option>
          {ccaas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft)',
            marginBottom: 4,
          }}
        >
          Señal
        </label>
        <select
          value={initial.signal ?? ''}
          onChange={(e) => apply({ signal: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <option value="">— Todas —</option>
          <option value="in">En alcance</option>
          <option value="out">Fuera de alcance</option>
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft)',
            marginBottom: 4,
          }}
        >
          Estado
        </label>
        <select
          value={initial.stale ?? ''}
          onChange={(e) => apply({ stale: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <option value="">— Todos —</option>
          <option value="0">Fresh</option>
          <option value="1">Stale</option>
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft)',
            marginBottom: 4,
          }}
        >
          Industria
        </label>
        <select
          value={initial.industria ?? ''}
          onChange={(e) => apply({ industria: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <option value="">— Todas —</option>
          {INDUSTRIAS.map((i) => (
            <option key={i.sector} value={i.sector}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="surus-btn surus-btn-primary"
        style={{ padding: 'var(--space-2) var(--space-4)' }}
      >
        Buscar
      </button>
    </form>
  );
}
