// lib/selectors/store.ts — Almacén de perfiles de selectores
// Sprint G.2 — Persistencia local JSON
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SelectorProfile } from './types';

const STORE_PATH = join(process.cwd(), 'data', 'selectors', 'profiles.json');

export async function loadProfile(portalSlug: string): Promise<SelectorProfile | null> {
  if (!existsSync(STORE_PATH)) return null;
  const raw = await readFile(STORE_PATH, 'utf-8');
  const all = JSON.parse(raw) as Record<string, SelectorProfile>;
  return all[portalSlug] ?? null;
}

export async function saveProfile(profile: SelectorProfile): Promise<void> {
  if (!existsSync(dirname(STORE_PATH))) {
    await mkdir(dirname(STORE_PATH), { recursive: true });
  }
  const all = existsSync(STORE_PATH)
    ? (JSON.parse(await readFile(STORE_PATH, 'utf-8')) as Record<string, SelectorProfile>)
    : {};
  all[profile.portalSlug] = profile;
  await writeFile(STORE_PATH, JSON.stringify(all, null, 2));
}

export async function listProfiles(): Promise<SelectorProfile[]> {
  if (!existsSync(STORE_PATH)) return [];
  const all = JSON.parse(await readFile(STORE_PATH, 'utf-8')) as Record<string, SelectorProfile>;
  return Object.values(all);
}
