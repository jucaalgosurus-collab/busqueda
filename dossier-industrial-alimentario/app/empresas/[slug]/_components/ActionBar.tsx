// app/empresas/[slug]/_components/ActionBar.tsx — Barra de acciones flotante
// Sticky bar: copiar enlace, exportar CSV, refrescar, soft-delete, top, prev/next.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { basePath } from '@/lib/utils/base-path';

type Props = {
  slug: string;
  companyName: string;
  prevSlug?: string | null;
  nextSlug?: string | null;
  contactCount: number;
  sourceCount: number;
  operationCount: number;
};

type Toast = { kind: 'ok' | 'err'; msg: string } | null;

export function ActionBar({
  slug,
  companyName,
  prevSlug,
  nextSlug,
  contactCount,
  sourceCount,
  operationCount,
}: Props) {
  const router = useRouter();
  const base = basePath();
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<'copy' | 'export' | 'delete' | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 2200);
  }

  async function copyLink() {
    setBusy('copy');
    try {
      const url = window.location.href;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      flash('ok', 'Enlace copiado al portapapeles');
    } catch (e: unknown) {
      flash('err', e instanceof Error ? `Error al copiar: ${e.message}` : 'Error al copiar');
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    setBusy('export');
    try {
      const url = `${base}/api/contactos/export.csv?company=${encodeURIComponent(slug)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      flash('ok', `Exportando ${contactCount} contactos`);
    } catch (e: unknown) {
      flash('err', e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      window.setTimeout(() => setBusy(null), 600);
    }
  }

  async function softDelete() {
    const confirmed = window.confirm(
      `¿Marcar "${companyName}" como inactiva?\n\n` +
        `Esto oculta la ficha de los listados pero NO borra los datos.\n` +
        `Podrás revertirlo reactivando la empresa.`
    );
    if (!confirmed) return;
    setBusy('delete');
    try {
      const res = await fetch(`${base}/api/empresas/${slug}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      flash('ok', 'Empresa marcada como inactiva');
      window.setTimeout(() => router.push(`${base}/empresas`), 800);
    } catch (e: unknown) {
      flash('err', e instanceof Error ? e.message : 'Error al inactivar');
    } finally {
      setBusy(null);
    }
  }

  function jumpTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const stats = `${contactCount} contactos · ${sourceCount} fuentes · ${operationCount} ops`;

  return (
    <>
      <aside className="action-bar" role="toolbar" aria-label="Acciones de la ficha">
        <div className="action-bar-left">
          <a
            href={`${base}/empresas`}
            className="action-bar-back"
            aria-label="Volver al listado de empresas"
          >
            ← Listado
          </a>
          <span className="action-bar-sep" aria-hidden="true">/</span>
          <span className="action-bar-slug" title={companyName}>
            {companyName}
          </span>
        </div>

        <div className="action-bar-stats" title={stats} aria-label="Resumen de la ficha">
          <span className="action-bar-stat" data-stat="contacts">
            <span className="action-bar-stat-num">{contactCount}</span>
            <span className="action-bar-stat-lbl">contactos</span>
          </span>
          <span className="action-bar-sep" aria-hidden="true">·</span>
          <span className="action-bar-stat" data-stat="sources">
            <span className="action-bar-stat-num">{sourceCount}</span>
            <span className="action-bar-stat-lbl">fuentes</span>
          </span>
          <span className="action-bar-sep" aria-hidden="true">·</span>
          <span className="action-bar-stat" data-stat="ops">
            <span className="action-bar-stat-num">{operationCount}</span>
            <span className="action-bar-stat-lbl">ops</span>
          </span>
        </div>

        <div className="action-bar-right">
          {prevSlug && (
            <a
              href={`${base}/empresas/${prevSlug}`}
              className="action-bar-btn"
              aria-label="Empresa anterior"
              title="Empresa anterior"
            >
              ‹
            </a>
          )}
          {nextSlug && (
            <a
              href={`${base}/empresas/${nextSlug}`}
              className="action-bar-btn"
              aria-label="Empresa siguiente"
              title="Empresa siguiente"
            >
              ›
            </a>
          )}

          <button
            type="button"
            className="action-bar-btn"
            onClick={copyLink}
            disabled={busy === 'copy'}
            aria-label="Copiar enlace a esta ficha"
            title="Copiar enlace"
          >
            {busy === 'copy' ? '…' : '⧉'}
          </button>

          <button
            type="button"
            className="action-bar-btn"
            onClick={exportCsv}
            disabled={busy === 'export' || contactCount === 0}
            aria-label="Exportar contactos a CSV"
            title={contactCount === 0 ? 'Sin contactos para exportar' : 'Exportar contactos a CSV'}
          >
            {busy === 'export' ? '…' : '↓'}
          </button>

          <button
            type="button"
            className="action-bar-btn"
            onClick={() => router.refresh()}
            aria-label="Refrescar datos"
            title="Refrescar"
          >
            ↻
          </button>

          <button
            type="button"
            className="action-bar-btn action-bar-btn-danger"
            onClick={softDelete}
            disabled={busy === 'delete'}
            aria-label="Marcar empresa como inactiva"
            title="Inactivar empresa (soft-delete)"
          >
            {busy === 'delete' ? '…' : '⊘'}
          </button>
        </div>
      </aside>

      {showTop && mounted && (
        <button
          type="button"
          className="action-bar-top"
          onClick={jumpTop}
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          ↑
        </button>
      )}

      <div
        className={`action-bar-toast${toast ? ` is-visible is-${toast.kind}` : ''}`}
        role="status"
        aria-live="polite"
      >
        {toast?.msg}
      </div>
    </>
  );
}
