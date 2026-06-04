// app/admin/sessions/SessionsClient.tsx — UI dashboard de sesiones.
'use client';

import { useState } from 'react';

interface SessionRow {
  id: string;
  userId: string;
  username: string;
  loginAt: string;
  logoutAt: string | null;
  durationSec: number | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  user: { id: string; username: string; displayName: string | null; role: string };
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} d`;
}

function browserFromUA(ua: string | null): string {
  if (!ua) return '—';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/curl/.test(ua)) return 'curl';
  if (/node-fetch/.test(ua)) return 'node';
  return ua.slice(0, 30);
}

export function SessionsClient({ initial }: { initial: SessionRow[] }) {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [q, setQ] = useState('');

  const filtered = initial.filter((s) => {
    if (filter === 'active' && s.logoutAt !== null) return false;
    if (q && !`${s.username} ${s.ip ?? ''} ${s.country ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const active = initial.filter((s) => s.logoutAt === null).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>Sesiones del panel</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--surus-text-muted)', margin: '4px 0 0' }}>
            {active} activas · {initial.length} totales
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario, IP…" style={{ ...inp, width: 240 }} />
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'active')} style={inp}>
            <option value="all">Todas</option>
            <option value="active">Solo activas</option>
          </select>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Usuario</th>
            <th style={th}>Login</th>
            <th style={th}>Logout</th>
            <th style={th}>Duración</th>
            <th style={th}>IP</th>
            <th style={th}>País</th>
            <th style={th}>Navegador / UA</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--surus-text-muted)' }}>Sin sesiones que coincidan con el filtro.</td></tr>
          )}
          {filtered.map((s) => (
            <tr key={s.id} style={{ background: s.logoutAt === null ? 'rgba(45, 138, 62, 0.04)' : undefined }}>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{s.user.displayName || s.username}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)' }}>@{s.username} · {s.user.role}</div>
              </td>
              <td style={td}>{new Date(s.loginAt).toLocaleString('es-ES')}</td>
              <td style={td}>{s.logoutAt ? new Date(s.logoutAt).toLocaleString('es-ES') : <span style={{ color: '#2d8a3e', fontWeight: 600 }}>● activa</span>}</td>
              <td style={td}>{fmtDuration(s.durationSec)}</td>
              <td style={td}><code style={{ fontSize: 'var(--text-xs)' }}>{s.ip ?? '—'}</code></td>
              <td style={td}>{s.country ?? <span style={{ color: 'var(--surus-text-muted)' }}>—</span>}</td>
              <td style={td}>
                <div>{browserFromUA(s.userAgent)}</div>
                {s.userAgent && <div style={{ fontSize: 11, color: 'var(--surus-text-muted)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.userAgent}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inp: React.CSSProperties = { padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--surus-border)', fontSize: 'var(--text-sm)' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', color: 'var(--surus-text-muted)', borderBottom: '1px solid var(--surus-border)' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--surus-border)', verticalAlign: 'top' };
