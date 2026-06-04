// app/empresas/[slug]/_components/Hero.tsx — Hero editorial full-bleed
// Display serif 96px+, semántica de status, jerarquía tipográfica intencional.
import type { Company } from '@prisma/client';
import { basePath } from '@/lib/utils/base-path';

type Props = {
  company: Company;
  plantCount: number;
  contactCount: number;
  operationCount: number;
};

export function Hero({ company, plantCount, contactCount, operationCount }: Props) {
  const base = basePath();
  return (
    <header className="hero">
      <div className="empresa-container">
        <a className="hero-back" href={`${base}/empresas`}>
          <span aria-hidden="true">←</span> Empresas
        </a>
        <div className="hero-meta">
          {company.sector && <span className="hero-meta-item">{company.sector}</span>}
          {company.subsector && <span className="hero-meta-item">{company.subsector}</span>}
          {company.cnae && <span className="hero-meta-item">CNAE {company.cnae}</span>}
          {company.parentGroup && <span className="hero-meta-item">{company.parentGroup}</span>}
        </div>
        <h1 className="hero-name">{company.name}</h1>
        <p className="hero-subsector">
          {company.hqCity || '—'}{company.hqRegion ? `, ${company.hqRegion}` : ''}
          <span className="hero-subsector-sep" aria-hidden="true">·</span>
          <em>{plantCount}</em> plantas
          <span className="hero-subsector-sep" aria-hidden="true">·</span>
          <em>{operationCount}</em> operaciones detectadas
        </p>
        <div className="hero-footer">
          <span className="tier-badge" title={`Tier ${company.tier}`}>{company.tier}</span>
          <span className="status-badge" data-status={company.status}>
            <span className="status-dot" aria-hidden="true" />
            {company.status === 'active' ? 'Vigilancia activa' : 'Inactiva'}
          </span>
          {company.cif && (
            <span className="hero-pill" data-variant="mono">CIF {company.cif}</span>
          )}
          {contactCount > 0 && (
            <span className="hero-pill">
              <em>{contactCount}</em>&nbsp;contactos enriquecidos
            </span>
          )}
        </div>
      </div>
      <div className="hero-rule" aria-hidden="true" />
    </header>
  );
}
