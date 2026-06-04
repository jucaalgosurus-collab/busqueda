// app/admin/login/page.tsx — E.10: login con username + password.
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get('next') ?? '/admin';
  const [username, setUsername] = useState('jucaalgo');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error ?? 'Error de login');
        return;
      }
      // Si debe cambiar contraseña, redirigir a pantalla específica
      if (j.data?.mustChangePassword) {
        router.push('/admin-public/account?first=1');
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1828 0%, #1a3458 100%)',
        padding: 'var(--space-5)',
      }}
    >
      <form
        onSubmit={onSubmit}
        className="surus-card"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <span style={{ fontSize: 'var(--text-2xl)' }}>🛡️</span>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Panel de control</h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', margin: 0 }}>
              Acceso restringido · HERMES Dossier
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(196, 60, 60, 0.08)',
              border: '1px solid rgba(196, 60, 60, 0.3)',
              color: '#a02d2d',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 'var(--space-4)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Usuario</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--surus-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-base)',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--surus-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-base)',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: 'var(--surus-primary)',
            color: 'white',
            border: 'none',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', marginTop: 'var(--space-4)', textAlign: 'center' }}>
          ¿No tienes cuenta? Contacta con un administrador.
        </p>
      </form>
    </div>
  );
}
