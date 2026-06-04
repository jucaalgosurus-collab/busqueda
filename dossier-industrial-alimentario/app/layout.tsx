// app/layout.tsx — Root layout for /dossier/
import './globals.css';
import type { Metadata } from 'next';
import { basePath } from '@/lib/utils/base-path';

export const metadata: Metadata = {
  title: 'HERMES Dossier — A&B OSINT',
  description: 'Motor de inteligencia OSINT sobre desimplantaciones en grandes empresas A&B en España',
};

// QW-3 — Anti-FOUC theme script. Runs synchronously before first paint
// to apply the saved `data-theme` from localStorage. Without this, users
// with `theme=dark` saved would see a white flash on every page load.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else{if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-base-path={basePath()}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <footer
          style={{
            borderTop: '1px solid var(--surus-border, #e2e8f0)',
            padding: 'var(--space-4) var(--space-5)',
            marginTop: 'var(--space-8)',
            textAlign: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--surus-text-soft, #64748b)',
            background: 'var(--surus-surface, #f8fafc)',
          }}
        >
          <strong style={{ color: 'var(--surus-primary, #0f172a)' }}>HERMES Dossier</strong>
          {' '}· Creado por{' '}
          <strong style={{ color: 'var(--surus-primary, #0f172a)' }}>Juan Carlos Alvarado</strong>
          {' '}para{' '}
          <strong style={{ color: 'var(--surus-accent, #0ea5e9)' }}>Surus Inversa</strong>
          {' '}· A&amp;B OSINT España · 2026
        </footer>
      </body>
    </html>
  );
}
