'use client';
// app/_components/SectorContext.tsx — Sector global state (R-09)
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const SECTORS = [
  { id: 'all', label: 'Todos los sectores', cnaePrefixes: [] },
  { id: 'alimentacion', label: 'Alimentación (CNAE 10)', cnaePrefixes: ['10'] },
  { id: 'bebidas', label: 'Bebidas (CNAE 11)', cnaePrefixes: ['11'] },
  { id: 'energia', label: 'Energía', cnaePrefixes: ['05', '06', '07', '08', '09', '19', '35'] },
  { id: 'quimica', label: 'Química (CNAE 20)', cnaePrefixes: ['20'] },
  { id: 'construccion', label: 'Construcción (CNAE 41-43)', cnaePrefixes: ['41', '42', '43'] },
  { id: 'banca', label: 'Banca y finanzas', cnaePrefixes: ['64', '65', '66'] },
  { id: 'defensa', label: 'Defensa (CNAE 25.4)', cnaePrefixes: ['25.4'] },
] as const;

export type SectorId = (typeof SECTORS)[number]['id'];

const STORAGE_KEY = 'hermes.sector';

interface SectorContextValue {
  sector: SectorId;
  setSector: (id: SectorId) => void;
  cnaePrefixes: readonly string[];
}

const SectorContext = createContext<SectorContextValue | null>(null);

export function SectorProvider({ children }: { children: ReactNode }) {
  const [sector, setSectorState] = useState<SectorId>('all');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SectorId | null;
      if (stored && SECTORS.some((s) => s.id === stored)) {
        setSectorState(stored);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setSector = (id: SectorId) => {
    setSectorState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const current = SECTORS.find((s) => s.id === sector) ?? SECTORS[0];

  return (
    <SectorContext.Provider
      value={{ sector, setSector, cnaePrefixes: current.cnaePrefixes }}
    >
      {children}
    </SectorContext.Provider>
  );
}

export function useSector(): SectorContextValue {
  const ctx = useContext(SectorContext);
  if (!ctx) {
    return {
      sector: 'all',
      setSector: () => {},
      cnaePrefixes: [],
    };
  }
  return ctx;
}
