// app/admin/_components/CompaniesTable.tsx — E.10: lista de empresas editable
//
// Server component: carga initial set de companies. La tabla permite:
//  - Buscar (filtra client-side para no martillear la API)
//  - Ver badge de status (activa/inactiva)
//  - Click → /admin/companies/[id] (ficha editable)
//  - Crear nueva empresa (modal inline con form)
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { basePath } from '@/lib/utils/base-path';
import { INDUSTRIAS } from '@/lib/industria';

export interface Row {
  id: string;
  slug: string;
  name: string;
  cif: string | null;
  sector: string;
  subsector: string;
  tier: string;
  status: string;
  hqRegion: string | null;
  facturacionM: number | null;
  empleadosTotal: number | null;
  priority: number;
  _count: { plants: number; sources: number; operations: number; contacts: number };
}

const SECTORS = INDUSTRIAS.map((i) => i.sector);

export function CompaniesTable({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    sector: 'Alimentos y Bebidas',
    subsector: 'Cárnicas',
    cif: '',
    tier: 'A',
    parentGroup: '',
    website: '',
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term) ||
        (r.cif ?? '').toLowerCase().includes(term) ||
        r.sector.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const counts = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      inactive: rows.filter((r) => r.status === 'inactive').length,
      plantas: rows.reduce((s, r) => s + r._count.plants, 0),
    };
  }, [rows]);

  async function reload() {
    const res = await adminFetch('/api/admin/companies?limit=200');
    if (res.ok) {
      const j = await res.json();
      setRows(j.data);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        slug: form.slug || undefined,
        cif: form.cif || null,
        parentGroup: form.parentGroup || null,
        website: form.website || null,
      };
      const res = await adminFetch('/api/admin/companies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      setShowCreate(false);
      setForm({ ...form, name: '', slug: '', cif: '' });
      router.push(`${basePath()}/admin/companies/${j.data.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Buscar por nombre, slug, CIF, sector…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            padding: '8px 12px',
            border: '1px solid var(--surus-border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        />
        <button
          type="button"
          onClick={() => reload()}
          className="surus-button-ghost"
          style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
        >
          ↻ Recargar
        </button>
        <button
          type="button"
          onClick={() => setShowCreate((s) => !s)}
          className="surus-button"
          style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
        >
          + Nueva empresa
        </button>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)' }}>
        <span><strong>{counts.total}</strong> total</span>
        <span>·</span>
        <span><strong style={{ color: 'var(--surus-success)' }}>{counts.active}</strong> activas</span>
        <span>·</span>
        <span><strong style={{ color: 'var(--surus-text-muted)' }}>{counts.inactive}</strong> inactivas</span>
        <span>·</span>
        <span><strong>{counts.plantas}</strong> sedes</span>
      </div>

      {showCreate && (
        <form
          onSubmit={onCreate}
          className="surus-card surus-fade-in"
          style={{ marginBottom: 'var(--space-4)' }}
        >
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Crear empresa</h3>
          {err && (
            <div role="alert" style={{ color: 'var(--surus-danger)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              {err}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Nombre *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Slug (auto si vacío)">
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pascual" style={inputStyle} />
            </Field>
            <Field label="CIF">
              <input value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} placeholder="A12345678" style={inputStyle} />
            </Field>
            <Field label="Sector *">
              <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} style={inputStyle}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Subsector *">
              <input required value={form.subsector} onChange={(e) => setForm({ ...form, subsector: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Tier">
              <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} style={inputStyle}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </Field>
            <Field label="Grupo matriz">
              <input value={form.parentGroup} onChange={(e) => setForm({ ...form, parentGroup: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Web">
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <button type="submit" disabled={busy} className="surus-button">
              {busy ? 'Creando…' : 'Crear'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="surus-button-ghost" style={{ padding: '8px 14px' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="surus-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--surus-bg)', textAlign: 'left' }}>
              <th style={th}>Empresa</th>
              <th style={th}>Sector / Sub</th>
              <th style={th}>Tier</th>
              <th style={th}>CCAA</th>
              <th style={th}>M€</th>
              <th style={th}>Empleados</th>
              <th style={th}>Sedes</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--surus-border)' }}>
                <td style={td}>
                  <Link href={`${basePath()}/admin/companies/${r.id}`} style={{ color: 'var(--surus-primary-500)', fontWeight: 500 }}>
                    {r.name}
                  </Link>
                  <div style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-xs)' }}>{r.slug}</div>
                </td>
                <td style={td}>
                  <div>{r.sector}</div>
                  <div style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-xs)' }}>{r.subsector}</div>
                </td>
                <td style={td}><span className="surus-pill">{r.tier}</span></td>
                <td style={td}>{r.hqRegion ?? '—'}</td>
                <td style={td}>{r.facturacionM != null ? `${r.facturacionM.toFixed(0)}` : '—'}</td>
                <td style={td}>{r.empleadosTotal != null ? r.empleadosTotal.toLocaleString('es-ES') : '—'}</td>
                <td style={td}>
                  <strong>{r._count.plants}</strong>
                  {r._count.operations > 0 && <span style={{ color: 'var(--surus-warning)' }}> · {r._count.operations} ops</span>}
                </td>
                <td style={td}>
                  {r.status === 'active' ? (
                    <span className="surus-pill surus-pill-success">activa</span>
                  ) : (
                    <span className="surus-pill">inactiva</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--surus-text-muted)' }}>
                  Sin resultados para «{q}».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--surus-border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  background: 'var(--surus-bg-elev)',
};

const th: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--surus-text-muted)',
};
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}
