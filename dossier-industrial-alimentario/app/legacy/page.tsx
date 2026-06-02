// app/legacy/page.tsx — Iframe a la presentación HTML original preservada
import { Navbar } from '@/components/Navbar';
import { basePath } from '@/lib/utils/base-path';

export default function LegacyPage() {
  const base = basePath();
  // Legacy HTML servido por nginx directamente desde /opt/hermes-dossier/legacy/
  return (
    <>
      <Navbar />
      <main style={{ padding: 'var(--space-4)' }}>
        <div
          style={{
            background: 'var(--surus-bg-elev)',
            border: '1px solid var(--surus-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            color: 'var(--surus-text-soft)',
          }}
        >
          ⚠️ Vista legacy de la v2.1 (presentación interactiva). Preservada para referencia histórica.
          Sprint 1 — <code>/opt/hermes-dossier/legacy/PRESENTACION-INTERACTIVA.html</code>
        </div>
        <iframe
          src={`${base}/legacy-raw/PRESENTACION-INTERACTIVA.html`}
          style={{
            width: '100%',
            height: 'calc(100vh - 200px)',
            border: '1px solid var(--surus-border)',
            borderRadius: 'var(--radius-md)',
            background: 'white',
          }}
          title="Legacy Presentación Interactiva"
        />
      </main>
    </>
  );
}
