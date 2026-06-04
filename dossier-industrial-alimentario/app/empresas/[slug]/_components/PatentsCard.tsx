// app/empresas/[slug]/_components/PatentsCard.tsx — Sprint C.3
// Server component. Muestra la cartera de patentes OEPM de la empresa.
// Datos de Patent (modelo Prisma) — 4 KPIs (granted/pending/expired) + lista top 5.

type PatentLite = {
  publicationNumber: string;
  title: string;
  legalStatus: 'granted' | 'pending' | 'expired' | 'withdrawn' | 'unknown';
  publicationDate: Date | null;
  filingDate: Date | null;
  applicant: string | null;
  cnae: string | null;
  sourceUrl: string;
};

type Props = {
  patents: PatentLite[];
};

const STATUS_LABEL: Record<PatentLite['legalStatus'], string> = {
  granted: 'Concedida',
  pending: 'Pendiente',
  expired: 'Caducada',
  withdrawn: 'Retirada',
  unknown: 'Desconocido',
};

const STATUS_COLOR: Record<PatentLite['legalStatus'], string> = {
  granted: 'patent-status--granted',
  pending: 'patent-status--pending',
  expired: 'patent-status--expired',
  withdrawn: 'patent-status--withdrawn',
  unknown: 'patent-status--unknown',
};

function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function PatentsCard({ patents }: Props) {
  const counts = {
    granted: patents.filter((p) => p.legalStatus === 'granted').length,
    pending: patents.filter((p) => p.legalStatus === 'pending').length,
    expired: patents.filter((p) => p.legalStatus === 'expired').length,
  };
  const total = patents.length;
  const top = patents.slice(0, 5);

  return (
    <section className="surus-card" aria-labelledby="patents-heading">
      <header className="surus-card__header">
        <h2 id="patents-heading" className="surus-card__title">
          Cartera de patentes
        </h2>
        <p className="surus-card__subtitle">
          Fuente:{' '}
          <a
            href="https://invenes.oepm.es/buscador/"
            target="_blank"
            rel="noopener noreferrer"
          >
            OEPM Invenes ↗
          </a>
        </p>
      </header>

      {total === 0 ? (
        <p className="patents__empty">
          OEPM Invenes no tiene patentes registradas a nombre de esta empresa todavía.
          El backfill de C.3 puede estar en curso o la empresa no figura como titular.
        </p>
      ) : (
        <>
          <dl className="patents__counters">
            <div className="patents__counter">
              <dt>Total</dt>
              <dd>{total}</dd>
            </div>
            <div className="patents__counter patents__counter--granted">
              <dt>Concedidas</dt>
              <dd>{counts.granted}</dd>
            </div>
            <div className="patents__counter patents__counter--pending">
              <dt>Pendientes</dt>
              <dd>{counts.pending}</dd>
            </div>
            <div className="patents__counter patents__counter--expired">
              <dt>Caducadas</dt>
              <dd>{counts.expired}</dd>
            </div>
          </dl>

          <ol className="patents__list">
            {top.map((p) => (
              <li key={p.publicationNumber} className="patents__item">
                <div className="patents__item-header">
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="patents__item-number"
                  >
                    {p.publicationNumber} ↗
                  </a>
                  <span className={`patent-status ${STATUS_COLOR[p.legalStatus]}`}>
                    {STATUS_LABEL[p.legalStatus]}
                  </span>
                </div>
                <p className="patents__item-title">{p.title}</p>
                <p className="patents__item-meta">
                  {p.filingDate && (
                    <span>Solicitada: {formatDate(p.filingDate)}</span>
                  )}
                  {p.publicationDate && (
                    <span> · Publicada: {formatDate(p.publicationDate)}</span>
                  )}
                  {p.cnae && <span> · CIP {p.cnae}</span>}
                </p>
              </li>
            ))}
          </ol>

          {total > top.length && (
            <p className="patents__more">
              Mostrando {top.length} de {total}. Ver todas en OEPM Invenes.
            </p>
          )}

          <p className="patents__note">
            <small>
              Datos públicos de la OEPM. Patentes concedidas = señal positiva (I+D activa
              en la empresa). Pendientes en examen también son indicador de inversión
              continua. Caducadas pueden reflejar tecnologías obsoletas, no desimplantación.
            </small>
          </p>
        </>
      )}
    </section>
  );
}
