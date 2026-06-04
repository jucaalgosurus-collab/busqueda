// app/admin/companies/[id]/_components/PlantsEditor.tsx — E.10: editor de plantas
//
// Lista las sedes de la empresa en una tabla editable. Cada fila permite:
//   - Editar inline los campos principales (status, city, employees, openedAt, closedAt)
//   - Crear sede nueva (form inline al final)
//   - Cerrar/reabrir con un click
//   - Borrado = soft-delete (status='cerrada' + closedAt)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';

const PLANT_STATUS = [
  'operativa',
  'en_inversion',
  'en_desmantelamiento',
  'cerrada',
  'vendida',
  'en_proyecto',
  'en_conversion',
  'en_venta',
];

export interface PlantRow {
  id: string;
  name: string;
  ccaa: string;
  province: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  specialty: string | null;
  employees: number | null;
  parcelaM2: number | null;
  naveM2: number | null;
  openedAt: string | null;
  closedAt: string | null;
  closureYear: number | null;
  investmentMEur: number | null;
  notes: string | null;
  isStale: boolean;
  staleReason: string | null;
}

interface Props {
  companyId: string;
  plants: PlantRow[];
}

const empty = (companyId: string) => ({
  companyId,
  name: '',
  ccaa: '',
  province: '',
  city: '',
  address: '',
  status: 'operativa',
  specialty: '',
  employees: '',
});

export function PlantsEditor({ companyId, plants: initial }: Props) {
  const router = useRouter();
  const [plants, setPlants] = useState<PlantRow[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty(companyId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const res = await adminFetch(`/api/admin/companies/${companyId}/plants`);
    if (res.ok) {
      const j = await res.json();
      setPlants(j.data);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        companyId,
        name: form.name.trim(),
        ccaa: form.ccaa.trim(),
        province: form.province || null,
        city: form.city || null,
        address: form.address || null,
        status: form.status,
        specialty: form.specialty || null,
        employees: form.employees === '' ? null : Number(form.employees),
      };
      const res = await adminFetch(`/api/admin/companies/${companyId}/plants`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setForm(empty(companyId));
      setShowForm(false);
      await reload();
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al crear sede');
    } finally {
      setBusy(false);
    }
  }

  async function onClosePlant(p: PlantRow) {
    if (!window.confirm(`¿Cerrar la sede «${p.name}»? Esto la marca como cerrada con fecha de hoy.`)) return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/companies/${companyId}/plants/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await reload();
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al cerrar sede');
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate(p: PlantRow) {
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/companies/${companyId}/plants/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'operativa', closedAt: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await reload();
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al reactivar sede');
    } finally {
      setBusy(false);
    }
  }

  async function onStatusChange(p: PlantRow, newStatus: string) {
    if (newStatus === p.status) return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/companies/${companyId}/plants/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await reload();
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al cambiar status');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Sedes ({plants.length})</h3>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--surus-text-muted)' }}>
            Edita manualmente o crea nuevas. Cerrar una sede la marca como <code>cerrada</code> con fecha de hoy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="surus-button"
          style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
          disabled={busy}
        >
          + Nueva sede
        </button>
      </header>

      {err && (
        <div role="alert" style={{ color: 'var(--surus-danger)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
          {err}
        </div>
      )}

      {showForm && (
        <form onSubmit={onCreate} className="surus-card" style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Nombre *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></Field>
            <Field label="CCAA *"><input required value={form.ccaa} onChange={(e) => setForm({ ...form, ccaa: e.target.value })} style={input} /></Field>
            <Field label="Provincia"><input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} style={input} /></Field>
            <Field label="Ciudad"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={input} /></Field>
            <Field label="Dirección"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={input} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                {PLANT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Especialidad"><input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} style={input} /></Field>
            <Field label="Empleados"><input type="number" min={0} value={form.employees} onChange={(e) => setForm({ ...form, employees: e.target.value })} style={input} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <button type="submit" disabled={busy} className="surus-button">{busy ? 'Creando…' : 'Crear sede'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="surus-button-ghost" style={{ padding: '8px 14px' }}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="surus-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--surus-bg)', textAlign: 'left' }}>
              <th style={th}>Sede</th>
              <th style={th}>Ubicación</th>
              <th style={th}>Status</th>
              <th style={th}>Apertura</th>
              <th style={th}>Cierre</th>
              <th style={th}>Empleados</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => {
              const isClosed = p.status === 'cerrada' || p.status === 'vendida';
              return (
                <tr key={p.id} style={{ borderTop: '1px solid var(--surus-border)' }}>
                  <td style={td}>
                    <strong>{p.name}</strong>
                    {p.specialty && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>{p.specialty}</div>}
                  </td>
                  <td style={td}>
                    <div>{p.ccaa}{p.city ? ` · ${p.city}` : ''}</div>
                    {p.province && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>{p.province}</div>}
                  </td>
                  <td style={td}>
                    <select
                      value={p.status}
                      onChange={(e) => onStatusChange(p, e.target.value)}
                      disabled={busy}
                      style={{ ...input, padding: '4px 8px', fontSize: 'var(--text-xs)' }}
                    >
                      {PLANT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={td}>{formatDate(p.openedAt)}</td>
                  <td style={td}>{formatDate(p.closedAt)}</td>
                  <td style={td}>{p.employees != null ? p.employees.toLocaleString('es-ES') : '—'}</td>
                  <td style={td}>
                    {isClosed ? (
                      <button
                        type="button"
                        onClick={() => onReactivate(p)}
                        disabled={busy}
                        style={{ ...smallBtn, background: 'var(--surus-success)' }}
                      >
                        Reabrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onClosePlant(p)}
                        disabled={busy}
                        style={{ ...smallBtn, background: 'var(--surus-danger)' }}
                      >
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {plants.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--surus-text-muted)' }}>
                  No hay sedes. Crea la primera con «+ Nueva sede».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

const input: React.CSSProperties = {
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
const smallBtn: React.CSSProperties = {
  color: 'white',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-xs)',
  cursor: 'pointer',
  fontWeight: 500,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}
