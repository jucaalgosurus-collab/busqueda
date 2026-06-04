// app/empresas/[slug]/_components/DocumentsGrid.tsx — Grid de PDFs + imágenes
import type { Document } from '@prisma/client';
import { basePath } from '@/lib/utils/base-path';
import { formatDate } from '../_lib/types';

type Props = {
  documents: (Document & { evaluations: { skill: string; grade: string | null; score: number | null }[] })[];
};

const KIND_LABELS: Record<string, string> = {
  pdf: 'PDF',
  logo: 'Logo',
  hero: 'Imagen corporativa',
  plant_photo: 'Foto de planta',
  nameplate: 'Placa de datos',
  certificate: 'Certificado',
  balance_sheet: 'Balance',
  photo: 'Foto',
  press_release: 'Comunicado',
};

const KIND_ICONS: Record<string, string> = {
  pdf: '◫',
  logo: '◆',
  hero: '▣',
  plant_photo: '▥',
  nameplate: '⌗',
  certificate: '✦',
  balance_sheet: '⌘',
  photo: '▦',
  press_release: '✉',
};

export function DocumentsGrid({ documents }: Props) {
  const base = basePath();
  if (documents.length === 0) {
    return (
      <section className="empresa-section" aria-labelledby="docs-heading">
        <div className="empresa-container">
          <div className="section-head">
            <h2 className="section-head-title" id="docs-heading">
              <span className="section-head-num">09</span>Documentos
            </h2>
            <span className="section-head-count">0 adjuntos</span>
          </div>
          <div className="empresa-empty">
            <p>Sin documentos adjuntos todavía. Usa el botón <em>Subir documento</em> para añadir PDFs (EINF, certificados) o fotos (plantas, placas).</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="empresa-section" aria-labelledby="docs-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="docs-heading">
            <span className="section-head-num">09</span>Documentos
          </h2>
          <span className="section-head-count">{documents.length} adjuntos</span>
        </div>
        <div className="docs-grid">
          {documents.map((d) => {
            const ext = d.fileName.split('.').pop()?.toLowerCase() ?? '';
            const isImage = d.mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
            const ocrOk = d.ocrConfidence != null && d.ocrConfidence >= 0.7;
            return (
              <article className="doc-card" key={d.id} data-kind={d.kind}>
                <div className="doc-thumb" aria-hidden="true">
                  {isImage ? (
                    <img src={`${base}${d.fileUrl}`} alt="" loading="lazy" />
                  ) : (
                    <div className="doc-thumb-fallback">
                      <span className="doc-thumb-icon">{KIND_ICONS[d.kind] ?? '◫'}</span>
                      <span className="doc-thumb-ext">{ext.toUpperCase() || 'FILE'}</span>
                    </div>
                  )}
                </div>
                <div className="doc-body">
                  <div className="doc-kind">{KIND_LABELS[d.kind] ?? d.kind}</div>
                  <h3 className="doc-name" title={d.fileName}>{d.fileName}</h3>
                  <div className="doc-meta">
                    {d.fileSize != null && <span>{Math.round(d.fileSize / 1024)} KB</span>}
                    <span>{formatDate(d.uploadedAt)}</span>
                  </div>
                  {d.evaluations.length > 0 && (
                    <div className="doc-evals">
                      {d.evaluations.map((e, i) => (
                        <span key={i} className="doc-eval" data-grade={e.grade ?? '?'}>
                          {e.skill} · {e.grade ?? '—'}{e.score != null && ` (${e.score})`}
                        </span>
                      ))}
                    </div>
                  )}
                  {d.ocrText && (
                    <details className="doc-ocr">
                      <summary>OCR · {ocrOk ? 'alta confianza' : 'revisar'} ({Math.round((d.ocrConfidence ?? 0) * 100)}%)</summary>
                      <pre>{d.ocrText.slice(0, 600)}{d.ocrText.length > 600 && '…'}</pre>
                    </details>
                  )}
                </div>
                <div className="doc-actions">
                  <a
                    href={`${base}${d.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-action"
                  >
                    Abrir ↗
                  </a>
                  {d.externalUrl && (
                    <a
                      href={d.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-action"
                    >
                      Original ↗
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
