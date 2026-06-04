// app/empresas/[slug]/_components/AuctionGrid.tsx — Grid de subastas verificadas
import type { AuctionCheck } from '@prisma/client';
import { formatDate } from '../_lib/types';

type Props = { checks: AuctionCheck[] };

const PLATFORMS: { value: string; label: string }[] = [
  { value: 'Escrapalia', label: 'Escrapalia' },
  { value: 'Surplex', label: 'Surplex' },
  { value: 'Troostwijk', label: 'Troostwijk' },
  { value: 'GUTINVEST', label: 'GUTINVEST' },
  { value: 'HGP', label: 'HGP' },
  { value: 'Apex', label: 'Apex' },
  { value: 'CFT', label: 'CFT' },
  { value: 'Industrial Auctions', label: 'Industrial Auctions' },
  { value: 'Machineryline', label: 'Machineryline' },
];

export function AuctionGrid({ checks }: Props) {
  if (checks.length === 0) return null;

  // Indexar checks por plataforma
  const checkByPlatform = new Map(checks.map((c) => [c.platform, c]));

  // Mostrar al menos las 8 plataformas canónicas
  const toShow = PLATFORMS.map((p) => {
    const found = checkByPlatform.get(p.value);
    return found
      ? found
      : ({
          id: `missing-${p.value}`,
          companyId: '',
          companyName: '',
          platform: p.value,
          result: 'no_verificado' as const,
          details: 'Pendiente de verificación',
          checkedAt: new Date(0),
        } as unknown as AuctionCheck);
  });

  return (
    <section className="empresa-section" aria-labelledby="auction-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="auction-heading">
            <span className="section-head-num">06</span>Subastas verificadas
          </h2>
          <span className="section-head-count">{checks.length} checks · 9 plataformas en alcance</span>
        </div>
        <div className="auction-grid">
          {toShow.map((c) => (
            <article className="auction-card" key={c.id}>
              <h3 className="auction-platform">{c.platform}</h3>
              <span className="auction-result-pill" data-result={c.result}>
                {c.result.replace(/_/g, ' ')}
              </span>
              {c.details && <p style={{ color: 'var(--text-soft)', fontSize: 'var(--text-sm)', margin: 0 }}>{c.details}</p>}
              <span className="auction-meta">
                {c.checkedAt && c.checkedAt.getTime() > 0 ? `Verificado ${formatDate(c.checkedAt)}` : 'Sin verificar'}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
