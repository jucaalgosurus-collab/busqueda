// lib/borme/upsert.ts — Sprint C.1
// Persistencia idempotente de ParsedBormeEvent en BormeEvent.
// Idempotencia por matchHash = sha256(cif||'NOCIF' + tipo + fecha-iso-date + bormeId).

import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { ParsedBormeEvent } from './parser';

export interface UpsertResult {
  matchHash: string;
  action: 'created' | 'updated' | 'skipped';
  bormeEventId: string;
}

/**
 * Calcula el matchHash determinista. Mismo (cif, tipo, fecha, bormeId) → mismo hash.
 */
export function computeMatchHash(event: ParsedBormeEvent): string {
  const fechaStr = event.fecha.toISOString().slice(0, 10);
  const raw = `${event.cif ?? 'NOCIF'}|${event.tipo}|${fechaStr}|${event.bormeId}`;
  return 'c1-' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Upsert idempotente. Si matchHash ya existe, no hace nada.
 * Si no, crea fila con companyId si se pasa.
 */
export async function upsertBormeEvent(
  prisma: PrismaClient,
  event: ParsedBormeEvent,
  companyId: string | null
): Promise<UpsertResult> {
  const matchHash = computeMatchHash(event);

  const existing = await prisma.bormeEvent.findUnique({ where: { matchHash } });
  if (existing) {
    return { matchHash, action: 'skipped', bormeEventId: existing.id };
  }

  const created = await prisma.bormeEvent.create({
    data: {
      matchHash,
      cif: event.cif,
      companyName: event.companyName,
      fecha: event.fecha,
      tipo: event.tipo,
      bormeId: event.bormeId,
      provincia: event.provincia,
      domicilio: event.domicilio,
      capital: event.capital,
      rawText: event.rawText,
      fuente: event.fuente,
      companyId,
    },
  });

  return { matchHash, action: 'created', bormeEventId: created.id };
}

/**
 * Tras el backfill, intenta rellenar Company.cif / cnae desde el último evento BormeEvent
 * de tipo constitucion o cuentas. Es best-effort: solo actualiza si el campo está vacío.
 */
export async function backfillCompanyFromBorme(
  prisma: PrismaClient,
  companyId: string
): Promise<{ updatedFields: string[] }> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { updatedFields: [] };

  const updates: Record<string, string> = {};

  // CIF: busca cualquier evento con cif no-null
  if (!company.cif) {
    const ev = await prisma.bormeEvent.findFirst({
      where: { companyId, cif: { not: null } },
      orderBy: { fecha: 'desc' },
      select: { cif: true },
    });
    if (ev?.cif) updates.cif = ev.cif;
  }

  // CNAE: busca el primer evento con cnae no-null (en rawText)
  if (!company.cnae) {
    const ev = await prisma.bormeEvent.findFirst({
      where: { companyId, OR: [{ tipo: 'constitucion' }, { tipo: 'cuentas' }] },
      orderBy: { fecha: 'desc' },
    });
    if (ev) {
      // Re-extrae CNAE del rawText
      const m = ev.rawText.match(/\b(\d{2}\.\d{1,2})\b/);
      if (m) updates.cnae = m[1];
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updatedFields: [] };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: updates,
  });

  return { updatedFields: Object.keys(updates) };
}
