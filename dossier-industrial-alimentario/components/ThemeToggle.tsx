// components/ThemeToggle.tsx — QW-3 toggle dark/light.
// Client component: lee localStorage SOLO en useEffect (SSR-safe).
// Persiste en `localStorage.theme` con valores 'light' | 'dark'.
// Si no hay nada guardado, respeta `prefers-color-scheme` del sistema.

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
  return 'dark';
  }
  return 'light';
}

export function ThemeToggle() {
  // Empezamos con 'light' para que el SSR/hidratación coincida siempre.
  // El script anti-FOUC del layout ya pintó el tema correcto antes del primer paint,
  // así que en cuanto se monta el componente leemos el DOM real.
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(readInitialTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage puede estar deshabilitado (modo privado extremo) — no rompemos la UX.
    }
  }

  // Antes de montar pintamos el icono neutro (Sun) para no chocar con el SSR.
  // Tras montar, reflejamos el estado real.
  const Icon = mounted && theme === 'dark' ? Sun : Moon;
  const label = mounted && theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
