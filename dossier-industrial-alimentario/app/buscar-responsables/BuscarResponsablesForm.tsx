'use client';
// app/buscar-responsables/BuscarResponsablesForm.tsx — Formulario + resultados
// CRUZAMIENTO LinkedIn + Hunter.io para cada responsable.
import { useState, useTransition } from 'react';

type Company = { slug: string; name: string; subsector: string };
type RoleOption = { value: string; label: string };

interface ApiContact {
  id: string;
  fullName: string;
  role: string;
  roleCategory: string;
  linkedinUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  via: string | null;
  sourceOutlet: string | null;
  hunterChecked: boolean;
  hunterScore: number | null;
  rankScore: number;
  plant: { id: string; name: string; ccaa: string | null; city: string | null; province: string | null } | null;
}

interface ApiResponse {
  success: boolean;
  data?: {
    company: { id: string; name: string; slug: string; website: string | null; subsector: string | null };
    plant: { id: string; name: string; ccaa: string | null; city: string | null; province: string | null } | null;
    rolesSearched: string[];
    domain: string | null;
    hunterAvailable: boolean;
    contacts: ApiContact[];
    summary: { total: number; alreadyVerified: number; hunterEnriched: number; hunterNotFound: number; hunterAttempts: number };
  };
  error?: string;
}

interface Props {
  companies: Company[];
  allRoles: RoleOption[];
  defaultCompany: string;
  defaultSede: string;
  defaultRoles: string[];
  basePath: string;
}

