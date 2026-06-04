// app/empresas/EmpresasFilters.tsx — URL-driven filter bar
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { INDUSTRIAS } from '@/lib/industria';

export function EmpresasFilters({
  initial,
  base,
}: {
  initial: { q?: string; industria?: string };
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
    router.push(`${base}/empresas?${sp.toString()}`);
  };

  const onIndustriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    apply({ industria: e.target.value });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr auto',
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
          Buscar empresa
        </label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pescanova, Lactalis, Grifols…"
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
          Industria
        </label>
        <select
          value={initial.industria ?? ''}
          onChange={onIndustriaChange}
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
