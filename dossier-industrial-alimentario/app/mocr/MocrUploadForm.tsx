// app/mocr/MocrUploadForm.tsx — Client component for the MOCR upload form
'use client';

import { useState, useTransition } from 'react';

interface ApiResponse {
  success?: boolean;
  grade?: 'A' | 'B' | 'C' | 'D';
  score?: number;
  findings?: string[];
  manufacturer?: string;
  model?: string;
  certType?: string;
  error?: string;
}

const KINDS = [
  { value: 'nameplate', label: 'Placa de datos' },
  { value: 'certificate', label: 'Certificación' },
  { value: 'balance_sheet', label: 'Balance / PyG' },
  { value: 'photo', label: 'Foto de activo' },
] as const;

export function MocrUploadForm({ apiBase }: { apiBase: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('nameplate');
  const [companySlug, setCompanySlug] = useState('');
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setResult({ error: 'Selecciona un archivo primero' });
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    if (companySlug.trim()) formData.append('companySlug', companySlug.trim());

    startTransition(async () => {
      setResult(null);
      try {
        const r = await fetch(apiBase, { method: 'POST', body: formData });
        const json = (await r.json()) as ApiResponse;
        if (!r.ok) {
          setResult({ error: json.error ?? `HTTP ${r.status}` });
          return;
        }
        setResult(json);
      } catch (err) {
        setResult({ error: (err as Error).message });
      }
    });
  };

  const gradeColor: Record<string, string> = {
    A: 'var(--surus-success, #16a34a)',
    B: 'var(--surus-accent, #2563eb)',
    C: 'var(--surus-warning, #d97706)',
    D: 'var(--surus-danger, #dc2626)',
  };

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-1)',
          }}
        >
          Archivo (PDF, JPG, PNG)
        </label>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={pending}
          required
        />
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-1)',
          }}
        >
          Tipo de documento
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          disabled={pending}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
          }}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-1)',
          }}
        >
          Slug empresa (opcional)
        </label>
        <input
          type="text"
          placeholder="ej. pescanova"
          value={companySlug}
          onChange={(e) => setCompanySlug(e.target.value)}
          disabled={pending}
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surus-border)',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={pending || !file}
        className="surus-btn surus-btn-primary"
        style={{ width: '100%' }}
      >
        {pending ? 'Clasificando…' : 'Clasificar con MOCR'}
      </button>

      {result && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: result.error
              ? 'rgba(220,38,38,0.08)'
              : 'rgba(22,163,74,0.08)',
            border: `1px solid ${result.error ? 'var(--surus-danger, #dc2626)' : 'var(--surus-success, #16a34a)'}`,
          }}
        >
          {result.error ? (
            <strong style={{ color: 'var(--surus-danger, #dc2626)' }}>Error: {result.error}</strong>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: gradeColor[result.grade ?? 'D'] ?? 'var(--surus-text-soft)',
                    color: 'white',
                    textAlign: 'center',
                    lineHeight: '40px',
                    fontWeight: 700,
                    fontSize: 'var(--text-md)',
                  }}
                >
                  {result.grade}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    Condición {result.grade} — score {result.score}/100
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-soft)' }}>
                    {result.manufacturer && `Fabricante: ${result.manufacturer}`}
                    {result.model && ` · Modelo: ${result.model}`}
                    {result.certType && `Cert: ${result.certType}`}
                  </div>
                </div>
              </div>
              {result.findings && result.findings.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--text-sm)' }}>
                  {result.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}
