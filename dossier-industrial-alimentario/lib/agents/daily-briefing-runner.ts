// lib/agents/daily-briefing-runner.ts — Sprint QW-4: Briefing diario 09:00 UTC.
//
// Query Sources con deimplantationSignal=true en últimas 24h, resume con
// DeepSeek, envía a Telegram vía notifyStrong (QW-1).
//
// Best-effort: si DeepSeek falla, fallback a lista plana de títulos sin resumen.

import { PrismaClient } from '@prisma/client';
import { summarizeFindings } from '@/lib/ia/deepseek';
import { notifyStrong } from '@/lib/telegram/notify';

const prisma = new PrismaClient();

export const BRIEFING_AGENT_NAME = 'surus-agente-briefing';
export const BRIEFING_CRON_TAG = 'daily-09:00';

export interface BriefingItem {
  sourceId: string;
  title: string;
  url: string;
  outlet: string;
  publishedAt: Date | null;
  signalStrength: 'weak' | 'medium' | 'strong' | null;
}

export interface BriefingResult {
  agentName: string;
  itemsFound: number;
  topItems: number;
  summaryWords: number;
  sent: boolean;
  reason: string;
  briefingText: string;
  deepseekOk: boolean;
  deepseekError?: string;
  durationMs: number;
}

/** Query últimas 24h, prioriza strong > medium > weak, limit configurable. */
export async function queryLast24hSources(limit = 50): Promise<BriefingItem[]> {
  const since = new Date(Date.now() - 24 * 3600_000);
  const rows = await prisma.source.findMany({
    where: {
      deimplantationSignal: true,
      scrapedAt: { gte: since },
    },
    orderBy: { scrapedAt: 'desc' },
    take: limit * 3, // oversample to allow ranking
    select: {
      id: true,
      title: true,
      url: true,
      outlet: true,
      publishedAt: true,
    },
  });
  // Enriquecer con heurística de signal strength (mismo criterio que dashboard).
  const out: BriefingItem[] = [];
  for (const r of rows) {
    const signal = await inferSignalStrength(r.title, r.url);
    out.push({
      sourceId: r.id,
      title: r.title,
      url: r.url,
      outlet: r.outlet,
      publishedAt: r.publishedAt,
      signalStrength: signal,
    });
  }
  // Ordenar por signal desc + publishedAt desc.
  const rank = { strong: 3, medium: 2, weak: 1, null: 0 };
  out.sort((a, b) => {
    const r = rank[b.signalStrength ?? 'null'] - rank[a.signalStrength ?? 'null'];
    if (r !== 0) return r;
    const at = a.publishedAt?.getTime() ?? 0;
    const bt = b.publishedAt?.getTime() ?? 0;
    return bt - at;
  });
  return out.slice(0, limit);
}

/** Heurística de signal strength a partir de title+url (sin tocar DB). */
function inferSignalStrength(
  title: string,
  url: string,
): 'weak' | 'medium' | 'strong' {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  if (/concurso|disoluci[oó]n|liquidaci[oó]n|cierre|despidos|ere|desimplantac/.test(t)) return 'strong';
  if (/domicilio|constituci[oó]n|ampliaci[oó]n|capital|concesi[oó]n/.test(t)) return 'medium';
  if (u.includes('outlettype=auction') || u.includes('auction=')) return 'strong';
  return 'weak';
}

/** Construye el prompt para DeepSeek a partir de los items. Sin libertad de inventar. */
export function buildPromptForItems(items: BriefingItem[]): string {
  if (items.length === 0) {
    return 'No hay hallazgos en las últimas 24 horas. Resume indicando literalmente "Sin actividad relevante en las últimas 24h."';
  }
  const lines: string[] = [];
  lines.push('Aquí tienes los hallazgos del día (no inventes nada que no esté en esta lista):');
  lines.push('');
  for (const it of items.slice(0, 30)) {
    const date = (it.publishedAt ?? new Date()).toISOString().slice(0, 16).replace('T', ' ');
    lines.push(`- [${it.signalStrength?.toUpperCase() ?? 'WEAK'}] ${it.title} (${it.outlet}, ${date} UTC)`);
    lines.push(`  URL: ${it.url}`);
  }
  lines.push('');
  lines.push('Resume en 5 bullets los más relevantes para el departamento comercial Surus (desimplantación industrial A&B). Tono directo, sin emojis, ≤200 palabras. Si algún bullet es de un título BORME o de un portal de subastas, indícalo.');
  return lines.join('\n');
}

