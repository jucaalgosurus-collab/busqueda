// app/admin/users/UsersClient.tsx — UI de gestión de usuarios.
'use client';

import { useState } from 'react';

interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  _count: { sessions: number };
}

export function UsersClient({ initial, me }: { initial: UserRow[]; me: { id: string; username: string; role: string } }) {
  const [users, setUsers] = useState<UserRow[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function reload() {
    const r = await fetch('/api/admin/users');
    if (r.ok) {
      const j = await r.json();
      setUsers(j.data);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, mustChangePassword: true }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'Error');
        return;
      }
      setShowCreate(false);
      setForm({ username: '', displayName: '', password: '', role: 'user' });
      setToast(`Usuario '${j.data.username}' creado. Deberá cambiar la contraseña al primer login.`);
      setTimeout(() => setToast(null), 4000);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (r.ok) {
      setToast(u.isActive ? `Usuario '${u.username}' desactivado` : `Usuario '${u.username}' reactivado`);
      setTimeout(() => setToast(null), 3000);
      await reload();
    }
  }

  async function changeRole(u: UserRow, role: string) {
    if (u.id === me.id && role !== 'admin') {
      setError('No puedes quitarte el rol admin a ti mismo');
      return;
    }
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (r.ok) {
      setToast(`Rol de '${u.username}' → ${role}`);
      setTimeout(() => setToast(null), 3000);
      await reload();
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>Usuarios del panel</h1>
        <button onClick={() => setShowCreate((s) => !s)} style={btnPrimary}>{showCreate ? 'Cancelar' : '+ Nuevo usuario'}</button>
      </div>

      {toast && <div style={toastOk}>{toast}</div>}
      {error && <div style={toastErr}>{error}</div>}

      {showCreate && (
        <form onSubmit={onCreate} className="surus-card" style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <label><span style={lbl}>Username</span>
            <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inp} placeholder="usuario.empresa" />
          </label>
          <label><span style={lbl}>Nombre</span>
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={inp} placeholder="Juan Pérez" />
          </label>
          <label><span style={lbl}>Contraseña inicial</span>
            <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inp} placeholder="≥8 caracteres" />
          </label>
          <label><span style={lbl}>Rol</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inp}>
              <option value="user">user (solo cambia su contraseña)</option>
              <option value="admin">admin (control total)</option>
            </select>
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={busy} style={btnPrimary}>{busy ? 'Creando…' : 'Crear usuario'}</button>
          </div>
        </form>
      )}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Usuario</th>
            <th style={th}>Rol</th>
            <th style={th}>Estado</th>
            <th style={th}>Último login</th>
            <th style={th}>Sesiones</th>
            <th style={th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{u.username}{u.id === me.id && <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>(tú)</span>}</div>
                {u.displayName && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>{u.displayName}</div>}
              </td>
              <td style={td}>
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ ...inp, padding: '4px 8px' }} disabled={u.id === me.id}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td style={td}>
                {u.isActive ? <span style={{ color: '#2d8a3e' }}>● Activo</span> : <span style={{ color: '#a02d2d' }}>○ Inactivo</span>}
                {u.mustChangePassword && u.isActive && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-warning)' }}>⚠ debe cambiar pass</div>}
              </td>
              <td style={td}>
                {u.lastLoginAt ? (
                  <>
                    <div>{new Date(u.lastLoginAt).toLocaleString('es-ES')}</div>
                    {u.lastLoginIp && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>IP: {u.lastLoginIp}</div>}
                  </>
                ) : <span style={{ color: 'var(--surus-text-muted)' }}>—</span>}
              </td>
              <td style={td}>{u._count.sessions}</td>
              <td style={td}>
                <button onClick={() => toggleActive(u)} disabled={u.id === me.id} style={btnGhost}>{u.isActive ? 'Desactivar' : 'Reactivar'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: 'var(--surus-primary)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--surus-primary)', border: '1px solid var(--surus-border)', padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', cursor: 'pointer' };
const inp: React.CSSProperties = { width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--surus-border)', fontSize: 'var(--text-sm)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', borderBottom: '1px solid var(--surus-border)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--surus-border)', verticalAlign: 'top' };
const toastOk: React.CSSProperties = { background: 'rgba(45, 138, 62, 0.1)', color: '#2d8a3e', border: '1px solid rgba(45, 138, 62, 0.3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' };
const toastErr: React.CSSProperties = { background: 'rgba(196, 60, 60, 0.08)', color: '#a02d2d', border: '1px solid rgba(196, 60, 60, 0.3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' };
