// app/contactos/ContactosFilter.tsx — Client component con filtros por URL
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';

type Props = {
  roleCategories: { value: string; label: string }[];
  companies: { slug: string; name: string }[];
  currentRole: string;
  currentCompany: string;
  currentVerified: string;
  currentQ: string;
  currentPlant: string;
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    background: 'var(--surus-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--surus-border)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' },
  label: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--surus-text-soft)',
  },
  input: {
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--surus-bg)',
    border: '1px solid var(--surus-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--surus-text)',
    fontSize: 'var(--text-sm)',
  },
  actions: { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' },
  button: {
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--surus-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
  },
  reset: {
    padding: 'var(--space-2) var(--space-3)',
    background: 'transparent',
    color: 'var(--surus-text-soft)',
    border: '1px solid var(--surus-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
  },
};

export function ContactosFilter({
  roleCategories,
  companies,
  currentRole,
  currentCompany,
  currentVerified,
  currentQ,
  currentPlant,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(currentQ);
  const [plant, setPlant] = useState(currentPlant);

  const buildUrl = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      const qs = params.toString();
      return qs ? `/contactos?${qs}` : '/contactos';
    },
    [searchParams]
  );

  const handleApply = useCallback(() => {
    startTransition(() => router.push(buildUrl({ q, plant })));
  }, [router, buildUrl, q, plant]);

  const handleReset = useCallback(() => {
    setQ('');
    setPlant('');
    startTransition(() => router.push('/contactos'));
  }, [router]);

  const companyOptions = useMemo(
    () => [{ slug: '', name: 'Todas las empresas' }, ...companies],
    [companies]
  );

  return (
    <form
      style={styles.wrap}
      onSubmit={(e) => {
        e.preventDefault();
        handleApply();
      }}
    >
      <div style={styles.field}>
        <label style={styles.label} htmlFor="q">Buscar</label>
        <input
          id="q"
          style={styles.input}
          type="search"
          placeholder="Nombre, cargo o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label} htmlFor="plant">Planta</label>
        <input
          id="plant"
          style={styles.input}
          type="search"
          placeholder="Ej. Chapela, Alovera, Aldaia"
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label} htmlFor="role">Rol</label>
        <select
          id="role"
          style={styles.input}
          defaultValue={currentRole}
          onChange={(e) => startTransition(() => router.push(buildUrl({ role: e.target.value })))}
        >
          {roleCategories.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label} htmlFor="company">Empresa</label>
        <select
          id="company"
          style={styles.input}
          defaultValue={currentCompany}
          onChange={(e) => startTransition(() => router.push(buildUrl({ company: e.target.value })))}
        >
          {companyOptions.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label} htmlFor="verified">Verificación</label>
        <select
          id="verified"
          style={styles.input}
          defaultValue={currentVerified}
          onChange={(e) => startTransition(() => router.push(buildUrl({ verified: e.target.value })))}
        >
          <option value="">Todos</option>
          <option value="1">Sólo email verificado</option>
        </select>
      </div>

      <div style={styles.actions}>
        <button type="submit" style={styles.button} disabled={isPending}>
          {isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
        <button type="button" style={styles.reset} onClick={handleReset} disabled={isPending}>
          Limpiar
        </button>
      </div>
    </form>
  );
}
