'use client';
// app/empresas/[slug]/_components/DeepDiveCard.tsx — Análisis IA ejecutivo
// Sprint UI.2 — Genera resumen con DeepSeek → Gemini fallback
import { useEffect, useState } from 'react';
import { basePath } from '@/lib/utils/base-path';

interface DeepDiveResponse {
  company: { slug: string; name: string };
  analysis: string;
  provider: string;
  model: string;
  grounded: boolean;
  sources: Array<{ url: string; title?: string }>;
  generatedAt: string;
}

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: DeepDiveResponse;
  error?: string;
}

export function DeepDiveCard({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(`${basePath()}/api/empresas/${slug}/deep-dive`)
      .then(async (r) => {
        if (!r.ok) {
          const errBody = await r.json().catch(() => ({}));
          throw new Error(errBody.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<DeepDiveResponse>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: 'error', error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <section
      style={{
        padding: 'var(--space-5)',
        background: 'var(--surus-surface, #f8fafc)',
        border: '1px solid var(--surus-border, #e2e8f0)',
        borderRadius: 'var(--radius-lg, 8px)',
        marginTop: 'var(--space-5)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg, 1.25rem)' }}>
          Deep Dive IA
        </h2>
        {state.data && (
          <small style={{ color: 'var(--surus-text-soft, #64748b)' }}>
            {state.data.provider} · {state.data.model}
            {state.data.grounded ? ' · grounding' : ''}
          </small>
        )}
      </header>

      {state.status === 'loading' && (
        <p style={{ color: 'var(--surus-text-soft, #64748b)' }}>
          Generando análisis ejecutivo…
        </p>
      )}

      {state.status === 'error' && (
        <p style={{ color: 'var(--surus-error, #dc2626)' }}>
          Error: {state.error}
        </p>
      )}

      {state.status === 'ready' && state.data && (
        <>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontSize: 'var(--text-sm, 0.95rem)',
            }}
          >
            {state.data.analysis}
          </div>
          {state.data.sources.length > 0 && (
            <details style={{ marginTop: 'var(--space-3)' }}>
              <summary
                style={{ cursor: 'pointer', color: 'var(--surus-text-soft, #64748b)' }}
              >
                Fuentes ({state.data.sources.length})
              </summary>
              <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
                {state.data.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--surus-accent, #0ea5e9)' }}
                    >
                      {s.title ?? s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
