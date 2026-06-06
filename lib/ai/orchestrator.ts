// lib/ai/orchestrator.ts — Orquestador con fallback DeepSeek → Gemini
// Sprint G.3 — Fallback chain con grounding opcional
import type { AIProviderClient, AIRequest, AIResponse, AIError } from './types';
import { DeepSeekClient } from './deepseek';
import { GeminiClient } from './gemini';

export interface OrchestratorOptions {
  primary?: AIProviderClient;
  fallback?: AIProviderClient;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class AIOrchestrator {
  private primary: AIProviderClient;
  private fallback: AIProviderClient;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(opts: OrchestratorOptions = {}) {
    this.primary = opts.primary ?? new DeepSeekClient();
    this.fallback = opts.fallback ?? new GeminiClient();
    this.maxRetries = opts.maxRetries ?? 1;
    this.retryDelayMs = opts.retryDelayMs ?? 500;
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const errors: AIError[] = [];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.primary.complete(req);
      } catch (err) {
        const aiErr = this.toAIError(err, this.primary.name);
        errors.push(aiErr);
        if (!aiErr.retryable || attempt === this.maxRetries) break;
        await this.delay(this.retryDelayMs * Math.pow(2, attempt));
      }
    }

    const primaryAvailable = await this.primary.available();
    const fallbackAvailable = await this.fallback.available();
    if (!fallbackAvailable) {
      throw new AggregateError(
        errors.map((e) => new Error(`[${e.provider}] ${e.error}`)),
        'AI orchestrator: all providers failed'
      );
    }

    try {
      return await this.fallback.complete(req);
    } catch (err) {
      const aiErr = this.toAIError(err, this.fallback.name);
      errors.push(aiErr);
      throw new AggregateError(
        errors.map((e) => new Error(`[${e.provider}] ${e.error}`)),
        'AI orchestrator: primary and fallback both failed'
      );
    }
  }

  private toAIError(err: unknown, provider: string): AIError {
    if (err && typeof err === 'object' && 'error' in err && 'retryable' in err) {
      const e = err as { error?: unknown; retryable?: unknown; statusCode?: unknown };
      return {
        provider: provider as AIError['provider'],
        error: String(e.error ?? 'unknown'),
        retryable: Boolean(e.retryable),
        statusCode: typeof e.statusCode === 'number' ? e.statusCode : undefined,
      };
    }
    return {
      provider: provider as AIError['provider'],
      error: err instanceof Error ? err.message : String(err),
      retryable: false,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let defaultInstance: AIOrchestrator | null = null;
export function getOrchestrator(): AIOrchestrator {
  if (!defaultInstance) defaultInstance = new AIOrchestrator();
  return defaultInstance;
}
