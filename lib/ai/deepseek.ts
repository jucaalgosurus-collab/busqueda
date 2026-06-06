// lib/ai/deepseek.ts — Cliente DeepSeek (primary, 0€)
// Sprint G.3 — Provider primary
import type { AIProviderClient, AIRequest, AIResponse } from './types';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

export class DeepSeekClient implements AIProviderClient {
  readonly name = 'deepseek' as const;

  constructor(private apiKey: string = process.env.DEEPSEEK_API_KEY ?? '') {}

  available(): Promise<boolean> {
    return Promise.resolve(this.apiKey.length > 0);
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw Object.assign(new Error('DEEPSEEK_API_KEY not configured'), {
        provider: 'deepseek',
        retryable: false,
      });
    }
    const startedAt = Date.now();
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          ...(req.systemContext ? [{ role: 'system', content: req.systemContext }] : []),
          { role: 'user', content: req.prompt },
        ],
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.3,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw Object.assign(new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`), {
        provider: 'deepseek',
        retryable: res.status >= 500 || res.status === 429,
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices[0]?.message?.content ?? '';
    return {
      provider: 'deepseek',
      text,
      model: DEFAULT_MODEL,
      durationMs: Date.now() - startedAt,
      grounded: false,
    };
  }
}
