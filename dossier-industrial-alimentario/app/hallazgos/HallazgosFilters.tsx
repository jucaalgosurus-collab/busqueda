// app/hallazgos/HallazgosFilters.tsx — URL-driven filter bar
// E.6: añade filtros sede + sort.
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
  initial: {
    q?: string;
    ccaa?: string;
    signal?: string;
    stale?: string;
    industria?: string;
    sede?: string;
    sort?: string;
  };
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-xs)',
    color: 'var(--surus-text-soft)',
    marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--surus-border)',
    fontSize: 'var(--text-sm)',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    padding: 'var(--space-2)',
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr auto',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        alignItems: 'end',
      }}
    >
      <div>
        <label style={labelStyle}>Búsqueda full-text</label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pescanova, ERE, cierre…"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>CCAA</label>
        <select
          value={initial.ccaa ?? ''}
          onChange={(e) => apply({ ccaa: e.target.value })}
          style={selectStyle}
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
        <label style={labelStyle}>Señal</label>
        <select
          value={initial.signal ?? ''}
          onChange={(e) => apply({ signal: e.target.value })}
          style={selectStyle}
        >
          <option value="">— Todas —</option>
          <option value="in">En alcance</option>
          <option value="out">Fuera de alcance</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Estado</label>
        <select
          value={initial.stale ?? ''}
          onChange={(e) => apply({ stale: e.target.value })}
          style={selectStyle}
        >
          <option value="">— Todos —</option>
          <option value="0">Fresh</option>
          <option value="1">Stale</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Industria</label>
        <select
          value={initial.industria ?? ''}
          onChange={(e) => apply({ industria: e.target.value })}
          style={selectStyle}
        >
          <option value="">— Todas —</option>
          {INDUSTRIAS.map((i) => (
            <option key={i.sector} value={i.sector}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Sede</label>
        <input
          type="text"
          defaultValue={initial.sede ?? ''}
          onBlur={(e) => apply({ sede: e.target.value })}
          placeholder="Alovera, Aldaia…"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Orden</label>
        <select
          value={initial.sort ?? 'fecha_desc'}
          onChange={(e) => apply({ sort: e.target.value })}
          style={selectStyle}
        >
          <option value="fecha_desc">Fecha ↓</option>
          <option value="fecha_asc">Fecha ↑</option>
          <option value="empresa">Empresa A-Z</option>
          <option value="sede">Sede A-Z</option>
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
