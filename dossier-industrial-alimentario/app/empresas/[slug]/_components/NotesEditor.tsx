// app/empresas/[slug]/_components/NotesEditor.tsx — Editor de notas + acciones de empresa
// Panel unificado: textarea, autor, submit, y acciones de admin (refrescar, soft-delete).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Note } from '@prisma/client';
import { basePath } from '@/lib/utils/base-path';
import { formatDate } from '../_lib/types';

type Props = { slug: string; notes: Note[] };

export function NotesEditor({ slug, notes: initialNotes }: Props) {
  const router = useRouter();
  const base = basePath();
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('anónimo');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error' | 'saved'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus('saving');
    setErrorMsg(null);
    try {
      const res = await fetch(`${base}/api/empresas/${slug}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, author }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setStatus('saved');
      setBody('');
      router.refresh();
      setTimeout(() => setStatus('idle'), 1800);
    } catch (e: unknown) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido');
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Marcar "${slug}" como inactiva (soft-delete)?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/api/empresas/${slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push(`${base}/empresas`);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="empresa-section" aria-labelledby="notes-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="notes-heading">
            <span className="section-head-num">09</span>Notas internas
          </h2>
          <span className="section-head-count">{initialNotes.length} registradas</span>
        </div>
        <form className="notes-shell" onSubmit={submit}>
          <textarea
            className="notes-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Anotación interna: contexto, leads, próximos pasos… (sin auth, queda registrado)"
            aria-label="Cuerpo de la nota"
            required
            minLength={2}
            rows={4}
          />
          <div className="notes-toolbar">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              aria-label="Autor"
              placeholder="Autor"
              className="notes-author"
            />
            <div className="notes-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push(`${base}/empresas`)}
              >
                ← Volver
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.refresh()}
              >
                Refrescar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={busy}
              >
                Inactivar
              </button>
              <span className="notes-status" aria-live="polite">
                {status === 'saving' && 'Guardando…'}
                {status === 'saved' && 'Guardado ✓'}
                {status === 'error' && (errorMsg ?? 'Error')}
                {status === 'idle' && `${body.length} caracteres`}
              </span>
              <button type="submit" className="btn btn-primary" disabled={status === 'saving' || !body.trim()}>
                Añadir nota
              </button>
            </div>
          </div>
        </form>
        {initialNotes.length > 0 && (
          <div className="notes-list">
            {initialNotes.slice(0, 20).map((n) => (
              <article className="note-card" key={n.id}>
                <div className="note-meta">{formatDate(n.createdAt)} · {n.author}</div>
                <div className="note-body">{n.body}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