export function BuscarResponsablesForm({ companies, allRoles, defaultCompany, defaultSede, defaultRoles, basePath }: Props) {
  const [company, setCompany] = useState(defaultCompany);
  const [sede, setSede] = useState(defaultSede);
  const [roles, setRoles] = useState<string[]>(defaultRoles);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (v: string) => {
    setRoles((prev) => prev.includes(v) ? prev.filter((r) => r !== v) : [...prev, v]);
  };

  const selectAll = () => setRoles(allRoles.map((r) => r.value));
  const clearRoles = () => setRoles([]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!company.trim()) { setError('Compañía es obligatorio'); return; }
    if (roles.length === 0) { setError('Selecciona al menos un rol'); return; }
    startTransition(async () => {
      try {
        const r = await fetch(`${basePath}/api/buscar-responsables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: company.trim(), sede: sede.trim(), roles }),
        });
        const data = await r.json() as ApiResponse;
        if (!data.success) { setError(data.error ?? 'Error desconocido'); return; }
        setResult(data);
      } catch (e) {
        setError(`Error de red: ${(e as Error).message}`);
      }
    });
  };

  const exportCsvUrl = () => {
    const params = new URLSearchParams({ company: company.trim(), sede: sede.trim(), roles: roles.join(',') });
    return `${basePath}/api/buscar-responsables/export?${params.toString()}`;
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <form onSubmit={onSubmit} style={{
        background: 'var(--surus-surface)',
        border: '1px solid var(--surus-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Compañía *</span>
            <input
              type="text"
              list="company-list"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Pescanova, Lactalis, Mahou, ..."
              style={inputStyle}
              required
            />
            <datalist id="company-list">
              {companies.map((c) => (
                <option key={c.slug} value={c.name}>{c.subsector}</option>
              ))}
            </datalist>
          </label>
          <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Sede (planta)</span>
            <input
              type="text"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              placeholder="Vigo, Barcelona, Sevilla, ... (opcional)"
              style={inputStyle}
            />
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Roles a buscar ({roles.length} seleccionados)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" onClick={selectAll} style={chipBtnStyle}>Seleccionar todos</button>
              <button type="button" onClick={clearRoles} style={chipBtnStyle}>Limpiar</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {allRoles.map((r) => {
              const on = roles.includes(r.value);
              return (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => toggleRole(r.value)}
                  style={{
                    ...chipStyle,
                    background: on ? 'var(--surus-primary)' : 'transparent',
                    color: on ? 'white' : 'var(--surus-text)',
                    borderColor: on ? 'var(--surus-primary)' : 'var(--surus-border)',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button type="submit" disabled={isPending} className="surus-button">
            {isPending ? 'Buscando + cruzando con Hunter.io...' : 'Buscar responsables'}
          </button>
          {result && (
            <a href={exportCsvUrl()} className="surus-button-secondary" rel="nofollow">
              Exportar resultados CSV
            </a>
          )}
        </div>

        {error && (
          <div style={{ color: 'var(--surus-danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
        )}
      </form>

      {result?.data && <ResultsPanel data={result.data} />}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--surus-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  background: 'var(--surus-surface)',
  color: 'var(--surus-text)',
};

const chipStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-3)',
  border: '1px solid',
  borderRadius: '999px',
  fontSize: 'var(--text-xs)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const chipBtnStyle: React.CSSProperties = {
  ...chipStyle,
  background: 'transparent',
  color: 'var(--surus-text-soft)',
  borderColor: 'var(--surus-border)',
};

function ResultsPanel({ data }: { data: NonNullable<ApiResponse['data']> }) {
  return (
    <section style={{
      background: 'var(--surus-surface)',
      border: '1px solid var(--surus-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
    }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-display-sm)', marginBottom: 'var(--space-2)' }}>
          {data.company.name}
          {data.plant && <span style={{ color: 'var(--surus-text-soft)', fontWeight: 400 }}> · {data.plant.name}{data.plant.city ? ` (${data.plant.city})` : ''}</span>}
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
          <span><strong>{data.summary.total}</strong> responsables</span>
          <span style={{ color: 'var(--surus-success)' }}>· <strong>{data.summary.alreadyVerified}</strong> ya verificados</span>
          {data.hunterAvailable && (
            <>
              <span style={{ color: 'var(--surus-accent)' }}>· <strong>{data.summary.hunterEnriched}</strong> enriquecidos ahora por Hunter</span>
              <span style={{ color: 'var(--surus-text-soft)' }}>· <strong>{data.summary.hunterNotFound}</strong> no encontrados</span>
            </>
          )}
          {!data.hunterAvailable && (
            <span style={{ color: 'var(--surus-warning)' }}>· Hunter.io no disponible (falta website o API key)</span>
          )}
        </div>
      </header>

      {data.contacts.length === 0 ? (
        <p style={{ color: 'var(--surus-text-soft)' }}>No hay responsables para esta combinación. Prueba con más roles o una sede distinta.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surus-border)' }}>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Cargo</th>
                <th style={thStyle}>Sede</th>
                <th style={thStyle}>LinkedIn</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Origen</th>
                <th style={thStyle}>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--surus-border)' }}>
                  <td style={tdStyle}>
                    <strong>{c.fullName}</strong>
                  </td>
                  <td style={tdStyle}>{c.role}</td>
                  <td style={tdStyle}>{c.plant ? `${c.plant.name}${c.plant.ccaa ? ` (${c.plant.ccaa})` : ''}` : '—'}</td>
                  <td style={tdStyle}>
                    {c.linkedinUrl
                      ? <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>LinkedIn ↗</a>
                      : <span style={{ color: 'var(--surus-text-soft)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {c.email
                      ? (
                        <>
                          <a href={`mailto:${c.email}`} style={linkStyle}>{c.email}</a>
                          {c.emailVerified ? <span title="Verificado" style={badgeOkStyle}>✓</span> : <span title="No verificado" style={badgeWarnStyle}>!</span>}
                          {c.hunterChecked && c.hunterScore !== null && (
                            <span style={badgeSubStyle} title={`Hunter score ${c.hunterScore}/100`}>H{c.hunterScore}</span>
                          )}
                        </>
                      )
                      : <span style={{ color: 'var(--surus-text-soft)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeNeutralStyle}>{c.via ?? c.sourceOutlet ?? '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace' }}>{(c.rankScore * 100).toFixed(0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--surus-text-soft)' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-3)', verticalAlign: 'middle' };
const linkStyle: React.CSSProperties = { color: 'var(--surus-primary)', textDecoration: 'none', fontWeight: 500 };
const badgeOkStyle: React.CSSProperties = { marginLeft: 'var(--space-1)', color: 'var(--surus-success)', fontWeight: 700 };
const badgeWarnStyle: React.CSSProperties = { marginLeft: 'var(--space-1)', color: 'var(--surus-warning)', fontWeight: 700 };
const badgeSubStyle: React.CSSProperties = { marginLeft: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)', background: 'var(--surus-bg-soft)', padding: '0 var(--space-1)', borderRadius: '4px' };
const badgeNeutralStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)', background: 'var(--surus-bg-soft)', padding: '2px 6px', borderRadius: '4px' };
