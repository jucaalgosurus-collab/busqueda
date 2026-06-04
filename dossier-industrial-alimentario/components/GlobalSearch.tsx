// components/GlobalSearch.tsx — Sprint E.8
// Modal de búsqueda global con ⌘K / Ctrl-K. Busca empresas, sedes y sectores.
// Server-friendly: trigger button en Navbar, dialog se abre client-side.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Hit {
  kind: 'empresa' | 'sede' | 'sector';
  href: string;
  title: string;
  subtitle?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl-K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus input al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQ('');
      setHits([]);
      setActiveIdx(0);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!open || q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = (await r.json()) as { success: boolean; data?: { hits: Hit[] } };
        setHits(j.data?.hits ?? []);
        setActiveIdx(0);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (hit: Hit) => {
    setOpen(false);
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[activeIdx]) {
      e.preventDefault();
      go(hits[activeIdx]);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir búsqueda global (Ctrl+K)"
        title="Buscar empresas, sedes, sectores (⌘K / Ctrl-K)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.18)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        🔍 Buscar
        <span style={{ opacity: 0.6, fontSize: 10 }}>⌘K</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'grid',
        placeItems: 'start center',
        paddingTop: '12vh',
      }}
    >
      <div
        style={{
          width: 'min(640px, 92vw)',
          background: 'var(--surus-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
          border: '1px solid var(--surus-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--surus-border)',
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar empresa, sede o sector…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              background: 'transparent',
              color: 'var(--surus-text)',
              fontFamily: 'inherit',
            }}
          />
          {loading && <span style={{ fontSize: 12, opacity: 0.6 }}>buscando…</span>}
          <kbd style={{ fontSize: 10, opacity: 0.6, padding: '2px 6px', background: 'var(--surus-bg-elev)', borderRadius: 4 }}>esc</kbd>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {q.length < 2 ? (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--surus-text-soft)' }}>
              Escribe al menos 2 caracteres. Tip: pulsa <kbd>↑</kbd> <kbd>↓</kbd> para navegar, <kbd>Enter</kbd> para ir.
            </div>
          ) : hits.length === 0 && !loading ? (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--surus-text-soft)' }}>
              Sin resultados para «{q}».
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {hits.map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => go(h)}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: i === activeIdx ? 'var(--surus-bg-elev)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontFamily: 'inherit',
                      color: 'var(--surus-text)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: kindColor(h.kind).bg,
                        color: kindColor(h.kind).fg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 700,
                        minWidth: 60,
                        textAlign: 'center',
                      }}
                    >
                      {h.kind}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.title}
                      </div>
                      {h.subtitle && (
                        <div style={{ fontSize: 12, color: 'var(--surus-text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.subtitle}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.4 }}>↵</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            borderTop: '1px solid var(--surus-border)',
            fontSize: 11,
            color: 'var(--surus-text-soft)',
            background: 'var(--surus-bg-elev)',
          }}
        >
          <span>Empresa · Sede · Sector</span>
          <span>{hits.length > 0 ? `${activeIdx + 1} / ${hits.length}` : ''}</span>
        </div>
      </div>
    </div>
  );
}

function kindColor(kind: Hit['kind']): { bg: string; fg: string } {
  if (kind === 'empresa') return { bg: 'var(--surus-primary-soft, #e3f2fd)', fg: 'var(--surus-primary)' };
  if (kind === 'sede') return { bg: 'var(--surus-success-soft, #d4edda)', fg: '#1b5e20' };
  return { bg: 'var(--surus-warning-soft, #fff3cd)', fg: '#856404' };
}
