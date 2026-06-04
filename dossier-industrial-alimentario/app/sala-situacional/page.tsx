// app/sala-situacional/page.tsx — Sprint E.7
//
// Sala Situacional v1. Vista cronológica de la inteligencia detectada por HERMES.
// Regla del usuario 2026-06-04: "SE LEEN LOS MEDIOS Y SE HACE UN RESUMEN, SE DEBE
// GUARDAR LA FUENTE SIEMPRE". Por tanto:
//   - El `title` de la fuente (titular de la publicación) ES el resumen. Las
//     publicaciones ya escriben titulares descriptivos — eso cumple el resumen.
//   - La fuente (outlet + URL) se muestra SIEMPRE en cada tarjeta. Es el
//     anclaje de confianza del analista.
//   - Si la fuente se descarta, se guarda con `deimplantationSignal=false`
//     y `outOfScopeReason`. Nunca se borra (idempotencia Source).
//
// Ordenaciones disponibles (clicks sobre el chip):
//   - Compañía   → company.name asc
//   - Industria  → company.sector asc
//   - Cronología → publishedAt desc (default)
//   - Alerta     → deimplantationSignal desc, luego publishedAt desc
//   - Región     → company.hqRegion asc (fallback: plant.ccaa)
import { prisma } from '@/lib/db/prisma';
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';
import { labelDeIndustria } from '@/lib/industria';

export const dynamic = 'force-dynamic';

type SortKey = 'cronologia' | 'compania' | 'industria' | 'alerta' | 'region';

interface SearchParams {
  sort?: SortKey;
  signal?: 'in' | 'out' | 'all';
  industria?: string;
  ccaa?: string;
  q?: string;
}

const SORT_LABELS: Record<SortKey, string> = {
  cronologia: 'Cronología',
  compania: 'Compañía',
  industria: 'Industria',
  alerta: 'Tipo de alerta',
  region: 'Región (CCAA)',
};

const SECTOR_COLOR: Record<string, string> = {
  'Alimentos y Bebidas': '#c89b3c',
  Construccion: '#c47b00',
  Vehiculos: '#5a7da3',
  Maquinaria: '#134373',
  'Stock industrial': '#0a2540',
  'Equipamiento Medico Laboratorio Biotecnologia': '#1d6f42',
  'Propiedad Intelectual Marcas y Patentes': '#6c4ab6',
  Energia: '#b1342b',
  Patentes: '#7d8597',
  'Industria en General': '#5a5f6e',
};

