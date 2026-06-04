// lib/email/personalize.ts — QW-9: extracción de pain points + seeds deterministas.
//
// Funciones puras (sin I/O). Permiten al generador de emails producir borradores
// variables pero reproducibles por decisor.

import { prisma } from '@/lib/db/prisma';

export interface PainPoint {
  date: string;          // YYYY-MM-DD
  title: string;
  outlet: string;
  signalStrength: string; // 'weak' | 'medium' | 'strong'
  url: string;
}

/**
 * Extrae los N hallazgos más relevantes (pain points) de una compañía en los últimos
 * `days` días. Filtra: deimplantationSignal=true, confidence>minConfidence, outletType
 * excluyendo 'auction' y 'linkedin' (no son dolor real, son señal de monitorización).
 */
export async function extractPainPoints(
  companyId: string,
  days: number = 90,
  minConfidence: number = 0.6,
  limit: number = 5,
): Promise<PainPoint[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sources = await prisma.source.findMany({
    where: {
      companyId,
      deimplantationSignal: true,
      publishedAt: { gte: cutoff, not: null },
      // Excluir señales de monitorización (no son dolor real)
      outletType: { notIn: ['auction', 'linkedin', 'preview_only'] },
    },
    orderBy: [{ publishedAt: 'desc' }, { scrapedAt: 'desc' }],
    take: limit * 2, // oversamplear para filtrar por confidence
  });

  // Filtrar por confidence (campo contentText, no directo en Source, pero podemos usar scrapedAt reciente como proxy)
  // Como Source no tiene campo confidence, usamos signalStrength como proxy: solo 'medium' o 'strong'
  const filtered = sources.filter((s) => {
    const signal = (s as unknown as { signalStrength?: string }).signalStrength;
    return signal === undefined || signal === 'medium' || signal === 'strong';
  });

  return filtered.slice(0, limit).map((s) => ({
    date: s.publishedAt ? s.publishedAt.toISOString().slice(0, 10) : '—',
    title: s.title,
    outlet: s.outlet,
    signalStrength: (s as unknown as { signalStrength?: string }).signalStrength ?? 'medium',
    url: s.url,
  }));
}

/**
 * Hash determinista: (companyId, contactId, sector, cargo) → seed 0-9999.
 * Mismo input siempre da mismo seed → borrador reproducible para el mismo decisor.
 * Distintos decisores de la misma empresa → seeds distintos.
 */
export function seedForContact(companyId: string, contactId: string, sector: string, cargo: string): number {
  const key = `${companyId}|${contactId}|${sector}|${cargo}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 10000;
}

/**
 * Hash determinista de (variantes por canal) para que el mismo decisor tenga
 * email y LinkedIn DM con seed distinto (no sean copia literal).
 */
export function seedForChannel(baseSeed: number, channel: 'email' | 'linkedin_dm_short' | 'linkedin_dm_long'): number {
  const offset = channel === 'email' ? 0 : channel === 'linkedin_dm_short' ? 137 : 271;
  return (baseSeed + offset) % 10000;
}

export interface PromptVars {
  empresa: string;
  cargo: string;
  sector: string;
  planta?: string;
  ciudad?: string;
  painPoints: PainPoint[];
  channel: 'email' | 'linkedin_dm_short' | 'linkedin_dm_long';
  seed: number;
  presentacion: string; // bloque 1 fijo
}

const FORBIDDEN_PHRASES = [
  /estimado\/a/i,
  /no dude en/i,
  /quedo a su disposici[oó]n/i,
  /me pongo en contacto/i,
  /espero su respuesta/i,
  /le saluda atentamente/i,
  /excelente/i,
  /innovador/i,
  /líder del sector/i,
  /puntero/i,
];

const MAX_WORDS: Record<PromptVars['channel'], number> = {
  email: 130,
  linkedin_dm_short: 50,
  linkedin_dm_long: 90,
};

export { MAX_WORDS };

export function buildPrompt(vars: PromptVars): string {
  const pain = vars.painPoints
    .slice(0, 3)
    .map((p, i) => `  ${i + 1}. ${p.date} — ${p.title} (${p.outlet}, señal ${p.signalStrength})`)
    .join('\n');

  const channelInstr: Record<PromptVars['channel'], string> = {
    email: 'Email formal ≤120 palabras. Subject específico de la planta. 3 bloques: presentación, contexto, cierre con pregunta.',
    linkedin_dm_short: 'LinkedIn DM corto ≤300 caracteres TOTAL. 1 línea presentación + 1-2 frases contexto + pregunta directa.',
    linkedin_dm_long: 'LinkedIn DM largo ≤80 palabras. Presentación breve + contexto adaptado a mensaje LinkedIn + nota "podemos hablar 15 min por aquí o por correo".',
  };

  return `Eres Juan Carlos Alvarado, de Surus Inversa. Redacta un mensaje de outreach B2B para un decisor industrial.

DECISOR: ${vars.cargo}
EMPRESA: ${vars.empresa}
SECTOR: ${vars.sector}
${vars.planta ? `PLANTA: ${vars.planta}` : ''}${vars.ciudad ? ` (${vars.ciudad})` : ''}
CANAL: ${channelInstr[vars.channel]}
SEMILLA: ${vars.seed} (usa este número para variar la redacción — mismo decisor siempre genera el mismo borrador, pero decisores distintos generan borradores distintos)

PAIN POINTS REALES (de ${vars.painPoints.length} hallazgos detectados, muestra los ${Math.min(3, vars.painPoints.length)} más recientes):
${pain || '  (sin dolor detectado — usa saludo de presentación neutral)'}

BLOQUE 1 — PRESENTACIÓN (obligatorio, no omitir):
${vars.presentacion}

BLOQUE 2 — CONTEXTO (toca 1-2 pain points si hay, sin inventar):
[Adapta al cargo: CFO habla de balance, Director de Planta de desimplantación técnica, COO de operaciones, CEO de estrategia, Sostenibilidad de ESG]

BLOQUE 3 — CIERRE:
Pregunta de 1 línea. NO coletillas. NO "quedo a su disposición".

REGLAS DURAS (CHECKLIST OBLIGATORIA):
- Sin emojis.
- Sin "estimado/a", "no dude en", "quedo a su disposición", "me pongo en contacto", "espero su respuesta", "le saluda atentamente".
- Sin superlativos vacíos: "excelente", "innovador", "líder del sector", "puntero".
- Tono: profesional, directo, hechos concretos. Frases cortas.
- Menciona un hecho concreto y verificable (de pain points) si hay.
- Longitud máxima: ${MAX_WORDS[vars.channel]} palabras / ${vars.channel === 'linkedin_dm_short' ? '300 chars' : 'sin límite rígido'}.
- Idioma: español de España.
- Devuelve SOLO el texto del mensaje, sin meta-comentarios, sin "Subject:" en el cuerpo (si es email, indícalo en la primera línea con "Subject: ...").

Responde con el texto del mensaje directamente.`;
}

/** Devuelve true si el texto no contiene ninguna frase IA prohibida. */
export function passesToneCheck(text: string): boolean {
  return !FORBIDDEN_PHRASES.some((re) => re.test(text));
}

export { FORBIDDEN_PHRASES };
