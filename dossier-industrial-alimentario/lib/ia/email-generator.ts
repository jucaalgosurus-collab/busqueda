// lib/ia/email-generator.ts — QW-9: generación de borradores outreach con DeepSeek.
//
// Estrategia:
//   1. prompt vía lib/email/personalize.ts (seed + pain points + reglas tono).
//   2. DeepSeek deepseek-chat con temperature 0.85.
//   3. Si falla (sin API key, MOCK=1, red caída) → fallback a template estático
//      con {{vars}} sustituidos (mínimo viable, garantiza UX no rota).
//   4. Valida tono (sin frases IA) + word count + tamaño LinkedIn.

import crypto from 'node:crypto';
import { findTemplate, type EmailTemplate } from '@/lib/email/render';
import {
  buildPrompt,
  extractPainPoints,
  seedForContact,
  seedForChannel,
  type PainPoint,
  type PromptVars,
} from '@/lib/email/personalize';

export interface EmailGeneratorInput {
  company: { id: string; name: string; slug: string; sector: string; subsector?: string | null };
  contact: {
    id: string;
    fullName: string;
    role: string;
    roleCategory?: string | null;
    email?: string | null;
    linkedinUrl?: string | null;
    plant?: { name?: string | null; city?: string | null } | null;
  };
  templateId?: string; // default: 'auto' = selecciona por sector+cargo
  apiKey?: string;
  forceMock?: boolean;
  signal?: AbortSignal;
}

export interface EmailDraft {
  companyId: string;
  contactId: string;
  templateId: string;
  channel: 'email' | 'linkedin_dm_short' | 'linkedin_dm_long';
  subject: string;
  body: string;
  painPoints: PainPoint[];
  seed: number;
  model: string;
  wordCount: number;
  hash: string;
  usedFallback: boolean;
  toneOk: boolean;
}

export const DEFAULT_PRESENTACION = `Soy Juan Carlos Alvarado, de Surus Inversa. Trabajamos con empresas de alimentación y bebidas en España ayudándolas a gestionar el ciclo de vida de sus activos industriales: desde la valoración técnica in situ y el reacondicionamiento hasta la venta especializada y el reciclaje responsable, pasando por la desimplantación completa de plantas cuando se cierra o se reubica una línea de producción.`;

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function pickTemplateId(input: EmailGeneratorInput): string {
  if (input.templateId && input.templateId !== 'auto') return input.templateId;
  const sector = input.company.sector;
  const cargo = input.contact.roleCategory ?? '';
  if (sector === 'Alimentos y Bebidas' && (cargo === 'cfo' || /cfo|financier/i.test(input.contact.role))) return 'QW-5-AB-CFO-01';
  if (sector === 'Alimentos y Bebidas') return 'QW-5-AB-PLANT-01';
  if (sector === 'Industrial' && (cargo === 'cfo' || /cfo|financier/i.test(input.contact.role))) return 'QW-5-IND-CFO-01';
  if (sector === 'Industrial') return 'QW-5-IND-PLANT-01';
  if (sector === 'Farmaceutico' && (cargo === 'cfo' || /cfo|financier/i.test(input.contact.role))) return 'QW-5-PHARM-CFO-01';
  if (sector === 'Farmaceutico') return 'QW-5-PHARM-PLANT-01';
  if (sector === 'Construccion' && (cargo === 'cfo' || /cfo|financier/i.test(input.contact.role))) return 'QW-5-CONST-CFO-01';
  if (sector === 'Construccion') return 'QW-5-CONST-PLANT-01';
  return 'QW-5-AB-PLANT-01'; // fallback A&B planta
}

function templateFallback(tpl: EmailTemplate, vars: Record<string, string>): { subject: string; body: string } {
  const sub = (s: string): string =>
    s.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
  return { subject: sub(tpl.subject), body: sub(tpl.body) };
}

function parseEmailOutput(raw: string, fallbackSubject: string): { subject: string; body: string } {
  const trimmed = raw.trim();
  const match = /^Subject:\s*(.+?)\n([\s\S]+)$/i.exec(trimmed);
  if (match) return { subject: match[1].trim(), body: match[2].trim() };
  // Si no hay subject, usar el fallback
  return { subject: fallbackSubject, body: trimmed };
}