/** Trunca el texto a <= 200 palabras por la última frase completa. */
export function truncateToWords(text: string, maxWords = 200): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  const truncated = words.slice(0, maxWords).join(' ');
  const lastDot = truncated.lastIndexOf('. ');
  if (lastDot > truncated.length * 0.5) {
    return truncated.slice(0, lastDot + 1);
  }
  return truncated + '...';
}

function removeEmojis(s: string): string {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

export function buildBriefingText(summary: string, items: BriefingItem[]): string {
  const counts = items.reduce(
    (acc, it) => {
      const k = it.signalStrength ?? 'weak';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const header = [
    '<b>[BRIEFING DIARIO] Desimplantación A&B</b>',
    '',
    `<b>Total últimas 24h:</b> ${items.length} (strong=${counts.strong ?? 0} medium=${counts.medium ?? 0} weak=${counts.weak ?? 0})`,
    '',
  ].join('\n');
  return header + removeEmojis(summary);
}

export async function runDailyBriefing(opts: {
  /** Si true, salta el envío Telegram y solo devuelve el resultado. */
  dryRun?: boolean;
} = {}): Promise<BriefingResult> {
  const startedAt = new Date();

  const items = await queryLast24hSources(50);
  const prompt = buildPromptForItems(items);

  let summary: string;
  let deepseekOk: boolean;
  let deepseekError: string | undefined;

  if (items.length === 0) {
    summary = 'Sin actividad relevante en las últimas 24h.';
    deepseekOk = true;
  } else {
    const r = await summarizeFindings(prompt);
    if (r.ok) {
      summary = truncateToWords(r.text, 200);
      deepseekOk = true;
    } else {
      // Fallback: lista plana de los 5 primeros títulos (sin resumen IA).
      summary = items
        .slice(0, 5)
        .map((it, i) => `(${i + 1}) [${it.signalStrength?.toUpperCase() ?? 'WEAK'}] ${it.title.slice(0, 200)} — ${it.url}`)
        .join('\n');
      deepseekOk = false;
      deepseekError = r.error;
    }
  }

  const briefingText = buildBriefingText(summary, items);

  if (opts.dryRun) {
    return {
      agentName: BRIEFING_AGENT_NAME,
      itemsFound: items.length,
      topItems: Math.min(items.length, 5),
      summaryWords: summary.split(/\s+/).filter(Boolean).length,
      sent: false,
      reason: 'dry_run',
      briefingText,
      deepseekOk,
      deepseekError,
      durationMs: Date.now() - startedAt.getTime(),
    };
  }

  // Enviar vía notifyStrong (QW-1). Como el briefing es un "source virtual", le
  // damos un id determinista basado en el día para que el dedup por día funcione.
  const virtualSourceId = `briefing-${new Date().toISOString().slice(0, 10)}`;
  const nr = await notifyStrong({
    source: {
      id: virtualSourceId,
      title: `Briefing diario — ${new Date().toISOString().slice(0, 10)}`,
      url: `https://hermes.local/briefing/${new Date().toISOString().slice(0, 10)}`,
      outlet: 'HERMES Daily Briefing',
      outletType: 'internal_briefing',
      publishedAt: new Date(),
    },
    company: { id: 'briefing', name: 'Briefing diario', slug: 'briefing' },
    signalStrength: 'strong', // fuerza el envío si chat-id está configurado
    reason: `${items.length} hallazgos en 24h`,
  });

  // Log del run
  const finishedAt = new Date();
  await prisma.searchRun
    .create({
      data: {
        agentName: BRIEFING_AGENT_NAME,
        startedAt,
        finishedAt,
        mode: BRIEFING_CRON_TAG,
        query: { itemsFound: items.length } as object,
        itemsFound: items.length,
        itemsInScope: items.length,
        itemsNew: 0,
        itemsUpdated: 0,
        errorsCount: deepseekOk ? 0 : 1,
        costEur: 0,
      },
    })
    .catch(() => {
      // best-effort: si la tabla no admite este agentName, no rompemos el flujo.
    });

  return {
    agentName: BRIEFING_AGENT_NAME,
    itemsFound: items.length,
    topItems: Math.min(items.length, 5),
    summaryWords: summary.split(/\s+/).filter(Boolean).length,
    sent: nr.sent,
    reason: nr.reason,
    briefingText,
    deepseekOk,
    deepseekError,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

// CLI entry
if (process.argv[1]?.endsWith('daily-briefing-runner.ts') || process.argv[1]?.endsWith('daily-briefing-runner.js')) {
  (async () => {
    try {
      const r = await runDailyBriefing();
      console.log('\n=== DAILY BRIEFING ===');
      console.log(JSON.stringify({ ...r, briefingText: r.briefingText.slice(0, 800) }, null, 2));
    } catch (e) {
      console.error('FATAL:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
