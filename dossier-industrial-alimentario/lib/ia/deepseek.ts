// lib/ia/deepseek.ts — Sprint QW-4: Wrapper minimal de DeepSeek Chat API.
//
// Solo lo que QW-4 necesita: summarizeFindings(prompt) -> { ok, text, error }.
// Sin estado, sin retry agresivo, sin streaming. Best-effort.
//
// Endpoint: https://api.deepseek.com/v1/chat/completions
// Env: DEEPSEEK_API_KEY
//
// Si no hay API key o falla, devuelve ok=false con error. Caller hace fallback.

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface DeepSeekResult {
  ok: boolean;
  text: string;
  error?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_MAX_TOKENS = 600;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT_MS = 15_000;

export function isDeepSeekMock(): boolean {
  return process.env.MOCK === '1' || process.env.DEEPSEEK_MOCK === '1';
}

/**
 * Llama a DeepSeek chat/completions.
 * Devuelve { ok: true, text } con el contenido del assistant, o { ok: false, error }.
 */
export async function callDeepSeek(
  messages: DeepSeekMessage[],
  opts: DeepSeekOptions = {},
): Promise<DeepSeekResult> {
  if (isDeepSeekMock()) {
    // Modo MOCK: devolver un resumen pre-canned razonable. Útil para smoke y CI.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const fake = mockSummarize(lastUser);
    return { ok: true, text: fake, model: 'mock', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, text: '', error: 'missing_deepseek_api_key' };
  }
  const model = opts.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, text: '', error: `http_${res.status}: ${body.slice(0, 200)}` };
    }
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = j.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return { ok: false, text: '', error: 'empty_response' };
    return {
      ok: true,
      text,
      model: j.model,
      usage: j.usage
        ? {
            promptTokens: j.usage.prompt_tokens ?? 0,
            completionTokens: j.usage.completion_tokens ?? 0,
            totalTokens: j.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  } catch (e) {
    return { ok: false, text: '', error: `fetch_error: ${String((e as Error).message ?? e)}` };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resume una lista cerrada de hallazgos. NO debe inventar.
 * El prompt ya viene formateado por el caller; aquí solo se envía.
 */
export async function summarizeFindings(
  promptUser: string,
  opts: DeepSeekOptions = {},
): Promise<DeepSeekResult> {
  const system =
    'Eres un analista OSINT para el departamento comercial de Surus Inversa (asesoría en desimplantación industrial de alimentación y bebidas en España). ' +
    'Resúmenes en español, tono directo, sin emojis, sin superlativos. ' +
    'Si el usuario te pasa una lista de hallazgos, resume SOLO los títulos y URLs de esa lista. NO inventes empresas, NO añadas nombres no presentes en la lista. ' +
    'Devuelve el resumen en texto plano (sin markdown, sin asteriscos) en menos de 200 palabras. ' +
    'Si la lista está vacía, responde literalmente: "Sin actividad relevante en las últimas 24h."';
  return callDeepSeek(
    [
      { role: 'system', content: system },
      { role: 'user', content: promptUser },
    ],
    opts,
  );
}

function mockSummarize(userPrompt: string): string {
  // MOCK determinista: extrae los primeros 5 items (líneas '- ' o '* ') y los cuenta.
  const lines = userPrompt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-') || l.startsWith('*'))
    .slice(0, 5);
  if (lines.length === 0) return 'Sin actividad relevante en las últimas 24h.';
  return lines
    .map((l, i) => `(${i + 1}) ${l.replace(/^[-*]\s*/, '').slice(0, 200)}`)
    .join('\n');
}
