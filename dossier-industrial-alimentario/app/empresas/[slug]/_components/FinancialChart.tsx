// app/empresas/[slug]/_components/FinancialChart.tsx — Barras inversión/desinversión por año
import type { Financial } from '@prisma/client';

type Props = { financials: Financial[] };

const CATEGORY_LABELS: Record<string, string> = {
  investment: 'Inversión',
  divestment: 'Desinversión',
  capital_increase: 'Ampliación capital',
  debt_restructuring: 'Refinanciación',
  impairment: 'Sanamiento',
  revenue: 'Ingresos',
  ebitda: 'EBITDA',
};

const CATEGORY_COLORS: Record<string, string> = {
  investment: 'var(--success)',
  divestment: 'var(--danger)',
  capital_increase: 'var(--accent)',
  debt_restructuring: 'var(--info)',
  impairment: 'var(--danger)',
  revenue: 'var(--info)',
  ebitda: 'var(--accent)',
};

export function FinancialChart({ financials }: Props) {
  if (financials.length === 0) return null;

  // Agrupar por año
  const byYear = new Map<number, Financial[]>();
  for (const f of financials) {
    const arr = byYear.get(f.year) ?? [];
    arr.push(f);
    byYear.set(f.year, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  // Para barras apiladas, calculamos el total por año y el desglose por categoría
  type BarSlice = { cat: string; amount: number };
  const yearBars = years.map((y) => {
    const items = byYear.get(y)!;
    // Sumamos valores absolutos por categoría (positivos hacia arriba, negativos hacia abajo)
    const positives: BarSlice[] = [];
    const negatives: BarSlice[] = [];
    for (const f of items) {
      if (f.amountMeur >= 0) positives.push({ cat: f.category ?? 'investment', amount: f.amountMeur });
      else negatives.push({ cat: f.category ?? 'divestment', amount: Math.abs(f.amountMeur) });
    }
    return { year: y, positives, negatives, totalPos: positives.reduce((a, b) => a + b.amount, 0), totalNeg: negatives.reduce((a, b) => a + b.amount, 0) };
  });

  const maxAbs = Math.max(
    ...yearBars.map((b) => b.totalPos),
    ...yearBars.map((b) => b.totalNeg),
    1
  );

  // Categorías presentes (para leyenda)
  const presentCategories = new Set<string>();
  for (const f of financials) presentCategories.add(f.category ?? 'investment');

  return (
    <section className="empresa-section" aria-labelledby="fin-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="fin-heading">
            <span className="section-head-num">05</span>Flujos financieros
          </h2>
          <span className="section-head-count">{financials.length} movimientos · {years.length} años</span>
        </div>
        <div className="fin-shell">
          <div className="fin-bars" role="img" aria-label={`Gráfico de barras de inversión y desinversión por año, escala máxima ${maxAbs.toFixed(0)} millones de euros`}>
            {yearBars.map((b) => (
              <div className="fin-bar-wrap" key={b.year}>
                {/* Positivos (arriba) */}
                {b.positives.length > 0 && (
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: 1,
                    height: `${(b.totalPos / maxAbs) * 100}%`,
                    minHeight: 2,
                  }}>
                    {b.positives.map((s, i) => (
                      <div
                        key={i}
                        className="fin-bar"
                        data-cat={s.cat}
                        style={{
                          flex: s.amount,
                          background: CATEGORY_COLORS[s.cat] ?? 'var(--accent)',
                        }}
                        title={`${b.year} · ${CATEGORY_LABELS[s.cat] ?? s.cat} · ${s.amount.toFixed(1)} M€`}
                      >
                        <span className="fin-bar-amount">{s.amount.toFixed(0)}M</span>
                      </div>
                    ))}
                  </div>
                )}
                {b.negatives.length > 0 && (
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    height: `${(b.totalNeg / maxAbs) * 100}%`,
                    minHeight: 2,
                    marginTop: 2,
                  }}>
                    {b.negatives.map((s, i) => (
                      <div
                        key={`n${i}`}
                        className="fin-bar"
                        data-cat={s.cat}
                        style={{
                          flex: s.amount,
                          background: CATEGORY_COLORS[s.cat] ?? 'var(--danger)',
                        }}
                        title={`${b.year} · ${CATEGORY_LABELS[s.cat] ?? s.cat} · -${s.amount.toFixed(1)} M€`}
                      >
                        <span className="fin-bar-amount" style={{ top: '100%', bottom: 'auto', transform: 'translate(-50%, 4px)' }}>-{s.amount.toFixed(0)}M</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fin-year">{b.year}</div>
              </div>
            ))}
          </div>
          <div className="fin-legend" aria-label="Leyenda de categorías">
            {[...presentCategories].map((c) => (
              <span className="fin-legend-item" key={c}>
                <span className="fin-legend-dot" style={{ background: CATEGORY_COLORS[c] ?? 'var(--accent)' }} />
                {CATEGORY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
