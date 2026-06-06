// lib/ai/types.ts — Tipos compartidos del sistema de IA
// Sprint G.3 — Gemini grounding fallback

export type AIProvider = 'deepseek' | 'gemini';

export interface AIRequest {
  prompt: string;
  systemContext?: string;
  maxTokens?: number;
  temperature?: number;
  grounding?: boolean;
}

export interface AIResponse {
  provider: AIProvider;
  text: string;
  model: string;
  durationMs: number;
  grounded: boolean;
  sources?: Array<{ url: string; title?: string }>;
}

export interface AIError {
  provider: AIProvider;
  error: string;
  retryable: boolean;
  statusCode?: number;
}

export interface AIProviderClient {
  name: AIProvider;
  available(): Promise<boolean>;
  complete(req: AIRequest): Promise<AIResponse>;
}
