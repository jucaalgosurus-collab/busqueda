// lib/selectors/store.ts — Almacén de perfiles de selectores
// Sprint G.2 — Persistencia local JSON con escritura atómica
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SelectorProfile } from './types';

const STORE_PATH = join(process.cwd(), 'data', 'selectors', 'profiles.json');
const STORE_DIR = dirname(STORE_PATH);

let writeChain: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readStore(): Promise<Record<string, SelectorProfile>> {
  if (!existsSync(STORE_PATH)) return {};
  try {
    const raw = await readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, SelectorProfile>;
  } catch (err) {
    const ts = Date.now();
    const bakPath = `${STORE_PATH}.corrupt.${ts}.bak`;
    try {
      await rename(STORE_PATH, bakPath);
      console.error(`[selectors/store] JSON corrupto rescatado a ${bakPath}`);
    } catch {
      // ignore
    }
    return {};
  }
}

async function writeStoreAtomic(all: Record<string, SelectorProfile>): Promise<void> {
  if (!existsSync(STORE_DIR)) {
    await mkdir(STORE_DIR, { recursive: true });
  }
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, STORE_PATH);
}

export async function loadProfile(portalSlug: string): Promise<SelectorProfile | null> {
  const all = await readStore();
  return all[portalSlug] ?? null;
}

export async function saveProfile(profile: SelectorProfile): Promise<void> {
  await enqueue(async () => {
    const all = await readStore();
    all[profile.portalSlug] = profile;
    await writeStoreAtomic(all);
  });
}

export async function listProfiles(): Promise<SelectorProfile[]> {
  const all = await readStore();
  return Object.values(all);
}
