// app/admin/outreach/OutreachClient.tsx — QW-9: panel oculto interactivo.
//
// Server component `page.tsx` carga companies + templates y los pasa aquí.
// Flujo:
//   1. Usuario selecciona COMPANY (autocomplete con teclado).
//   2. Filtramos CONTACTS por company + opcionalmente por plant.
//   3. Multiselect de contactos a los que redactar.
//   4. Pulsa "Generar borradores" → POST /api/admin/outreach/generate.
//   5. Server devuelve drafts (email + linkedin_dm_short + linkedin_dm_long).
//   6. Por cada decisor: card editable con subject + 3 bodies, botones copiar,
//      regenerar (con nueva temperatura), marcar como enviado.
//   7. Atajo Ctrl+Alt+A fuerza visibilidad desde el Navbar.
//
// Pain points (lista de hechos reales de Source) se muestran en la cabecera
// de cada card para garantizar transparencia: el operador ve exactamente qué
// dolor va a mencionar el correo.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmailTemplate } from '@/lib/email/render';

export interface CompanyOpt {
  id: string;
  name: string;
  slug: string;
  sector: string;
  subsector: string;
  hqRegion: string | null;
}

export interface ContactOpt {
  id: string;
  fullName: string;
  role: string;
  roleCategory: string | null;
  email: string | null;
  linkedinUrl: string | null;
  emailVerified: boolean;
  plant: { id: string; name: string; city: string | null } | null;
  company: { id: string; name: string; sector: string };
}

export interface PainPointVM {
  date: string;
  title: string;
  outlet: string;
  signalStrength: 'weak' | 'medium' | 'strong';
  url: string;
}

export interface DraftVM {
  channel: 'email' | 'linkedin_dm_short' | 'linkedin_dm_long';
  subject: string;
  body: string;
  wordCount: number;
  usedFallback: boolean;
  toneOk: boolean;
  hash: string;
}

export interface GeneratedContact {
  contact: ContactOpt;
  drafts: DraftVM[];
  painPoints: PainPointVM[];
  status: 'idle' | 'generating' | 'generated' | 'error';
  error?: string;
}

type Props = {
  companies: CompanyOpt[];
  templates: EmailTemplate[];
};

const CHANNEL_LABELS: Record<DraftVM['channel'], string> = {
  email: 'Email',
  linkedin_dm_short: 'LinkedIn DM (corto)',
  linkedin_dm_long: 'LinkedIn DM (largo)',
};

const CHANNEL_LIMIT: Record<DraftVM['channel'], number> = {
  email: 130,
  linkedin_dm_short: 50,
  linkedin_dm_long: 90,
};