async function callDeepSeek(prompt: string, apiKey: string, signal?: AbortSignal, temperature: number = 0.85): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 600,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek respuesta vacía');
  return text;
}

function shortenForLinkedIn(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  return body.slice(0, maxChars - 3).trimEnd() + '...';
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** Genera 1 borrador para 1 decisor en 1 canal. */
export async function generateEmailDraft(
  input: EmailGeneratorInput,
  channel: EmailDraft['channel'] = 'email',
): Promise<EmailDraft> {
  const templateId = pickTemplateId(input);
  const tpl = findTemplate(templateId);
  if (!tpl) throw new Error(`template no encontrado: ${templateId}`);

  const useMock = input.forceMock === true || !input.apiKey || process.env.MOCK === '1' || process.env.DEEPSEEK_MOCK === '1';
  const painPoints = useMock ? [] : await extractPainPoints(input.company.id);
  const baseSeed = seedForContact(input.company.id, input.contact.id, input.company.sector, input.contact.role);
  const seed = seedForChannel(baseSeed, channel);

  const presentacion = DEFAULT_PRESENTACION;
  const vars: PromptVars = {
    empresa: input.company.name,
    cargo: input.contact.role,
    sector: input.company.sector,
    planta: input.contact.plant?.name ?? undefined,
    ciudad: input.contact.plant?.city ?? undefined,
    painPoints,
    channel,
    seed,
    presentacion,
  };
  const prompt = buildPrompt(vars);

  let subject = '';
  let body = '';
  let usedFallback = false;
  let model = DEEPSEEK_MODEL;

  if (useMock) {
    const fb = templateFallback(tpl, {
      empresa: input.company.name,
      ciudad: input.contact.plant?.city ?? 'Madrid',
      planta: input.contact.plant?.name ?? 'la planta',
    });
    subject = fb.subject;
    body = fb.body;
    usedFallback = true;
    model = 'mock-template';
  } else {
    try {
      const raw = await callDeepSeek(prompt, input.apiKey!, input.signal, 0.85);
      const parsed = parseEmailOutput(raw, fb_subject(tpl, input));
      subject = parsed.subject;
      body = parsed.body;
    } catch (e) {
      // Fallback silencioso al template
      const fb = templateFallback(tpl, {
        empresa: input.company.name,
        ciudad: input.contact.plant?.city ?? 'Madrid',
        planta: input.contact.plant?.name ?? 'la planta',
      });
      subject = fb.subject;
      body = fb.body;
      usedFallback = true;
      model = 'mock-template';
    }
  }

  if (channel === 'linkedin_dm_short') {
    body = shortenForLinkedIn(body, 300);
  } else if (channel === 'linkedin_dm_long') {
    body = shortenForLinkedIn(body, 600);
  }

  const wordCount = countWords(body);
  const { passesToneCheck } = await import('@/lib/email/personalize.js');
  const toneOk = passesToneCheck(`${subject}\n${body}`);

  return {
    companyId: input.company.id,
    contactId: input.contact.id,
    templateId,
    channel,
    subject,
    body,
    painPoints,
    seed,
    model,
    wordCount,
    hash: sha256(body),
    usedFallback,
    toneOk,
  };
}

function fb_subject(tpl: EmailTemplate, input: EmailGeneratorInput): string {
  const planta = input.contact.plant?.name ?? '';
  const ciudad = input.contact.plant?.city ?? '';
  return `${input.company.name}${planta ? ` — ${planta}` : ''}${ciudad ? ` (${ciudad})` : ''}`;
}

/** Genera los 3 borradores (email + 2 LinkedIn) para 1 decisor. */
export async function generateAllVariants(input: EmailGeneratorInput): Promise<EmailDraft[]> {
  return Promise.all([
    generateEmailDraft(input, 'email'),
    generateEmailDraft(input, 'linkedin_dm_short'),
    generateEmailDraft(input, 'linkedin_dm_long'),
  ]);
}
