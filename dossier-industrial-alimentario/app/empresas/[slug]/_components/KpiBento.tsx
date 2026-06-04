// app/empresas/[slug]/_components/KpiBento.tsx — Bento editorial 4 celdas
// Facturación (grande) · EBITDA · Empleados · Deuda neta. Jerarquía visual intencional.
import type { Company } from '@prisma/client';
import { formatEur, formatInt } from '../_lib/types';

type Props = { company: Company };

export function KpiBento({ company }: Props) {
  return (
    <section className="empresa-section" aria-labelledby="kpi-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="kpi-heading">
            <span className="section-head-num">01</span>Métricas ejecutivas
          </h2>
          <span className="section-head-count">último ejercicio</span>
        </div>
        <div className="kpi-bento" role="list">
          <KpiCell
            label="Facturación"
            value={company.facturacionM}
            fmt={formatEur}
            foot={company.facturacionYear ? `Ejercicio ${company.facturacionYear}` : 'último cierre'}
            ariaLabel="Facturación anual en millones de euros"
            size="lg"
          />
          <KpiCell
            label="EBITDA"
            value={company.ebitdaM}
            fmt={formatEur}
            foot="último cierre"
            ariaLabel="EBITDA en millones de euros"
          />
          <KpiCell
            label="Empleados"
            value={company.empleadosTotal}
            fmt={(n) => (n == null ? '—' : formatInt(n))}
            foot="plantilla total"
            ariaLabel="Número total de empleados"
          />
          <KpiCell
            label="Deuda neta"
            value={company.deudaNetaM}
            fmt={formatEur}
            foot="pasivo financiero"
            ariaLabel="Deuda neta en millones de euros"
          />
        </div>
      </div>
    </section>
  );
}

type CellProps = {
  label: string;
  value: number | null | undefined;
  fmt: (n: number | null | undefined) => string;
  foot?: string;
  ariaLabel: string;
  size?: 'lg' | 'md';
};

function KpiCell({ label, value, fmt, foot, ariaLabel, size = 'md' }: CellProps) {
  return (
    <div className="kpi-card" role="listitem" aria-label={ariaLabel} data-size={size}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value == null ? '—' : fmt(value)}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}
