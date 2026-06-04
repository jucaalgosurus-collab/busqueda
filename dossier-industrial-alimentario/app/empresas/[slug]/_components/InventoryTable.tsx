// app/empresas/[slug]/_components/InventoryTable.tsx — Tabla inventario con sort+filter
'use client';

import { useMemo, useState } from 'react';
import type { Plant, TechnicalInventory } from '@prisma/client';
import { statusColorVar } from '../_lib/types';

type Row = TechnicalInventory & { plantName: string };

type Props = { plants: (Plant & { inventory: TechnicalInventory[] })[] };

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'linea_produccion', label: 'Línea producción' },
  { value: 'caldera', label: 'Caldera' },
  { value: 'sistema_almacenaje', label: 'Almacenaje' },
  { value: 'envasado', label: 'Envasado' },
  { value: 'refrigeracion', label: 'Refrigeración' },
  { value: 'logistica', label: 'Logística' },
  { value: 'co_generacion', label: 'Co-generación' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'molino', label: 'Molino' },
  { value: 'horno', label: 'Horno' },
  { value: 'edificio', label: 'Edificio' },
  { value: 'parcela', label: 'Parcela' },
];

const STATUSES = ['operativo', 'a_sustituir', 'liberado', 'desmantelado', 'vendido', 'en_uso', 'en_obra'];

export function InventoryTable({ plants }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState<keyof Row>('category');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rows: Row[] = useMemo(() => {
    const all = plants.flatMap((p) =>
      p.inventory.map((i) => ({ ...i, plantName: p.name }))
    );
    return all
      .filter((r) => !query || [r.brand, r.model, r.specs, r.plantName, r.category].some((f) => f && String(f).toLowerCase().includes(query.toLowerCase())))
      .filter((r) => !category || r.category === category)
      .filter((r) => !status || r.status === status)
      .sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        if (av === bv) return 0;
        const cmp = String(av).localeCompare(String(bv), 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [plants, query, category, status, sortKey, sortDir]);

  if (plants.length === 0) return null;
  const totalItems = plants.reduce((acc, p) => acc + p.inventory.length, 0);
  if (totalItems === 0) return null;

  const handleSort = (key: keyof Row) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <section className="empresa-section" aria-labelledby="inv-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="inv-heading">
            <span className="section-head-num">03</span>Inventario técnico
          </h2>
          <span className="section-head-count">{rows.length} activos · {totalItems} totales</span>
        </div>
        <div className="inv-shell">
          <div className="inv-toolbar">
            <input
              type="search"
              className="inv-search"
              placeholder="Buscar por brand, modelo, planta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar en inventario"
            />
            <select
              className="inv-search"
              style={{ flex: 'unset', minWidth: 180 }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              className="inv-search"
              style={{ flex: 'unset', minWidth: 180 }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="inv-table-wrap">
            <table className="inv-table" role="table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('category')}>Categoría</th>
                  <th onClick={() => handleSort('plantName')}>Planta</th>
                  <th onClick={() => handleSort('brand')}>Brand</th>
                  <th>Modelo</th>
                  <th>Specs</th>
                  <th onClick={() => handleSort('status')}>Estado</th>
                  <th>Ventana</th>
                  <th onClick={() => handleSort('estimatedValueEur')}>Valor est.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.category}</td>
                    <td>{r.plantName}</td>
                    <td className="cell-brand">{r.brand ?? '—'}</td>
                    <td className="cell-model">{r.model ?? '—'}</td>
                    <td className="cell-specs">{r.specs ?? '—'}</td>
                    <td>
                      <span className="status-pill" style={{ color: statusColorVar(r.status) }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="cell-model">{r.releaseWindow ?? '—'}</td>
                    <td className="cell-model">
                      {r.estimatedValueEur ? `${(r.estimatedValueEur / 1000).toFixed(0)}K €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Sin resultados para los filtros aplicados.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
