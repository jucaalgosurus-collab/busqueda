// Smoke: verifica que applyDaysBackFilter filtra por fecha correctamente
// Sprint D.1.4
import { applyDaysBackFilter } from '../lib/scrapers/newsroom';
import type { ScrapedArticle } from '../lib/scrapers/types';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const arts: ScrapedArticle[] = [
  { url: 'a', title: 'Reciente',  publishedAt: new Date(now - 1 * day),  content: '', contentHash: 'h1', outlet: 'x', outletType: 'corporate_newsroom', language: 'es', raw: { fetchMs: 0 } },
  { url: 'b', title: 'Viejo 30d', publishedAt: new Date(now - 30 * day), content: '', contentHash: 'h2', outlet: 'x', outletType: 'corporate_newsroom', language: 'es', raw: { fetchMs: 0 } },
  { url: 'c', title: 'Sin fecha', publishedAt: null,                     content: '', contentHash: 'h3', outlet: 'x', outletType: 'corporate_newsroom', language: 'es', raw: { fetchMs: 0 } },
  { url: 'd', title: 'Limite 2d', publishedAt: new Date(now - 2 * day),  content: '', contentHash: 'h4', outlet: 'x', outletType: 'corporate_newsroom', language: 'es', raw: { fetchMs: 0 } },
];

const out2 = applyDaysBackFilter(arts, 2);
const outNone = applyDaysBackFilter(arts, undefined);
const outZero = applyDaysBackFilter(arts, 0);

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, info?: unknown): void {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else      { fail++; console.error(`  FAIL  ${name}`, info); }
}

console.log('=== applyDaysBackFilter smoke (Sprint D.1.4) ===');
assert('daysBack=2 mantiene reciente (1d)',          out2.find(a => a.url === 'a') !== undefined);
assert('daysBack=2 descarta viejo (30d)',             out2.find(a => a.url === 'b') === undefined);
assert('daysBack=2 mantiene sin fecha',               out2.find(a => a.url === 'c') !== undefined);
assert('daysBack=2 mantiene en el límite (2d exact)', out2.find(a => a.url === 'd') !== undefined);
assert('daysBack=2 total = 3 (a, c, d)',              out2.length === 3);
assert('daysBack=undefined no filtra (4 items)',      outNone.length === 4);
assert('daysBack=0 no filtra (4 items)',              outZero.length === 4);

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
