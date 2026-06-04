// app/admin/companies/[id]/_components/CompanyEditor.tsx — E.10: editor de la ficha
//
// Formulario único con todos los campos editables. Save envía PATCH y
// muestra toast. Soft-delete en el header. Todo queda registrado en el
// audit log (Note con author='admin').
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { basePath } from '@/lib/utils/base-path';
import { INDUSTRIAS } from '@/lib/industria';

export interface CompanyFull {
  id: string;
  slug: string;
  name: string;
  cif: string | null;
  sector: string;
  subsector: string;
  cnae: string | null;
  parentGroup: string | null;
  hqCity: string | null;
  hqRegion: string | null;
  website: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  facturacionM: number | null;
  facturacionYear: number | null;
  ebitdaM: number | null;
  beneficioNetoM: number | null;
  deudaNetaM: number | null;
  empleadosTotal: number | null;
  tier: string;
  status: string;
  priority: number;
  _count: { plants: number; sources: number; operations: number; contacts: number; financials: number; notes: number; patents: number };
}

const TIERS = ['A', 'B', 'C', 'D'];
const STATUSES = ['active', 'inactive'];

export function CompanyEditor({ company }: { company: CompanyFull }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    name: company.name,
    cif: company.cif ?? '',
    sector: company.sector,
    subsector: company.subsector,
    cnae: company.cnae ?? '',
    parentGroup: company.parentGroup ?? '',
    hqCity: company.hqCity ?? '',
    hqRegion: company.hqRegion ?? '',
    website: company.website ?? '',
    logoUrl: company.logoUrl ?? '',
    heroImageUrl: company.heroImageUrl ?? '',
    facturacionM: company.facturacionM ?? '',
    facturacionYear: company.facturacionYear ?? '',
    ebitdaM: company.ebitdaM ?? '',
    beneficioNetoM: company.beneficioNetoM ?? '',
    deudaNetaM: company.deudaNetaM ?? '',
    empleadosTotal: company.empleadosTotal ?? '',
    tier: company.tier,
    status: company.status,
    priority: company.priority ?? 0,
  }));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 2500);
  }

  function asPatch() {
    const o = form as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v === '' || v === null) out[k] = null;
      else if (['facturacionM', 'facturacionYear', 'ebitdaM', 'beneficioNetoM', 'deudaNetaM', 'empleadosTotal', 'priority'].includes(k)) {
        out[k] = v === '' ? null : Number(v);
      } else out[k] = v;
    }
    return out;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify(asPatch()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      flash('ok', 'Cambios guardados');
      router.refresh();
    } catch (e: unknown) {
      flash('err', e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus() {
    const next = form.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !window.confirm(`¿Marcar "${company.name}" como inactiva?`)) return;
    if (next === 'active' && !window.confirm(`¿Reactivar "${company.name}"?`)) return;
    setBusy(true);
    try {
      const res = adminFetch(
        next === 'inactive'
          ? `/api/admin/companies/${company.id}`
          : `/api/admin/companies/${company.id}`,
        next === 'inactive'
          ? { method: 'DELETE' }
          : { method: 'PATCH', body: JSON.stringify({ status: 'active' }) },
      );
      const r = await res;
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setField('status', next);
      flash('ok', next === 'inactive' ? 'Empresa inactivada' : 'Empresa reactivada');
      router.refresh();
    } catch (e: unknown) {
      flash('err', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="surus-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{company.name}</h2>
          <div style={{ color: 'var(--surus-text-muted)', fontSize: 'var(--text-sm)' }}>
            <Link href={`${basePath()}/empresas/${company.slug}`} target="_blank" rel="noreferrer">
              Ver ficha pública ↗
            </Link>
            <span style={{ margin: '0 var(--space-2)' }}>·</span>
            <code>{company.slug}</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={busy}
            className={form.status === 'active' ? 'surus-button-ghost' : 'surus-button'}
            style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
          >
            {form.status === 'active' ? 'Marcar inactiva' : 'Reactivar'}
          </button>
          <button type="submit" disabled={busy} className="surus-button" style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <Section title="Identidad">
        <Grid>
          <Field label="Nombre"><input value={form.name} onChange={(e) => setField('name', e.target.value)} style={input} required /></Field>
          <Field label="CIF"><input value={form.cif} onChange={(e) => setField('cif', e.target.value)} style={input} /></Field>
          <Field label="Grupo matriz"><input value={form.parentGroup} onChange={(e) => setField('parentGroup', e.target.value)} style={input} /></Field>
          <Field label="Web"><input value={form.website} onChange={(e) => setField('website', e.target.value)} style={input} placeholder="https://…" /></Field>
        </Grid>
      </Section>

      <Section title="Sector">
        <Grid>
          <Field label="Sector *">
            <select value={form.sector} onChange={(e) => setField('sector', e.target.value)} style={input} required>
              {INDUSTRIAS.map((i) => <option key={i.sector} value={i.sector}>{i.label}</option>)}
            </select>
          </Field>
          <Field label="Subsector *"><input value={form.subsector} onChange={(e) => setField('subsector', e.target.value)} style={input} required /></Field>
          <Field label="CNAE"><input value={form.cnae} onChange={(e) => setField('cnae', e.target.value)} style={input} placeholder="10.2" /></Field>
          <Field label="Tier">
            <select value={form.tier} onChange={(e) => setField('tier', e.target.value)} style={input}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Sede central">
        <Grid>
          <Field label="Ciudad"><input value={form.hqCity} onChange={(e) => setField('hqCity', e.target.value)} style={input} /></Field>
          <Field label="CCAA"><input value={form.hqRegion} onChange={(e) => setField('hqRegion', e.target.value)} style={input} /></Field>
        </Grid>
      </Section>

      <Section title="KPIs">
        <Grid>
          <Field label="Facturación (M€)"><input type="number" step="0.1" value={form.facturacionM} onChange={(e) => setField('facturacionM', e.target.value)} style={input} /></Field>
          <Field label="Año facturación"><input type="number" min={1990} max={2100} value={form.facturacionYear} onChange={(e) => setField('facturacionYear', e.target.value)} style={input} /></Field>
          <Field label="EBITDA (M€)"><input type="number" step="0.1" value={form.ebitdaM} onChange={(e) => setField('ebitdaM', e.target.value)} style={input} /></Field>
          <Field label="Beneficio neto (M€)"><input type="number" step="0.1" value={form.beneficioNetoM} onChange={(e) => setField('beneficioNetoM', e.target.value)} style={input} /></Field>
          <Field label="Deuda neta (M€)"><input type="number" step="0.1" value={form.deudaNetaM} onChange={(e) => setField('deudaNetaM', e.target.value)} style={input} /></Field>
          <Field label="Empleados"><input type="number" min={0} value={form.empleadosTotal} onChange={(e) => setField('empleadosTotal', e.target.value)} style={input} /></Field>
        </Grid>
      </Section>

      <Section title="Imágenes">
        <Grid>
          <Field label="Logo URL"><input value={form.logoUrl} onChange={(e) => setField('logoUrl', e.target.value)} style={input} /></Field>
          <Field label="Hero image URL"><input value={form.heroImageUrl} onChange={(e) => setField('heroImageUrl', e.target.value)} style={input} /></Field>
        </Grid>
      </Section>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
        <span className="surus-pill">{company._count.plants} sedes</span>
        <span className="surus-pill">{company._count.sources} fuentes</span>
        <span className="surus-pill">{company._count.operations} operaciones</span>
        <span className="surus-pill">{company._count.contacts} contactos</span>
        <span className="surus-pill">{company._count.financials} financials</span>
        <span className="surus-pill">{company._count.patents} patentes</span>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toast.kind === 'ok' ? 'var(--surus-success)' : 'var(--surus-danger)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--surus-shadow-md)',
            fontSize: 'var(--text-sm)',
            zIndex: 1000,
          }}
        >
          {toast.msg}
        </div>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <h3 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--surus-text-muted)', marginBottom: 'var(--space-2)' }}>{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--surus-border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  background: 'var(--surus-bg-elev)',
};
