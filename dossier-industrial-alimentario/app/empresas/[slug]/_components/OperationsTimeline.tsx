// app/empresas/[slug]/_components/OperationsTimeline.tsx — Timeline cronológico
import type { Operation, TimelineEvent } from '@prisma/client';
import { formatDate, formatInt, safeUrl } from '../_lib/types';

type OpWithPlant = Operation & { plant: { name: string; id: string } | null };
type EventWithPlant = TimelineEvent & { plant: { name: string; id: string } | null };
type Props = {
  operations: OpWithPlant[];
  events: EventWithPlant[];
};

const TYPE_LABELS: Record<string, string> = {
  plant_closure: 'Cierre de planta',
  line_closure: 'Cierre de línea',
  ERE: 'ERE / Despidos',
  plant_sale: 'Venta de planta',
  relocation: 'Relocalización',
  investment: 'Inversión',
  divestment: 'Desinversión',
  biomass_plant: 'Planta biomasa',
  warehouse: 'Almacén',
  decommissioning: 'Desmantelamiento',
  acquisition: 'Adquisición',
  concurso_acreedores: 'Concurso acreedores',
  subasta: 'Subasta',
};

export function OperationsTimeline({ operations, events }: Props) {
  if (operations.length === 0 && events.length === 0) return null;

  // Mezcla operaciones y eventos en un solo feed cronológico
  type Item =
    | { kind: 'op'; date: Date; op: OpWithPlant }
    | { kind: 'event'; date: Date; ev: EventWithPlant };

  const items: Item[] = [
    ...operations.map<Item>((op) => ({ kind: 'op', date: op.announcedAt, op })),
    ...events.map<Item>((ev) => ({ kind: 'event', date: ev.date, ev })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <section className="empresa-section" aria-labelledby="ops-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="ops-heading">
            <span className="section-head-num">04</span>Operaciones detectadas
          </h2>
          <span className="section-head-count">{operations.length} ops · {events.length} eventos</span>
        </div>
        <div className="timeline" role="list">
          {items.map((it, idx) => {
            if (it.kind === 'op') {
              const op = it.op;
              const sourceUrl = safeUrl(op.sourceUrl);
              return (
                <div className="timeline-item" role="listitem" key={`op-${op.id}`}>
                  <div className="timeline-date">{formatDate(it.date)}</div>
                  <h3 className="timeline-title">
                    <span className="timeline-type">{TYPE_LABELS[op.type] ?? op.type}</span>
                    {op.title}
                  </h3>
                  {op.description && <p className="timeline-desc">{op.description}</p>}
                  <div className="timeline-impact">
                    {op.plant && <span>Planta: <strong>{op.plant.name}</strong></span>}
                    {op.amountMeur != null && <span> · Importe: <strong>{op.amountMeur.toFixed(1)} M€</strong></span>}
                    {op.jobsAffected != null && <span> · Empleos: <strong>{formatInt(op.jobsAffected)}</strong></span>}
                    {sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Fuente ↗</a></>}
                  </div>
                </div>
              );
            } else {
              const ev = it.ev;
              const sourceUrl = safeUrl(ev.sourceUrl);
              return (
                <div className="timeline-item" role="listitem" key={`ev-${ev.id}`}>
                  <div className="timeline-date">{formatDate(it.date)}</div>
                  <h3 className="timeline-title">{ev.title}</h3>
                  {ev.description && <p className="timeline-desc">{ev.description}</p>}
                  <div className="timeline-impact">
                    {ev.plant && <span>Planta: <strong>{ev.plant.name}</strong></span>}
                    {ev.impact && <span> · {ev.impact}</span>}
                    {sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Fuente ↗</a></>}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </section>
  );
}