async function getSalaData(params: SearchParams) {
  const where: Record<string, unknown> = {};
  if (params.signal === 'in') where.deimplantationSignal = true;
  if (params.signal === 'out') where.deimplantationSignal = false;
  if (params.industria) {
    where.company = { sector: params.industria };
  }
  if (params.ccaa) {
    // Filtrar por CCAA: company.hqRegion O plant.ccaa
    where.OR = [
      { company: { hqRegion: params.ccaa } },
      { plant: { ccaa: params.ccaa } },
    ];
  }
  if (params.q && params.q.trim().length > 0) {
    where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { outlet: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  const sort: SortKey = params.sort ?? 'cronologia';

  // Prisma no soporta orderBy sobre relations.name con nulls-first en todos
  // los casos, así que recuperamos un volumen y ordenamos en memoria. La ordenación
  // por cronología (la más común) se pasa a Prisma; el resto, en memoria.
  const orderBy: Record<string, 'asc' | 'desc'> | undefined =
    sort === 'cronologia' ? { publishedAt: 'desc' } : undefined;

  const raw = await prisma.source.findMany({
    where,
    ...(orderBy ? { orderBy } : {}),
    include: {
      company: { select: { id: true, slug: true, name: true, hqRegion: true, sector: true } },
      plant: { select: { id: true, name: true, city: true, ccaa: true } },
    },
    take: 300,
  });

  // Ordenación en memoria para los modos que no encajan en Prisma
  const sorted = [...raw].sort((a, b) => {
    switch (sort) {
      case 'compania': {
        const an = a.company?.name ?? 'zzz';
        const bn = b.company?.name ?? 'zzz';
        return an.localeCompare(bn, 'es');
      }
      case 'industria': {
        const as = a.company?.sector ?? 'zzz';
        const bs = b.company?.sector ?? 'zzz';
        if (as !== bs) return as.localeCompare(bs, 'es');
        // desempate por cronología desc
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
      }
      case 'alerta': {
        if (a.deimplantationSignal !== b.deimplantationSignal) {
          return a.deimplantationSignal ? -1 : 1; // true primero
        }
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
      }
      case 'region': {
        const ar = a.company?.hqRegion ?? a.plant?.ccaa ?? 'zzz';
        const br = b.company?.hqRegion ?? b.plant?.ccaa ?? 'zzz';
        if (ar !== br) return ar.localeCompare(br, 'es');
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
      }
      case 'cronologia':
      default: {
        return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
      }
    }
  });

  // Agrupar fuentes en "historias" — mismo company + plant (o, en su defecto,
  // mismo company + día). Esto da cumplimiento al brief 2026-06-04:
  // "SI HAY UNA NOTICIA QUE YA SE ENCONTRO DE UNA MARCA Y SEDE. Y LUEGO SALE
  // OTRO DIA OTRA NOTICIA LO QUE QUIERO ES QUE SE LLEVE EL HISTORICO DE TODAS
  // LAS NOTICIAS. O SI EN UN MISMO DIA SALEN EN VARIOS MEDIOS QUE SE RESEÑE
  // EN EL HISTORIAL".
  //
  // Estrategia: una historia = { storyKey, primary, history: [rest] }.
  //   - Si Source tiene companyId+plantId → key = `${companyId}|${plantId}`.
  //   - Si no, fallback: companyId + bucket diario (YYYY-MM-DD) — agrupa el
  //     mismo día en distintos medios.
  //   - Si no hay companyId, la Source es huérfana → su propia historia.
  const stories: Array<{
    key: string;
    primary: (typeof sorted)[number];
    history: Array<typeof sorted[number]>;
  }> = [];

  const dayBucket = (d: Date | null) => {
    if (!d) return 'no-date';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  const storyKeyOf = (s: (typeof sorted)[number]): string => {
    if (s.companyId && s.plantId) return `${s.companyId}|${s.plantId}`;
    if (s.companyId) return `${s.companyId}|${dayBucket(s.publishedAt)}`;
    return `orphan|${s.id}`;
  };

  const byKey = new Map<string, (typeof sorted)[number][]>();
  for (const s of sorted) {
    const k = storyKeyOf(s);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(s);
  }
  for (const [key, items] of byKey.entries()) {
    // primary = más reciente
    const primary = items[0];
    const history = items.slice(1);
    stories.push({ key, primary, history });
  }

  // Re-ordenar las historias por la fecha del primary (que es el orden que ya
  // traíamos de `sorted`). Como `sorted` está en orden, las stories que extrajimos
  // en iteración sobre sorted ya están en orden cronológico del primary.
  // (Esta es la propiedad que queremos mantener.)

  // Re-contadores: el grupo reduce el nº de tarjetas pero el conteo de fuentes
  // se mantiene.
  return { items: sorted, stories };
}

type SalaData = Awaited<ReturnType<typeof getSalaData>>;

async function getFilterOptions() {
  const [industrias, ccaas] = await Promise.all([
    prisma.company.findMany({
      where: { sector: { not: '' } },
      select: { sector: true },
      distinct: ['sector'],
    }),
    Promise.all([
      prisma.company.findMany({
        where: { hqRegion: { not: '' } },
        select: { hqRegion: true },
        distinct: ['hqRegion'],
      }),
      prisma.plant.findMany({
        where: { ccaa: { not: '' } },
        select: { ccaa: true },
        distinct: ['ccaa'],
      }),
    ]),
  ]);
  const companyCcaas = new Set(ccaas[0].map((r) => r.hqRegion).filter((r): r is string => Boolean(r)));
  for (const r of ccaas[1]) if (r.ccaa) companyCcaas.add(r.ccaa);
  return {
    industrias: industrias.map((r) => r.sector).filter((r): r is string => Boolean(r)).sort(),
    ccaas: [...companyCcaas].sort(),
  };
}

export default async function SalaSituacionalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort: SortKey = sp.sort ?? 'cronologia';
  const [{ items, stories }, opts] = await Promise.all([getSalaData(sp), getFilterOptions()]);
  const base = basePath();

  const inScope = items.filter((i) => i.deimplantationSignal).length;
  const outScope = items.length - inScope;
  const inScopeStories = stories.filter((s) => s.primary.deimplantationSignal).length;

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ margin: 0 }}>Sala situacional</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)', maxWidth: 720 }}>
            Inteligencia OSINT sobre desimplantaciones en grandes empresas españolas. Cada tarjeta
            agrupa el histórico de todas las fuentes que cubren la misma empresa y sede (mismo día
            en varios medios o sucesivas publicaciones en días posteriores). La fuente (medio + URL)
            está siempre visible para verificación. {items.length} fuentes en {stories.length}{' '}
            historias · {inScope} en alcance · {inScopeStories} historias en alcance · {outScope}{' '}
            fuera de alcance.
          </p>
        </header>

        {/* Ordenación */}
        <nav
          aria-label="Ordenar por"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-soft)', marginRight: 8 }}>
            Ordenar por:
          </span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
            const active = sort === k;
            const href = (() => {
              const qs = new URLSearchParams();
              if (sp.signal && sp.signal !== 'all') qs.set('signal', sp.signal);
              if (sp.industria) qs.set('industria', sp.industria);
              if (sp.ccaa) qs.set('ccaa', sp.ccaa);
              if (sp.q) qs.set('q', sp.q);
              qs.set('sort', k);
              return `${base}/sala-situacional?${qs.toString()}`;
            })();
            return (
              <a
                key={k}
                href={href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 'var(--text-xs)',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--surus-primary)' : 'var(--surus-surface)',
                  color: active ? 'white' : 'var(--surus-text)',
                  border: '1px solid var(--surus-border)',
                  textDecoration: 'none',
                }}
              >
                {SORT_LABELS[k]}
              </a>
            );
          })}
        </nav>

        {/* Filtros rápidos */}
        <form
          method="get"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-3)',
            background: 'var(--surus-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
          }}
        >
          <input type="hidden" name="sort" value={sort} />
          <label style={{ fontSize: 'var(--text-xs)' }}>
            <span style={{ display: 'block', color: 'var(--surus-text-soft)' }}>Buscar</span>
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Título o medio…"
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 'var(--text-xs)' }}>
            <span style={{ display: 'block', color: 'var(--surus-text-soft)' }}>Alerta</span>
            <select name="signal" defaultValue={sp.signal ?? 'all'} style={inputStyle}>
              <option value="all">Todas</option>
              <option value="in">En alcance</option>
              <option value="out">Fuera de alcance</option>
            </select>
          </label>
          <label style={{ fontSize: 'var(--text-xs)' }}>
            <span style={{ display: 'block', color: 'var(--surus-text-soft)' }}>Industria</span>
            <select name="industria" defaultValue={sp.industria ?? ''} style={inputStyle}>
              <option value="">Todas</option>
              {opts.industrias.map((s) => (
                <option key={s} value={s}>{labelDeIndustria(s)}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 'var(--text-xs)' }}>
            <span style={{ display: 'block', color: 'var(--surus-text-soft)' }}>CCAA</span>
            <select name="ccaa" defaultValue={sp.ccaa ?? ''} style={inputStyle}>
              <option value="">Todas</option>
              {opts.ccaas.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="submit" className="surus-btn surus-btn-primary" style={{ height: 34 }}>
              Aplicar
            </button>
            <a
              href={`${base}/sala-situacional?sort=${sort}`}
              className="surus-btn surus-btn-secondary"
              style={{ height: 34, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              Limpiar
            </a>
          </div>
        </form>

        {/* Tarjetas — agrupadas por historia (mismo company+plant, fallback mismo company+día) */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
          {stories.map((story) => {
            const s = story.primary;
            const sector = s.company?.sector;
            const color = (sector && SECTOR_COLOR[sector]) || 'var(--surus-text-muted)';
            const region = s.company?.hqRegion || s.plant?.ccaa || null;
            const historyCount = story.history.length;
            return (
              <li
                key={story.key}
                className="surus-card"
                style={{
                  borderLeft: `4px solid ${color}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 'var(--space-3)',
                  alignItems: 'start',
                }}
              >
                <div>
                  {/* Chips de meta */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginBottom: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      className={`surus-pill surus-pill-${s.deimplantationSignal ? 'success' : 'info'}`}
                      title={s.deimplantationSignal ? 'Marcada como desimplantación' : 'Fuera de alcance'}
                    >
                      {s.deimplantationSignal ? '⚑ En alcance' : '· Fuera de alcance'}
                    </span>
                    {sector && (
                      <span
                        className="surus-pill"
                        style={{ background: color, color: 'white' }}
                        title={`Industria: ${labelDeIndustria(sector)}`}
                      >
                        {labelDeIndustria(sector)}
                      </span>
                    )}
                    {region && (
                      <span className="surus-pill surus-pill-info">{region}</span>
                    )}
                    {s.outletType && (
                      <span className="surus-pill" style={{ background: 'var(--surus-bg)' }}>
                        {s.outletType}
                      </span>
                    )}
                    {historyCount > 0 && (
                      <span
                        className="surus-pill"
                        style={{ background: 'var(--surus-bg-elev)', color: 'var(--surus-text-soft)' }}
                        title={`Esta historia tiene ${historyCount + 1} fuentes en total`}
                      >
                        🗂 {historyCount + 1} fuentes
                      </span>
                    )}
                  </div>

                  {/* Resumen (titular del medio más reciente) */}
                  <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', lineHeight: 1.35, fontWeight: 600 }}>
                    <a
                      href={s.url.startsWith('http') ? s.url : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {s.title}
                    </a>
                  </h3>

                  {/* Atribución: empresa / sede / medio */}
                  <div
                    style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--surus-text-soft)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                    }}
                  >
                    {s.company && (
                      <span>
                        <strong style={{ color: 'var(--surus-text)' }}>Empresa:</strong>{' '}
                        <a href={`${base}/empresas/${s.company.slug}`}>{s.company.name}</a>
                      </span>
                    )}
                    {s.plant && (
                      <span>
                        <strong style={{ color: 'var(--surus-text)' }}>Sede:</strong> {s.plant.name}
                        {s.plant.city ? ` · ${s.plant.city}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Histórico de fuentes (mismo company+sede en distintos medios o días) */}
                  {historyCount > 0 && (
                    <details
                      style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--surus-bg-elev)',
                        border: '1px solid var(--surus-border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <summary
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--surus-text-soft)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          listStyle: 'none',
                        }}
                      >
                        Histórico de fuentes ({historyCount})
                      </summary>
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                        {[s, ...story.history].map((h) => (
                          <li
                            key={h.id}
                            style={{
                              fontSize: 'var(--text-xs)',
                              padding: '4px 0',
                              borderTop: '1px solid var(--surus-border)',
                              display: 'flex',
                              gap: 8,
                              alignItems: 'baseline',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ color: 'var(--surus-text-muted)' }}>
                              {h.publishedAt
                                ? new Date(h.publishedAt).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : '—'}
                            </span>
                            <strong>{h.outlet}</strong>
                            <a
                              href={h.url.startsWith('http') ? h.url : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--surus-primary)' }}
                            >
                              {h.title.length > 80 ? `${h.title.slice(0, 77)}…` : h.title} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Fuente del primary: siempre visible */}
                  <div
                    style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--surus-text-muted)',
                    }}
                  >
                    Fuente principal: <strong>{s.outlet}</strong> ·{' '}
                    <a
                      href={s.url.startsWith('http') ? s.url : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--surus-primary)' }}
                    >
                      abrir original ↗
                    </a>
                  </div>
                </div>

                <time
                  dateTime={s.publishedAt?.toISOString()}
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--surus-text-muted)',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                  title={s.publishedAt ? new Date(s.publishedAt).toLocaleString('es-ES') : 'Sin fecha'}
                >
                  {s.publishedAt
                    ? new Date(s.publishedAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </time>
              </li>
            );
          })}
          {stories.length === 0 && (
            <li
              className="surus-card"
              style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--surus-text-soft)' }}
            >
              No hay inteligencia con esos filtros. Ajusta o limpia los criterios.
            </li>
          )}
        </ul>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--surus-border)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-sm)',
  background: 'var(--surus-bg)',
  color: 'var(--surus-text)',
};
