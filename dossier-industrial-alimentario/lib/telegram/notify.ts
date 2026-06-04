// lib/telegram/notify.ts — Sprint QW-1: Alertas Telegram para signal_strength=strong.
//
// Patrón: el bot Python (/opt/hermes-dossier/scripts/bot.py) ya implementa send()
// con urllib. QW-1 añade un modo CLI 'send' al bot + este wrapper TypeScript que
// spawnea el bot vía subprocess. NO duplicamos la lógica HTTP en TypeScript.
//
// Reglas:
//  - Best-effort: si falla, log + skip. La persistencia en DB es la verdad.
//  - Anti-spam por (sourceId, day): no se envía la misma alerta 2 veces.
//  - Anti-spam global: max N alertas/día (configurable, default 20).
//  - MOCK=1 para testing sin red real.

import { spawn } from 'child_process';

export type SignalStrength = 'weak' | 'medium' | 'strong';

export interface TelegramNotifySource {
  id: string;
  title: string;
  url: string;
  outlet: string;
  outletType: string;
  publishedAt: Date | string | null;
}

export interface TelegramNotifyCompany {
  id: string;
  name: string;
  slug: string;
}

export interface TelegramNotifyPlant {
  city?: string | null;
  province?: string | null;
}

export interface TelegramNotifyResult {
  sent: boolean;
  reason: string;
  /** Body del mensaje enviado (para logging). */
  text?: string;
}

const BOT_SCRIPT_PATH =
  process.env.HERMES_BOT_SCRIPT ?? '/opt/hermes-dossier/scripts/bot.py';

const PYTHON_BIN = process.env.HERMES_PYTHON_BIN ?? 'python3';

const DEFAULT_MAX_PER_DAY = 20;

/** Set en memoria del proceso con (sourceId) → timestamp del último envío. */
const dedupBySourceDay = new Map<string, string>();

/** Contador diario de envíos. Se resetea al cambiar el día (UTC). */
let sentToday = 0;
let currentDayKey = utcDayKey(new Date());

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isMock(): boolean {
  return process.env.MOCK === '1' || process.env.TELEGRAM_MOCK === '1';
}

function isEnabled(): boolean {
  const flag = process.env.TELEGRAM_ALERTS_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

function getChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID ?? null;
}

function getMaxPerDay(): number {
  const n = Number.parseInt(process.env.TELEGRAM_MAX_PER_DAY ?? '', 10);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_MAX_PER_DAY;
}

/** Verifica si la (source, day) ya disparó alerta. */
function isAlreadyNotified(sourceId: string, dayKey: string): boolean {
  return dedupBySourceDay.get(sourceId) === dayKey;
}

function markNotified(sourceId: string, dayKey: string): void {
  dedupBySourceDay.set(sourceId, dayKey);
}

function resetDailyIfNeeded(): void {
  const today = utcDayKey(new Date());
  if (today !== currentDayKey) {
    currentDayKey = today;
    sentToday = 0;
    dedupBySourceDay.clear();
  }
}

/** Construye el texto del mensaje (HTML) para Telegram. */
export function buildStrongAlert(args: {
  source: TelegramNotifySource;
  company: TelegramNotifyCompany;
  signalStrength: SignalStrength;
  reason?: string;
  plantCity?: string;
  plantProvince?: string;
}): string {
  const { source, company, signalStrength, reason, plantCity, plantProvince } = args;
  const location = [plantCity, plantProvince].filter(Boolean).join(', ');
  const lines: string[] = [];
  lines.push('<b>[SEÑAL FUERTE] Desimplantación A&B</b>');
  lines.push('');
  lines.push(`<b>Empresa:</b> ${escapeHtml(company.name)}`);
  if (location) lines.push(`<b>Planta:</b> ${escapeHtml(location)}`);
  lines.push(`<b>Señal:</b> ${signalStrength.toUpperCase()}`);
  lines.push(`<b>Fuente:</b> ${escapeHtml(source.outlet)} (${escapeHtml(source.outletType)})`);
  lines.push(`<b>Título:</b> ${escapeHtml(source.title.slice(0, 240))}`);
  if (reason) lines.push(`<b>Detalle:</b> ${escapeHtml(reason.slice(0, 240))}`);
  lines.push(`<b>URL:</b> ${escapeHtml(source.url)}`);
  lines.push('');
  lines.push('<i>HERMES Dossier — Juan Carlos Alvarado para Surus</i>');
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Spawnea bot.py con el comando send. Timeout 5s. */
function spawnBotSend(chatId: string, text: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      PYTHON_BIN,
      [BOT_SCRIPT_PATH, 'send', '--chat-id', chatId, '--text', text, '--parse-mode', 'HTML'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('error', (e) => {
      resolve({ ok: false, stderr: `spawn error: ${String(e)}` });
    });
    child.on('exit', (code) => {
      resolve({ ok: code === 0, stderr: stderr.slice(-500) });
    });
    // Hard timeout.
    setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      resolve({ ok: false, stderr: 'timeout' });
    }, 5500).unref();
  });
}

/**
 * Notifica un Source con signalStrength='strong' al chat de Surus.
 * - Best-effort: nunca lanza excepción.
 * - Anti-spam: 1 alerta por (sourceId, day) + max N/día global.
 */
export async function notifyStrong(args: {
  source: TelegramNotifySource;
  company: TelegramNotifyCompany;
  signalStrength: SignalStrength;
  reason?: string;
  plantCity?: string;
  plantProvince?: string;
}): Promise<TelegramNotifyResult> {
  if (args.signalStrength !== 'strong') {
    return { sent: false, reason: 'signal_not_strong' };
  }
  if (!isEnabled()) {
    return { sent: false, reason: 'alerts_disabled' };
  }
  resetDailyIfNeeded();
  const dayKey = utcDayKey(new Date());
  if (isAlreadyNotified(args.source.id, dayKey)) {
    return { sent: false, reason: 'dedup_same_source_day' };
  }
  if (sentToday >= getMaxPerDay()) {
    return { sent: false, reason: 'daily_quota_exceeded' };
  }
  const chatId = getChatId();
  if (!chatId && !isMock()) {
    return { sent: false, reason: 'missing_chat_id' };
  }
  const text = buildStrongAlert(args);

  if (isMock()) {
    markNotified(args.source.id, dayKey);
    sentToday++;
    return { sent: true, reason: 'mock', text };
  }

  const res = await spawnBotSend(chatId as string, text);
  if (res.ok) {
    markNotified(args.source.id, dayKey);
    sentToday++;
    return { sent: true, reason: 'sent', text };
  }
  return { sent: false, reason: `bot_error: ${res.stderr.slice(0, 200)}` };
}

/** Reset manual (testing). */
export function _resetNotifyStateForTests(): void {
  dedupBySourceDay.clear();
  sentToday = 0;
  currentDayKey = utcDayKey(new Date());
}
