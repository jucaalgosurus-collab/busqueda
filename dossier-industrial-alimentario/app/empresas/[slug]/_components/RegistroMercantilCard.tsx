// app/empresas/[slug]/_components/RegistroMercantilCard.tsx — Sprint C.1
// Server component. Muestra datos de registro mercantil de la empresa
// (CIF, CNAE, domicilio, capital social) + los 5 últimos eventos BORME
// relevantes. Si la empresa no tiene eventos, muestra mensaje informativo
// (caso habitual al inicio del backfill).
import type { BormeEvent } from '@prisma/client';
import { formatDate } from '../_lib/types';

type Props = {
  cif: string | null;
  cnae: string | null;
  hqCity: string | null;
  hqRegion: string | null;
  events: Pick<BormeEvent, 'id' | 'tipo' | 'fecha' | 'bormeId' | 'capital' | 'domicilio' | 'fuente'>[];
};

const TIPO_LABELS: Record<string, string> = {
  constitucion: 'Constitución',
  cambio_domicilio: 'Cambio de domicilio',
  ampliacion_capital: 'Ampliación de capital',
  reduccion_capital: 'Reducción de capital',
  escision: 'Escisión',
  cuentas: 'Depósito de cuentas',
  consejo: 'Modificación de consejo',
  disolucion: 'Disolución',
  cese: 'Cese de administrador',
  nombramiento: 'Nombramiento de administrador',
  reeleccion: 'Reelección',
  transformacion: 'Transformación societaria',
  fusion_absorcion: 'Fusión por absorción',
  modificacion_estatutos: 'Modificación de estatutos',
  extincion: 'Extinción',
  declaracion_concurso: 'Declaración de concurso',
};

export function RegistroMercantilCard({ cif, cnae, hqCity, hqRegion, events }: Props) {
  return (
    <section className="surus-card" aria-labelledby="registro-mercantil-heading">
      <header className="surus-card__header">
        <h2 id="registro-mercantil-heading" className="surus-card__title">
          Registro Mercantil
        </h2>
        <p className="surus-card__subtitle">
          Datos oficiales del BORME (últimos 365 días)
        </p>
      </header>

      <dl className="registro-mercantil__grid">
        <div className="registro-mercantil__field">
          <dt>CIF</dt>
          <dd>{cif ?? <span className="registro-mercantil__empty">Sin datos</span>}</dd>
        </div>
        <div className="registro-mercantil__field">
          <dt>CNAE</dt>
          <dd>{cnae ?? <span className="registro-mercantil__empty">Sin datos</span>}</dd>
        </div>
        <div className="registro-mercantil__field">
          <dt>Domicilio social</dt>
          <dd>
            {hqCity || hqRegion
              ? `${hqCity ?? ''}${hqCity && hqRegion ? ', ' : ''}${hqRegion ?? ''}`
              : <span className="registro-mercantil__empty">Sin datos</span>}
          </dd>
        </div>
        <div className="registro-mercantil__field">
          <dt>Eventos BORME (365d)</dt>
          <dd>
            {events.length > 0 ? (
              <span className="surus-pill surus-pill--info">{events.length}</span>
            ) : (
              <span className="registro-mercantil__empty">Sin eventos</span>
            )}
          </dd>
        </div>
      </dl>

      {events.length > 0 ? (
        <ol className="registro-mercantil__events">
          {events.slice(0, 5).map((ev) => (
            <li key={ev.id} className="registro-mercantil__event">
              <div className="registro-mercantil__event-header">
                <span className="surus-pill surus-pill--ghost">
                  {TIPO_LABELS[ev.tipo] ?? ev.tipo}
                </span>
                <time dateTime={ev.fecha.toISOString().slice(0, 10)} className="registro-mercantil__event-date">
                  {formatDate(ev.fecha)}
                </time>
              </div>
              {ev.capital && (
                <p className="registro-mercantil__event-detail">
                  <strong>Capital:</strong> {ev.capital} €
                </p>
              )}
              {ev.domicilio && (
                <p className="registro-mercantil__event-detail">
                  <strong>Domicilio:</strong> {ev.domicilio}
                </p>
              )}
              <a
                href={ev.fuente}
                target="_blank"
                rel="noopener noreferrer"
                className="registro-mercantil__event-link"
              >
                {ev.bormeId} ↗
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="registro-mercantil__no-events">
          No hay eventos BORME registrados para esta empresa en los últimos 365 días.
          El backfill de C.1 puede estar en curso o la empresa no ha publicado actos mercantiles en este periodo.
        </p>
      )}
    </section>
  );
}
