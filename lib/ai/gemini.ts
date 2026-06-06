// lib/ai/gemini.ts — Cliente Gemini 2.5 Flash (fallback con grounding)
// Sprint G.3 — Provider secundario con búsqueda web habilitada
import type { AIProviderClient, AIRequest, AIResponse } from './types';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiClient implements AIProviderClient {
  readonly name = 'gemini' as const;

  constructor(private apiKey: string = process.env.GEMINI_API_KEY ?? '') {}

  available(): Promise<boolean> {
    return Promise.resolve(this.apiKey.length > 0);
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw Object.assign(new Error('GEMINI_API_KEY not configured'), {
        provider: 'gemini',
        retryable: false,
      });
    }
    const startedAt = Date.now();
    const useGrounding = req.grounding !== false;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.prompt }],
        },
      ],
      ...(req.systemContext
        ? { systemInstruction: { parts: [{ text: req.systemContext }] } }
        : {}),
      ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.3,
      },
    };

    const url = `${GEMINI_URL}?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw Object.assign(new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`), {
        provider: 'gemini',
        retryable: res.status >= 500 || res.status === 429,
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { uri: string; title?: string } }>;
        };
      }>;
    };
    const candidate = data.candidates[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
    const sources =
      candidate?.groundingMetadata?.groundingChunks
        ?.map((c) => c.web)
        .filter((w): w is { uri: string; title?: string } => Boolean(w))
        .map((w) => ({ url: w.uri, title: w.title })) ?? [];

    return {
      provider: 'gemini',
      text,
      model: DEFAULT_MODEL,
      durationMs: Date.now() - startedAt,
      grounded: useGrounding,
      sources,
    };
  }
}
