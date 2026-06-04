// app/empresas/[slug]/_components/FinancialsCard.tsx — Sprint C.2
// Server component. Muestra los KPIs financieros de la empresa extraídos
// de Wikipedia (facturación, empleados, EBITDA, beneficio neto).
// Si todos los KPIs están null, muestra mensaje informativo.
// Si al menos 1 KPI existe, muestra los que hay + link a la fuente Wikipedia.

type Props = {
  facturacionM: number | null;
  facturacionYear: number | null;
  ebitdaM: number | null;
  beneficioNetoM: number | null;
  empleadosTotal: number | null;
  fuente: string | null; // URL de Wikipedia (outletType='financial')
};

function formatMillions(value: number | null): string {
  if (value === null) return 'Sin datos';
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
}

function formatNumber(value: number | null): string {
  if (value === null) return 'Sin datos';
  return value.toLocaleString('es-ES');
}

export function FinancialsCard({
  facturacionM,
  facturacionYear,
  ebitdaM,
  beneficioNetoM,
  empleadosTotal,
  fuente,
}: Props) {
  const hasAnyData =
    facturacionM !== null ||
    facturacionYear !== null ||
    ebitdaM !== null ||
    beneficioNetoM !== null ||
    empleadosTotal !== null;

  return (
    <section className="surus-card" aria-labelledby="financials-heading">
      <header className="surus-card__header">
        <h2 id="financials-heading" className="surus-card__title">
          Datos financieros
        </h2>
        <p className="surus-card__subtitle">
          {fuente
            ? <>Fuente: <a href={fuente} target="_blank" rel="noopener noreferrer">Wikipedia (es) ↗</a></>
            : 'Fuente: Wikipedia (es)'}
        </p>
      </header>

      {hasAnyData ? (
        <dl className="financials__grid">
          <div className="financials__field">
            <dt>Facturación</dt>
            <dd>
              {formatMillions(facturacionM)}
              {facturacionYear !== null && (
                <span className="financials__year"> ({facturacionYear})</span>
              )}
            </dd>
          </div>
          <div className="financials__field">
            <dt>Empleados</dt>
            <dd>{formatNumber(empleadosTotal)}</dd>
          </div>
          <div className="financials__field">
            <dt>EBITDA</dt>
            <dd>{formatMillions(ebitdaM)}</dd>
          </div>
          <div className="financials__field">
            <dt>Beneficio neto</dt>
            <dd>{formatMillions(beneficioNetoM)}</dd>
          </div>
        </dl>
      ) : (
        <p className="financials__empty">
          Wikipedia no tiene datos financieros estructurados para esta empresa todavía.
          El backfill de C.2 puede estar en curso o la empresa no aparece en Wikipedia en español.
        </p>
      )}

      {fuente && (
        <p className="financials__note">
          <small>
            Datos referenciales de Wikipedia; pueden no reflejar el último ejercicio fiscal.
            Para datos auditados, consultar cuentas anuales en el Registro Mercantil o CNMV.
          </small>
        </p>
      )}
    </section>
  );
}
