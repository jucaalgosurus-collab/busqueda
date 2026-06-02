// app/layout.tsx — Root layout for /dossier/
import './globals.css';
import type { Metadata } from 'next';
import { basePath } from '@/lib/utils/base-path';

export const metadata: Metadata = {
  title: 'HERMES Dossier — A&B OSINT',
  description: 'Motor de inteligencia OSINT sobre desimplantaciones en grandes empresas A&B en España',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-base-path={basePath()}>
      <body>{children}</body>
    </html>
  );
}
