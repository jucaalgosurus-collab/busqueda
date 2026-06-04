// scripts/smoke-qw-1.ts — Sprint QW-1: Smoke del módulo Telegram alerts.
//
// 7 asserts:
//   QW-1-A  lib/telegram/notify.ts existe y exporta notifyStrong + buildStrongAlert
//   QW-1-B  borme-runner.ts y auctions-runner.ts llaman a notifyStrong
//   QW-1-C  notify.ts respeta TELEGRAM_ALERTS_ENABLED=false (no spawnea)
//   QW-1-D  Anti-spam por source+day: 5 llamadas mismo sourceId → solo 1 sent
//   QW-1-E  Anti-spam global: 21 alertas distintas → solo 20 sent
//   QW-1-F  Texto contiene empresa + URL + título (sin escape roto)
//   QW-1-G  Plantilla sin emojis (regex Unicode emoji → 0 matches)
//
// Run: pnpm tsx scripts/smoke-qw-1.ts

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

const EMOJI_RE = /[-🿿]/u;

async function main() {
  console.log('=== HERMES DOSSIER v6 — Sprint QW-1 Telegram alerts smoke (7 asserts) ===');
  console.log(`Date: ${new Date().toISOString()}`);

  // QW-1-A: notify.ts existe y exporta notifyStrong + buildStrongAlert.
  const notifyPath = join(process.cwd(), 'lib', 'telegram', 'notify.ts');
  const botSendPath = join(process.cwd(), 'lib', 'telegram', 'bot_send.py');
  if (existsSync(notifyPath)) {
    const src = readFileSync(notifyPath, 'utf-8');
    const hasExport = /export\s+async\s+function\s+notifyStrong\b/.test(src) && /export\s+function\s+buildStrongAlert\b/.test(src);
    assert('QW-1-A [notify.ts existe y exporta notifyStrong + buildStrongAlert]', hasExport, hasExport ? 'exports ok' : 'faltan exports');
  } else {
    assert('QW-1-A [notify.ts existe y exporta notifyStrong + buildStrongAlert]', false, 'notify.ts no existe');
  }
  assert('QW-1-A2 [bot_send.py existe]', existsSync(botSendPath), existsSync(botSendPath) ? 'ok' : 'falta');

  // QW-1-B: runners llaman a notifyStrong.
  const bormeRunner = readFileSync(join(process.cwd(), 'lib', 'agents', 'borme-runner.ts'), 'utf-8');
  const auctionsRunner = readFileSync(join(process.cwd(), 'lib', 'agents', 'auctions-runner.ts'), 'utf-8');
  const bormeCalls = /notifyStrong\s*\(/.test(bormeRunner);
  const auctionsCalls = /notifyStrong\s*\(/.test(auctionsRunner);
  assert('QW-1-B [borme-runner.ts llama a notifyStrong]', bormeCalls, bormeCalls ? 'import + call' : 'no call');
  assert('QW-1-B2 [auctions-runner.ts llama a notifyStrong]', auctionsCalls, auctionsCalls ? 'import + call' : 'no call');

  // QW-1-C: notify.ts respeta TELEGRAM_ALERTS_ENABLED=false.
  if (existsSync(notifyPath)) {
    const src = readFileSync(notifyPath, 'utf-8');
    const hasGuard = /TELEGRAM_ALERTS_ENABLED/.test(src) && /alerts_disabled/.test(src);
    assert('QW-1-C [notify.ts respeta TELEGRAM_ALERTS_ENABLED=false]', hasGuard, hasGuard ? 'guard + reason' : 'sin guard');
  } else {
    assert('QW-1-C [notify.ts respeta TELEGRAM_ALERTS_ENABLED=false]', false, 'notify.ts no existe');
  }

  // QW-1-D: anti-spam por source+day. 5 calls con mismo sourceId → 1 sent, 4 dedup.
  process.env.MOCK = '1';
  process.env.TELEGRAM_ALERTS_ENABLED = 'true';
  process.env.TELEGRAM_CHAT_ID = '123456';
  process.env.TELEGRAM_MAX_PER_DAY = '100';
  // Cargar fresh.
  const mod = await import('@/lib/telegram/notify');
  mod._resetNotifyStateForTests();
  const baseSource = {
    id: 'src-1',
    title: 'Cambio de domicilio social — PASCUAL SA',
    url: 'https://example.com/borme/1',
    outlet: 'BORME',
    outletType: 'bofficial_borme',
    publishedAt: '2026-06-03',
  };
  const baseCompany = { id: 'c1', name: 'PASCUAL', slug: 'pascual' };
  let dSent = 0;
  for (let i = 0; i < 5; i++) {
    const r = await mod.notifyStrong({
      source: baseSource,
      company: baseCompany,
      signalStrength: 'strong',
    });
    if (r.sent) dSent++;
  }
  assert('QW-1-D [Anti-spam: 5 calls mismo sourceId → 1 sent]', dSent === 1, `sent=${dSent}`);

  // QW-1-E: anti-spam global. 21 sources distintos → solo 20 sent.
  mod._resetNotifyStateForTests();
  process.env.TELEGRAM_MAX_PER_DAY = '20';
  let eSent = 0;
  let eSkipped = 0;
  for (let i = 0; i < 21; i++) {
    const r = await mod.notifyStrong({
      source: { ...baseSource, id: `src-${i}`, url: `https://example.com/${i}` },
      company: baseCompany,
      signalStrength: 'strong',
    });
    if (r.sent) eSent++;
    if (r.reason === 'daily_quota_exceeded') eSkipped++;
  }
  assert('QW-1-E [Anti-spam global: 21 → 20 sent, 1 quota_exceeded]', eSent === 20 && eSkipped === 1, `sent=${eSent} skipped=${eSkipped}`);

  // QW-1-F: buildStrongAlert contiene empresa + URL + título.
  const text = mod.buildStrongAlert({
    source: baseSource,
    company: baseCompany,
    signalStrength: 'strong',
    reason: 'cambio_domicilio_social',
    plantCity: 'Aranda de Duero',
    plantProvince: 'Burgos',
  });
  const hasCompany = text.includes('PASCUAL');
  const hasUrl = text.includes(baseSource.url);
  const hasTitle = text.includes(baseSource.title.slice(0, 50));
  const hasLocation = text.includes('Aranda de Duero') && text.includes('Burgos');
  assert(
    'QW-1-F [Texto contiene empresa + URL + título + location]',
    hasCompany && hasUrl && hasTitle && hasLocation,
    `company=${hasCompany} url=${hasUrl} title=${hasTitle} loc=${hasLocation}`,
  );

  // QW-1-G: plantilla sin emojis.
  const emojiCount = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  assert('QW-1-G [Plantilla sin emojis]', emojiCount === 0, `emojiCount=${emojiCount}`);

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
