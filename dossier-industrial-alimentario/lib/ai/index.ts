// lib/ai/index.ts — Re-exports del sistema de IA (versión app Next.js)
// Sprint UI.2 — Deep Dive usa orchestrator
export * from '../../../lib/ai/types';
export { DeepSeekClient } from '../../../lib/ai/deepseek';
export { GeminiClient } from '../../../lib/ai/gemini';
export { AIOrchestrator, getOrchestrator } from '../../../lib/ai/orchestrator';
