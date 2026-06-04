// lib/audit/admin-log.ts — E.10: log de auditoría del panel admin.
//
// Cada acción CRUD desde el panel deja un Note con author='admin' en la
// company correspondiente (o companyId de la planta). El body del Note
// es JSON con timestamp + acción + diff compacto. No usamos una tabla nueva:
// reusamos Note (que ya tiene author) y filtramos por author='admin' en
// el futuro para reconstruir la historia.
//
// ¿Por qué no una tabla propia? Porque el panel es 1 usuario (JC) y
// la empresa/cliente no va a ver estos Notes — son internos.
import { prisma } from '@/lib/db/prisma';

export type AdminAction =
  | 'company.create'
  | 'company.update'
  | 'company.soft_delete'
  | 'company.reactivate'
  | 'plant.create'
  | 'plant.update'
  | 'plant.soft_delete'
  | 'plant.reactivate';

export interface AdminLogInput {
  action: AdminAction;
  companyId: string;
  plantId?: string | null;
  actor?: string; // 'admin' por defecto
  changes?: Record<string, { from: unknown; to: unknown }>;
  meta?: Record<string, unknown>;
}

export async function logAdminAction(input: AdminLogInput): Promise<void> {
  const actor = input.actor ?? 'admin';
  const body = JSON.stringify({
    at: new Date().toISOString(),
    action: input.action,
    changes: input.changes ?? null,
    meta: input.meta ?? null,
  });
  try {
    await prisma.note.create({
      data: {
        companyId: input.companyId,
        plantId: input.plantId ?? null,
        author: actor,
        body: `[admin.${input.action}] ${body}`,
      },
    });
  } catch (e) {
    // El log de auditoría NO debe romper el flujo principal. Si falla,
    // log a consola y seguimos. (Regla R5: cero bloqueos por auditoría.)
    // eslint-disable-next-line no-console
    console.warn('[admin-log] failed to persist audit entry', {
      action: input.action,
      companyId: input.companyId,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}
