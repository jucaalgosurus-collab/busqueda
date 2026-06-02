// app/mocr/page.tsx — Upload de documentos para clasificación MOCR
import { Navbar } from '@/components/Navbar';
import { prisma } from '@/lib/db/prisma';
import { basePath } from '@/lib/utils/base-path';
import { MocrUploadForm } from './MocrUploadForm';

export const dynamic = 'force-dynamic';

async function getRecentEvaluations() {
  return prisma.skillEvaluation.findMany({
    orderBy: { evaluatedAt: 'desc' },
    take: 20,
    include: {
      document: {
        include: { company: true },
      },
    },
  });
}

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--surus-success, #16a34a)',
  B: 'var(--surus-accent, #2563eb)',
  C: 'var(--surus-warning, #d97706)',
  D: 'var(--surus-danger, #dc2626)',
};

const KIND_LABEL: Record<string, string> = {
  nameplate: 'Placa de datos (nameplate)',
  certificate: 'Certificación (CE/ATEX/RETIE/NOM)',
  balance_sheet: 'Balance / cuenta de resultados',
  photo: 'Foto de activo',
};

const SKILL_LABEL: Record<string, string> = {
  'hermes-asset-valuation': 'Valoración de activos',
  'hermes-certifications': 'Certificaciones',
  'hermes-technical-audit': 'Auditoría técnica',
};

export default async function MocrPage() {
  const evaluations = await getRecentEvaluations();
  const base = basePath();

  return (
    <>
      <Navbar />
      <main className="surus-container" style={{ padding: 'var(--space-6) var(--space-5)' }}>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1>MOCR — Clasificación de documentos</h1>
          <p style={{ color: 'var(--surus-text-soft)', marginTop: 'var(--space-2)' }}>
            Sube una placa, certificado, balance o foto. Gemini Vision extrae especificaciones y asigna
            condición A/B/C/D.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) 2fr', gap: 'var(--space-5)' }}>
          <section className="surus-card">
            <h2 style={{ marginTop: 0 }}>Subir documento</h2>
            <MocrUploadForm apiBase={`${base}/api/mocr`} />
          </section>

          <section className="surus-card">
            <h2 style={{ marginTop: 0 }}>Últimas evaluaciones ({evaluations.length})</h2>
            {evaluations.length === 0 ? (
              <p style={{ color: 'var(--surus-text-soft)' }}>
                Aún no hay evaluaciones. Sube el primer documento.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {evaluations.map((ev) => {
                  const findings = (ev.findings as unknown) as string[] | null;
                  return (
                    <li
                      key={ev.id}
                      style={{
                        padding: 'var(--space-3) 0',
                        borderBottom: '1px solid var(--surus-border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          marginBottom: 'var(--space-1)',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            background:
                            GRADE_COLOR[ev.grade as keyof typeof GRADE_COLOR] ??
                            'var(--surus-text-soft)',
                            color: 'white',
                            textAlign: 'center',
                            lineHeight: '36px',
                            fontWeight: 700,
                            fontSize: 'var(--text-md)',
                          }}
                        >
                          {ev.grade}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {ev.document.company?.name ?? 'Sin empresa'} ·{' '}
                            <span style={{ color: 'var(--surus-text-soft)', fontWeight: 400 }}>
                              {KIND_LABEL[ev.document.kind] ?? ev.document.kind}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                            {SKILL_LABEL[ev.skill] ?? ev.skill} · score {ev.score}/100 ·{' '}
                            {new Date(ev.evaluatedAt).toLocaleString('es-ES')}
                          </div>
                        </div>
                      </div>
                      {findings && findings.length > 0 && (
                        <ul
                          style={{
                            margin: 'var(--space-2) 0 0 48px',
                            padding: 0,
                            listStyle: 'disc',
                            color: 'var(--surus-text-soft)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {findings.slice(0, 3).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
