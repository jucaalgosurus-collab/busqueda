// app/admin/account/page.tsx — E.10: cuenta propia (cambiar contraseña obligatoria en primer login).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next1, setNext1] = useState('');
  const [next2, setNext2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next1.length < 8) {
      setError('La nueva contraseña debe tener ≥8 caracteres');
      return;
    }
    if (next1 !== next2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next1 }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error ?? 'Error');
        return;
      }
      router.push('/admin');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surus-bg)', padding: 'var(--space-5)' }}>
      <form onSubmit={onSubmit} className="surus-card" style={{ width: '100%', maxWidth: 460, background: 'white', padding: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', margin: '0 0 var(--space-3)' }}>Cambiar contraseña</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-muted)', margin: '0 0 var(--space-5)' }}>
          Es tu primer inicio de sesión. Por seguridad, cambia la contraseña temporal.
        </p>
        {error && (
          <div style={{ background: 'rgba(196, 60, 60, 0.08)', color: '#a02d2d', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}
        <label style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Contraseña actual</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 'var(--radius-md)', border: '1px solid var(--surus-border)' }} />
        </label>
        <label style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Nueva contraseña (≥8)</span>
          <input type="password" value={next1} onChange={(e) => setNext1(e.target.value)} required style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 'var(--radius-md)', border: '1px solid var(--surus-border)' }} />
        </label>
        <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Repite la nueva</span>
          <input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} required style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 'var(--radius-md)', border: '1px solid var(--surus-border)' }} />
        </label>
        <button type="submit" disabled={loading} style={{ width: '100%', background: 'var(--surus-primary)', color: 'white', border: 'none', padding: 12, borderRadius: 'var(--radius-md)', fontSize: 'var(--text-base)', fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}
