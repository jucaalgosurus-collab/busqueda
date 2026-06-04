// app/admin/_components/AdminGate.tsx — E.10: gate de entrada al panel admin
//
// El secret se guarda en localStorage y se envía en cada fetch al panel como
// header `x-admin-secret`. NO usamos cookies httpOnly porque el panel corre
// sobre el mismo dominio que la app pública y queremos que el secret no se
// filtre a otros paths — localStorage está scoped a este origin.
'use client';

import { useState } from 'react';

export function AdminGate({ onAuth }: { onAuth: (secret: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (v.length < 8) {
      setError('El secreto debe tener al menos 8 caracteres');
      return;
    }
    setError(null);
    onAuth(v);
  }

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <form
        onSubmit={onSubmit}
        className="surus-card surus-fade-in"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-2xl)' }}>🛡️</span>
          <h2 style={{ margin: 0, color: 'var(--surus-primary)' }}>Panel de control</h2>
        </div>
        <p style={{ color: 'var(--surus-text-soft)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          Introduce el secreto de administrador para acceder a la edición de empresas y sedes.
        </p>
        <label
          htmlFor="admin-secret"
          style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-2)' }}
        >
          Secreto
        </label>
        <input
          id="admin-secret"
          name="secret"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••••"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--surus-border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-base)',
            marginBottom: 'var(--space-3)',
          }}
        />
        {error && (
          <div
            role="alert"
            style={{
              background: 'var(--surus-pill-danger-bg, #fdecea)',
              color: 'var(--surus-danger)',
              fontSize: 'var(--text-sm)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          className="surus-button"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Acceder
        </button>
      </form>
    </div>
  );
}
