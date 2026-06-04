// app/empresas/[slug]/_components/SourcesList.tsx — Lista numerada con outlet
import type { Source } from '@prisma/client';
import { formatDate, safeUrl } from '../_lib/types';

type Props = { sources: Source[] };

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function SourcesList({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <section className="empresa-section" aria-labelledby="sources-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="sources-heading">
            <span className="section-head-num">09</span>Fuentes scrapeadas
          </h2>
          <span className="section-head-count">{sources.length} URLs verificadas</span>
        </div>
        <ol className="sources-list">
          {sources.map((s) => {
            const u = safeUrl(s.url);
            return (
              <li key={s.id}>
                <div className="source-title">
                  {u ? <a href={u} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
                </div>
                <div className="source-meta" style={{ textAlign: 'left' }}>
                  {s.outlet} · {hostname(s.url)} · {formatDate(s.publishedAt)}
                </div>
                <div className="source-meta">{s.outletType}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
