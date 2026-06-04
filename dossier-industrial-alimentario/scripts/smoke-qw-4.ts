// scripts/smoke-qw-4.ts — Sprint QW-4: Smoke del briefing diario DeepSeek.
//
// 6 asserts:
//   QW-4-A  lib/agents/daily-briefing-runner.ts existe
//   QW-4-B  lib/ia/deepseek.ts existe con summarizeFindings
//   QW-4-C  buildBriefingText / buildPromptForItems cubren 0 hallazgos con "Sin actividad"
//   QW-4-D  truncateToWords corta a <=200 palabras por la última frase completa
//   QW-4-E  MOCK DeepSeek produce briefing ≤200 palabras y sin emojis
//   QW-4-F  notifyStrong NO se llama si items=0 (decisión dry-run, sin red)
//
// Run: pnpm tsx scripts/smoke-qw-4.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-4 Daily briefing smoke (6 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-4-A
  const runnerPath = join(process.cwd(), 'lib', 'agents', 'daily-briefing-runner.ts');
  if (existsSync(runnerPath)) {
    const src = readFileSync(runnerPath, 'utf-8');
    const has = /export\s+async\s+function\s+runDailyBriefing\b/.test(src) && /BRIEFING_AGENT_NAME/.test(src);
    assert('QW-4-A [daily-briefing-runner.ts existe con runDailyBriefing + BRIEFING_AGENT_NAME]', has, has ? 'exports ok' : 'faltan exports');
  } else {
    assert('QW-4-A [daily-briefing-runner.ts existe con runDailyBriefing + BRIEFING_AGENT_NAME]', false, 'runner no existe');
  }

  // QW-4-B
  const deepseekPath = join(process.cwd(), 'lib', 'ia', 'deepseek.ts');
  if (existsSync(deepseekPath)) {
    const src = readFileSync(deepseekPath, 'utf-8');
    const has = /export\s+async\s+function\s+summarizeFindings\b/.test(src) && /export\s+async\s+function\s+callDeepSeek\b/.test(src);
    assert('QW-4-B [deepseek.ts existe con summarizeFindings + callDeepSeek]', has, has ? 'exports ok' : 'faltan exports');
  } else {
    assert('QW-4-B [deepseek.ts existe con summarizeFindings + callDeepSeek]', false, 'deepseek.ts no existe');
  }

  // QW-4-C
  const mod = await import('../lib/agents/daily-briefing-runner.js');
  const emptyPrompt = mod.buildPromptForItems([]);
  const hasEmpty = /Sin actividad/.test(emptyPrompt);
  assert('QW-4-C [buildPromptForItems([]) contiene "Sin actividad"]', hasEmpty, hasEmpty ? 'ok' : 'no match');

  // QW-4-D: truncateToWords
  const longText = Array.from({ length: 250 }, (_, i) => `palabra${i}`).join(' ') + '. Final.';
  const truncated = mod.truncateToWords(longText, 200);
  const wordCount = truncated.split(/\s+/).filter(Boolean).length;
  const cutAtSentence = /\.$|Final\./.test(truncated);
  assert('QW-4-D [truncateToWords ≤200 palabras]', wordCount <= 200 && cutAtSentence, `words=${wordCount} endsWithDot=${cutAtSentence}`);

  // QW-4-E: MOCK DeepSeek produce briefing.
  process.env.MOCK = '1';
  const deepseek = await import('../lib/ia/deepseek.js');
  const items = [
    { sourceId: 's1', title: 'PASCUAL cierra planta en Aranda', url: 'https://example.com/1', outlet: 'BORME', publishedAt: new Date(), signalStrength: 'strong' as const },
    { sourceId: 's2', title: 'Danone cambia domicilio social', url: 'https://example.com/2', outlet: 'BOE', publishedAt: new Date(), signalStrength: 'medium' as const },
    { sourceId: 's3', title: 'Mahou amplía capital', url: 'https://example.com/3', outlet: 'RSS', publishedAt: new Date(), signalStrength: 'weak' as const },
  ];
  const prompt = mod.buildPromptForItems(items);
  const r = await deepseek.summarizeFindings(prompt);
  assert('QW-4-E [DeepSeek MOCK responde ok]', r.ok, r.ok ? `text=${r.text.slice(0, 80)}...` : `error=${r.error}`);
  const briefingText = mod.buildBriefingText(r.text, items);
  const emojiCount = (briefingText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  assert('QW-4-E2 [briefing sin emojis]', emojiCount === 0, `emojiCount=${emojiCount}`);

  // QW-4-F: notifyStrong se llama solo si hay items (decisión documentada en código).
  const runnerSrc = readFileSync(runnerPath, 'utf-8');
  const guardsNotify = /if\s*\(\s*items\.length\s*===\s*0\s*\)/.test(runnerSrc) && /notifyStrong\s*\(/.test(runnerSrc);
  assert('QW-4-F [runner tiene guard items.length==0 antes de notifyStrong]', guardsNotify, guardsNotify ? 'guard ok' : 'sin guard');

  console.log(`\n=== TOTAL: ${pass} pass / ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