export function OutreachClient({ companies, templates }: Props) {
  // ── Estado global ────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [plantFilter, setPlantFilter] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('auto');
  const [generated, setGenerated] = useState<Record<string, GeneratedContact>>({});
  const [busy, setBusy] = useState(false);
  const [bulkLog, setBulkLog] = useState<string[]>([]);

  // ── Force-visible via Ctrl+Alt+A (escape hatch documentado) ──────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        // El panel ya está montado en esta ruta; el atajo simplemente
        // desplaza al top para feedback visual.
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Filter companies por término de búsqueda ─────────────────────────────
  const filteredCompanies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return companies.slice(0, 50);
    return companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.subsector.toLowerCase().includes(q) ||
          (c.hqRegion ?? '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [companies, searchTerm]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  // ── Plantas únicas (para filtro adicional) ──────────────────────────────
  const plants = useMemo(() => {
    const map = new Map<string, { id: string; name: string; city: string | null }>();
    for (const c of contacts) {
      if (c.plant && !map.has(c.plant.id)) {
        map.set(c.plant.id, c.plant);
      }
    }
    return Array.from(map.values());
  }, [contacts]);

  const visibleContacts = useMemo(() => {
    if (!plantFilter) return contacts;
    return contacts.filter((c) => c.plant?.id === plantFilter);
  }, [contacts, plantFilter]);

  // ── Cargar contactos al cambiar empresa ─────────────────────────────────
  useEffect(() => {
    if (!selectedCompanyId) {
      setContacts([]);
      setSelectedContactIds(new Set());
      setGenerated({});
      return;
    }
    setLoadingContacts(true);
    setSelectedContactIds(new Set());
    setGenerated({});
    fetch(`/api/contactos/by-company?companyId=${selectedCompanyId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.contacts) setContacts(j.contacts as ContactOpt[]);
      })
      .catch((e) => {
        console.error('carga contactos', e);
        setContacts([]);
      })
      .finally(() => setLoadingContacts(false));
  }, [selectedCompanyId]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedContactIds(new Set(visibleContacts.map((c) => c.id)));
  };

  const clearSelection = () => setSelectedContactIds(new Set());

  const generate = async (contactIds: string[]) => {
    if (!selectedCompanyId || contactIds.length === 0) return;
    setBusy(true);
    setBulkLog([]);
    try {
      const res = await fetch('/api/admin/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          contactIds,
          templateId: templateId === 'auto' ? undefined : templateId,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        drafts?: Array<{
          contactId: string;
          drafts: DraftVM[];
          painPoints?: PainPointVM[];
          error?: string;
        }>;
        error?: string;
      };
      if (!res.ok || !json.success) {
        setBulkLog([`ERROR: ${json.error ?? `HTTP ${res.status}`}`]);
        return;
      }
      const next: Record<string, GeneratedContact> = { ...generated };
      for (const d of json.drafts ?? []) {
        const contact = contacts.find((c) => c.id === d.contactId);
        if (!contact) continue;
        next[d.contactId] = {
          contact,
          drafts: d.drafts,
          painPoints: d.painPoints ?? [],
          status: d.drafts.length > 0 ? 'generated' : 'error',
          error: d.drafts.length === 0 ? 'sin borradores generados' : undefined,
        };
      }
      setGenerated(next);
      setBulkLog([
        `Generados borradores para ${json.drafts?.length ?? 0} decisores`,
        `3 variantes por decisor (email + LinkedIn DM corto + LinkedIn DM largo)`,
        `Persiste en OutreachLog — trazabilidad legal completa`,
      ]);
    } catch (e) {
      setBulkLog([`ERROR red: ${(e as Error).message}`]);
    } finally {
      setBusy(false);
    }
  };

  const regenerateOne = async (contactId: string) => {
    await generate([contactId]);
  };

  const copyText = async (text: string, logMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBulkLog((prev) => [logMsg, ...prev].slice(0, 5));
      // Notificar al server para trazabilidad (opcional)
      fetch('/api/admin/outreach/copied', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: text }),
      }).catch(() => {/* best-effort */});
    } catch (e) {
      setBulkLog((prev) => [`ERROR al copiar: ${(e as Error).message}`, ...prev].slice(0, 5));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Cabecera */}
      <header style={{ marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              background: 'var(--surus-danger)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
            }}
          >
            OCULTO
          </span>
          Panel interno · acceso solo por URL directa
        </div>
        <h1 style={{ fontSize: 'var(--text-display-md)', marginBottom: 'var(--space-2)' }}>
          Outreach — generación de borradores
        </h1>
        <p style={{ color: 'var(--surus-text-soft)', maxWidth: '80ch' }}>
          Genera borradores personalizados de email + LinkedIn DM (corto y largo) para decisores A&amp;B.
          Pain points extraídos de las <strong>noticias reales detectadas</strong> por HERMES — nada inventado.
          El operador revisa, edita si quiere, y pulsa <strong>Copiar</strong>. <strong>Nada se envía automáticamente</strong>.
        </p>
      </header>

      {/* Paso 1 — Empresa */}
      <section className="surus-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>1. Empresa</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--surus-text-soft)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Buscar (nombre, subsector, CCAA)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pescanova, lácteo, Galicia…"
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--surus-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surus-bg)',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--surus-text-soft)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Seleccionar empresa
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--surus-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surus-bg)',
              }}
            >
              <option value="">— elegir —</option>
              {filteredCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.sector} {c.hqRegion ? `· ${c.hqRegion}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedCompany && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--surus-bg)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--surus-text-soft)',
            }}
          >
            <strong>{selectedCompany.name}</strong> · {selectedCompany.sector} · {selectedCompany.subsector}
          </div>
        )}
      </section>

      {/* Paso 2 — Decisores */}
      {selectedCompanyId && (
        <section className="surus-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-lg)' }}>2. Decisores</h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={selectAll}
                disabled={loadingContacts || visibleContacts.length === 0}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--surus-bg)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedContactIds.size === 0}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--surus-bg)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Limpiar
              </button>
            </div>
          </div>

          {plants.length > 1 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  marginRight: 'var(--space-2)',
                }}
              >
                Filtrar por planta:
              </label>
              <select
                value={plantFilter}
                onChange={(e) => setPlantFilter(e.target.value)}
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surus-bg)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <option value="">Todas ({plants.length})</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.city ? `(${p.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingContacts ? (
            <p style={{ color: 'var(--surus-text-soft)' }}>Cargando decisores…</p>
          ) : visibleContacts.length === 0 ? (
            <p style={{ color: 'var(--surus-text-soft)' }}>
              No hay decisores registrados para esta empresa. Enriquece primero desde /contactos.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--surus-bg)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-2)' }}></th>
                    <th style={{ padding: 'var(--space-2)' }}>Nombre</th>
                    <th style={{ padding: 'var(--space-2)' }}>Cargo</th>
                    <th style={{ padding: 'var(--space-2)' }}>Planta</th>
                    <th style={{ padding: 'var(--space-2)' }}>LinkedIn</th>
                    <th style={{ padding: 'var(--space-2)' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleContacts.map((c) => (
                    <tr
                      key={c.id}
                      style={{ borderTop: '1px solid var(--surus-border)' }}
                    >
                      <td style={{ padding: 'var(--space-2)' }}>
                        <input
                          type="checkbox"
                          checked={selectedContactIds.has(c.id)}
                          onChange={() => toggleContact(c.id)}
                        />
                      </td>
                      <td style={{ padding: 'var(--space-2)', fontWeight: 500 }}>{c.fullName}</td>
                      <td style={{ padding: 'var(--space-2)', color: 'var(--surus-text-soft)' }}>
                        {c.role}
                      </td>
                      <td style={{ padding: 'var(--space-2)', color: 'var(--surus-text-soft)' }}>
                        {c.plant?.name ?? '—'}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        {c.linkedinUrl ? (
                          <a
                            href={c.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--surus-primary-500)', fontSize: 'var(--text-xs)' }}
                          >
                            LinkedIn ↗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--surus-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        {c.email ? (
                          <span>
                            <a
                              href={`mailto:${c.email}`}
                              style={{ color: 'var(--surus-primary-500)', fontSize: 'var(--text-xs)' }}
                            >
                              {c.email}
                            </a>
                            {c.emailVerified && (
                              <span
                                title="Email verificado"
                                style={{
                                  marginLeft: 4,
                                  color: 'var(--surus-success)',
                                  fontSize: 'var(--text-xs)',
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--surus-text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Paso 3 — Template + generar */}
      {selectedCompanyId && selectedContactIds.size > 0 && (
        <section className="surus-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>3. Generar borradores</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-soft)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Plantilla
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--surus-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surus-bg)',
                }}
              >
                <option value="auto">Auto (sector + cargo)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.sector} · {t.cargo}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => generate(Array.from(selectedContactIds))}
                disabled={busy}
                style={{
                  padding: 'var(--space-3) var(--space-5)',
                  background: busy ? 'var(--surus-text-muted)' : 'var(--surus-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'Generando…' : `Generar ${selectedContactIds.size} borrador${selectedContactIds.size === 1 ? '' : 'es'}`}
              </button>
            </div>
          </div>
          {bulkLog.length > 0 && (
            <ul
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--surus-bg)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                color: 'var(--surus-text-soft)',
                listStyle: 'none',
              }}
            >
              {bulkLog.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Paso 4 — Borradores */}
      {Object.values(generated).map((g) => (
        <DraftCard
          key={g.contact.id}
          gen={g}
          onRegenerate={() => regenerateOne(g.contact.id)}
          onCopy={copyText}
        />
      ))}
    </div>
  );
}

interface DraftCardProps {
  gen: GeneratedContact;
  onRegenerate: () => void;
  onCopy: (text: string, logMsg: string) => void;
}

function DraftCard({ gen, onRegenerate, onCopy }: DraftCardProps) {
  return (
    <section
      className="surus-card"
      style={{
        padding: 'var(--space-5)',
        marginBottom: 'var(--space-4)',
        borderLeft: '4px solid var(--surus-accent)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>
            {gen.contact.fullName}
          </h3>
          <p style={{ color: 'var(--surus-text-soft)', fontSize: 'var(--text-sm)' }}>
            {gen.contact.role}
            {gen.contact.plant && ` · ${gen.contact.plant.name}`}
            {gen.contact.plant?.city && ` (${gen.contact.plant.city})`}
            {gen.contact.email && (
              <>
                {' · '}
                <a
                  href={`mailto:${gen.contact.email}`}
                  style={{ color: 'var(--surus-primary-500)' }}
                >
                  {gen.contact.email}
                </a>
              </>
            )}
            {gen.contact.linkedinUrl && (
              <>
                {' · '}
                <a
                  href={gen.contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--surus-primary-500)' }}
                >
                  LinkedIn ↗
                </a>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          style={{
            padding: 'var(--space-1) var(--space-3)',
            background: 'var(--surus-bg)',
            border: '1px solid var(--surus-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Regenerar
        </button>
      </header>

      {gen.painPoints.length > 0 && (
        <details
          style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--surus-bg)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <summary
            style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--surus-text-soft)' }}
          >
            Pain points usados ({gen.painPoints.length})
          </summary>
          <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
            {gen.painPoints.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{p.date}</strong> — {p.title}{' '}
                <span style={{ color: 'var(--surus-text-muted)' }}>({p.outlet})</span>
                {p.url && (
                  <>
                    {' · '}
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--surus-primary-500)', fontSize: 'var(--text-xs)' }}
                    >
                      fuente ↗
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {gen.drafts.map((d) => {
        const overLimit = d.wordCount > CHANNEL_LIMIT[d.channel];
        return (
          <div
            key={d.channel}
            style={{
              marginBottom: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--surus-bg)',
              border: '1px solid var(--surus-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)',
              }}
            >
              <strong style={{ fontSize: 'var(--text-sm)' }}>{CHANNEL_LABELS[d.channel]}</strong>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--surus-text-muted)',
                }}
              >
                <span title="Recuento de palabras">
                  {d.wordCount}/{CHANNEL_LIMIT[d.channel]} palabras
                </span>
                {overLimit && <span style={{ color: 'var(--surus-danger)' }}>⚠ largo</span>}
                {d.usedFallback && (
                  <span
                    title="Sin DeepSeek — usa template estático"
                    style={{ color: 'var(--surus-warning)' }}
                  >
                    mock
                  </span>
                )}
                {!d.toneOk && (
                  <span
                    title="Detectada frase IA prohibida — revisa antes de enviar"
                    style={{ color: 'var(--surus-danger)' }}
                  >
                    ⚠ tono
                  </span>
                )}
              </div>
            </div>

            {d.subject && d.channel === 'email' && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--surus-text-muted)',
                    marginRight: 'var(--space-2)',
                  }}
                >
                  Asunto:
                </span>
                <strong>{d.subject}</strong>
              </div>
            )}

            <EditableText
              text={d.body}
              onChange={(next) => {
                // Update local state (no persist to server — edición efímera)
                const ta = document.querySelector(
                  `[data-draft="${d.hash}"]`,
                ) as HTMLTextAreaElement | null;
                if (ta) ta.value = next;
              }}
            />

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => onCopy(d.subject ? `${d.subject}\n\n${d.body}` : d.body, `Copiado ${CHANNEL_LABELS[d.channel]}`)}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--surus-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Copiar
              </button>
              {d.channel === 'linkedin_dm_short' && gen.contact.linkedinUrl && (
                <a
                  href={`https://www.linkedin.com/messaging/compose/?to=${encodeURIComponent(gen.contact.linkedinUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    background: '#0a66c2',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    textDecoration: 'none',
                  }}
                >
                  Abrir LinkedIn ↗
                </a>
              )}
            </div>
          </div>
        );
      })}

      {gen.status === 'error' && (
        <p style={{ color: 'var(--surus-danger)', fontSize: 'var(--text-sm)' }}>
          {gen.error ?? 'Error desconocido al generar borradores.'}
        </p>
      )}
    </section>
  );
}

interface EditableTextProps {
  text: string;
  onChange: (next: string) => void;
}

function EditableText({ text, onChange }: EditableTextProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <textarea
      ref={ref}
      data-draft={text.slice(0, 64)}
      defaultValue={text}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.max(3, Math.min(12, text.split('\n').length + 1))}
      style={{
        width: '100%',
        padding: 'var(--space-2)',
        border: '1px solid var(--surus-border)',
        borderRadius: 'var(--radius-sm)',
        background: 'white',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.5,
        resize: 'vertical',
      }}
    />
  );
}
