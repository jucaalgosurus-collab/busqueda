// scripts/curate-top-n.ts — Orquestador CLI de curación Top-N por sector
// Sprint S.2 — Ejecuta DeepSeek curator para todos los CNAEs de un sector
// Uso: npx tsx scripts/curate-top-n.ts a&b
//      npx tsx scripts/curate-top-n.ts a&b --topN=50
//      npx tsx scripts/curate-top-n.ts all (todos los sectores)

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  SECTORES,
  SECTOR_LABELS,
  isAandBSector,
  type SectorCodigo,
  type CnaeEntry,
} from '../lib/curation/cnae-catalog';
import {
  curateTopN,
  type TopNRow,
  type CuratorResult,
} from '../lib/curation/deepseek-curator';

const OUTPUT_DIR = 'data/top-n';
const DEFAULT_TOPN = 100;
const DEFAULT_VENTANA = 3;

function parseArgs(): { sector: SectorCodigo | 'all'; topN: number; ventana: number } {
  const args = process.argv.slice(2);
  const sectorArg = args[0];
  if (!sectorArg || (sectorArg !== 'all' && !(sectorArg in SECTORES))) {
    console.error(`Uso: curate-top-n.ts <${Object.keys(SECTORES).join('|')}|all> [--topN=N] [--ventanaAnios=N]`);
    process.exit(1);
  }
  let topN = DEFAULT_TOPN;
  let ventana = DEFAULT_VENTANA;
  for (const arg of args.slice(1)) {
    const m = arg.match(/^--(topN|ventanaAnios)=(\d+)$/);
    if (m && m[1] && m[2]) {
      const val = parseInt(m[2], 10);
      if (m[1] === 'topN') topN = val;
      if (m[1] === 'ventanaAnios') ventana = val;
    }
  }
  return {
    sector: sectorArg as SectorCodigo | 'all',
    topN,
    ventana,
  };
}

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(row: TopNRow): string {
  return [
    row.pos,
    csvEscape(row.cnae_4d),
    csvEscape(row.etapa_cadena ?? ''),
    csvEscape(row.nombre),
    csvEscape(row.slug),
    row.facturacion_eur,
    csvEscape(row.facturacion_raw),
    csvEscape(row.provincia),
    csvEscape(row.fuente_url),
    csvEscape(row.fuente_descripcion),
    row.signal_score,
    csvEscape(row.signal_rationale),
  ].join(',');
}

const CSV_HEADER = [
  'pos',
  'cnae_4d',
  'etapa_cadena',
  'nombre',
  'slug',
  'facturacion_eur',
  'facturacion_raw',
  'provincia',
  'fuente_url',
  'fuente_descripcion',
  'signal_score',
  'signal_rationale',
].join(',');

function writeSectorCsv(sector: SectorCodigo, rows: TopNRow[]): string {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 16);
  const filePath = join(OUTPUT_DIR, `${sector}-${ts}.csv`);
  const body = [CSV_HEADER, ...rows.map(rowToCsv)].join('\n');
  writeFileSync(filePath, body, 'utf-8');
  return filePath;
}

function logSeparator(): void {
  console.log('━'.repeat(60));
}

interface SectorReport {
  sector: SectorCodigo;
  cnaes: number;
  total_rows: number;
  cnaes_succeeded: number;
  cnaes_failed: string[];
  csv_path: string;
  tokens_in: number;
  tokens_out: number;
}

async function curateSector(
  sector: SectorCodigo,
  topN: number,
  ventana: number
): Promise<SectorReport> {
  const cnaes = SECTORES[sector];
  logSeparator();
  console.log(`SECTOR: ${SECTOR_LABELS[sector]} (${sector}) — ${cnaes.length} CNAEs`);
  logSeparator();

  const allRows: TopNRow[] = [];
  const failed: string[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let succeeded = 0;

  for (let i = 0; i < cnaes.length; i++) {
    const cnae: CnaeEntry = cnaes[i]!;
    const etapaLabel = cnae.etapa ? ` [${cnae.etapa}]` : '';
    process.stdout.write(`[${(i + 1).toString().padStart(2)}/${cnaes.length}] CNAE ${cnae.cnae}${etapaLabel} … `);
    try {
      const result: CuratorResult = await curateTopN(sector, cnae, { topN, ventanaAnios: ventana });
      console.log(`✓ ${result.rows.length} filas (${result.tokens_in}+${result.tokens_out} tok)`);
      allRows.push(...result.rows);
      tokensIn += result.tokens_in;
      tokensOut += result.tokens_out;
      succeeded += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100);
      console.log(`✗ ${msg}`);
      failed.push(cnae.cnae);
    }
    // Rate limit: 800ms entre llamadas (DeepSeek tier free)
    await new Promise((r) => setTimeout(r, 800));
  }

  // Dedup por slug, mantener el de mayor signal_score
  const bySlug = new Map<string, TopNRow>();
  for (const r of allRows) {
    const existing = bySlug.get(r.slug);
    if (!existing || r.signal_score > existing.signal_score) {
      bySlug.set(r.slug, r);
    }
  }
  const deduped = Array.from(bySlug.values()).sort((a, b) => b.signal_score - a.signal_score);
  for (let i = 0; i < deduped.length; i++) {
    const r = deduped[i];
    if (r) r.pos = i + 1;
  }

  const csvPath = writeSectorCsv(sector, deduped);

  return {
    sector,
    cnaes: cnaes.length,
    total_rows: deduped.length,
    cnaes_succeeded: succeeded,
    cnaes_failed: failed,
    csv_path: csvPath,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  };
}

async function main(): Promise<void> {
  const { sector, topN, ventana } = parseArgs();
  const sectores: SectorCodigo[] = sector === 'all' ? Object.keys(SECTORES) as SectorCodigo[] : [sector as SectorCodigo];

  logSeparator();
  console.log(`S.2 — Top-N por sector (DeepSeek curator)`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`TopN: ${topN} · Ventana: ${ventana} años`);
  console.log(`Sectores: ${sectores.map((s) => SECTOR_LABELS[s]).join(', ')}`);
  logSeparator();

  const reports: SectorReport[] = [];
  for (const s of sectores) {
    const r = await curateSector(s, topN, ventana);
    reports.push(r);
  }

  logSeparator();
  console.log('RESUMEN FINAL');
  logSeparator();
  for (const r of reports) {
    const prioridad = isAandBSector(r.sector) ? '★ A&B PRIORIDAD' : '  cobertura secundaria';
    console.log(
      `${prioridad} ${SECTOR_LABELS[r.sector]} (${r.sector}): ${r.cnaes_succeeded}/${r.cnaes} CNAEs OK · ${r.total_rows} filas únicas · ${r.tokens_in}+${r.tokens_out} tokens`
    );
    if (r.cnaes_failed.length > 0) {
      console.log(`  CNAEs fallidos: ${r.cnaes_failed.join(', ')}`);
    }
    console.log(`  CSV: ${r.csv_path}`);
  }
  logSeparator();
  console.log(`Coste total: 0€ (DeepSeek API key existente, tier free)`);
  logSeparator();
}

main().catch((e: unknown) => {
  console.error('FATAL:', e);
  process.exit(1);
});
