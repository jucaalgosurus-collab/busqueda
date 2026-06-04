// lib/email/render.ts — Sprint QW-5: Render de plantillas email.
//
// Sustituye {{var}} en subject y body. Si falta una variable, deja el placeholder
// intacto (mejor que inventar) y reporta en `missing[]`.

import emailTemplates from '../data/email-templates.json' with { type: 'json' };

export interface EmailTemplate {
  id: string;
  sector: string;
  cargo: string;
  subject: string;
  body: string;
}

export interface RenderResult {
  subject: string;
  body: string;
  missing: string[];
  wordCount: number;
}

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(
  tpl: EmailTemplate,
  vars: Record<string, string | undefined>,
): RenderResult {
  const missing = new Set<string>();
  const substitute = (s: string): string =>
    s.replace(VAR_RE, (_m, name) => {
      const v = vars[name];
      if (v == null || v === '') {
        missing.add(name);
        return `{{${name}}}`;
      }
      return v;
    });
  const subject = substitute(tpl.subject);
  const body = substitute(tpl.body);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return { subject, body, missing: [...missing], wordCount };
}

export function listTemplates(): EmailTemplate[] {
  return emailTemplates as EmailTemplate[];
}

export function findTemplate(id: string): EmailTemplate | null {
  return listTemplates().find((t) => t.id === id) ?? null;
}

/** Lista plantillas agrupadas por sector. */
export function templatesBySector(): Record<string, EmailTemplate[]> {
  const out: Record<string, EmailTemplate[]> = {};
  for (const t of listTemplates()) {
    if (!out[t.sector]) out[t.sector] = [];
    out[t.sector].push(t);
  }
  return out;
}

