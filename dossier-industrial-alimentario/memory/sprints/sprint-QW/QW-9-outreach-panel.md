# Sprint Contract: QW-9 Panel Oculto Outreach + Generación de Correos

> **Pedido verbatim usuario 2026-06-03**: "TAMBIEN QUIERO EN EL MENU OCULTO TENER LA HERRAMIENTA AUTOMATICA DE CREACION DE CORREOS, QUE ME SALGA NOMBRE, CARGO Y PARA CADA PERSONA DEPENDIENDO DE SU NOMBRE CARGO, COMPAÑIA UN CORREO CON EL ESQUEMA QUE TE DIJE CON ANTERIORIDAD, DE MANERA QUE SOLO LE DE COPIAR PEGAR. PARA LA REDACCION DE CORREOS MIRAR SI HAY AGENTES QUE PIENSEN BIEN LAS PALABRAS DE MANERA QUE NO SEAN REPETITIVAS QUE SE TOQUE EL PAIN POINT DEL ESTUDIO Y QUE SE LE OFREZCA SOLUCION, ES DECIR UN MENU DESPLEGABLE EN EL QUE SELECCIONO COMPAÑIA Y ME SALE TODA LA INFORMACION, PERFILES LINKEDIN, DIRECCIONES DE CORREO, ADEMAS DE EL CORREO ELECTTRONICO PROPUESTO PERSONALIZADO"

## Objetivo

Construir **panel oculto** en `/admin/outreach` (sin aparecer en Navbar público) con menú desplegable para seleccionar compañía, mostrar TODOS los responsables con sus datos completos (nombre, cargo, planta, LinkedIn, email), y generar correos personalizados no repetitivos con pain point real + oferta de solución. El operador solo tiene que copiar/pegar.

## Restricciones duras (HJC + Sprint L + 2026-06-03)

1. **Panel OCULTO** — ruta `/admin/outreach` no aparece en Navbar. Solo accesible con key combo `Ctrl+Alt+A` (cliente) o tecleando URL directa.
2. **Aprobación humana** — el panel SOLO genera, NO envía. El operador copia el texto al portapapeles y lo pega en su cliente de correo.
3. **Pain point desde `Source` real** — cruzar últimos 30 hallazgos con `confidence > 0.6` de la compañía y mencionarlos en el saludo.
4. **Variabilidad** — DeepSeek genera con temperatura 0.85 + seed determinista por `(companyId, contactId, sector, cargo)` para que NO se repita entre decisores de la misma empresa.
5. **Tono profesional NO-IA** — checklist automática: sin "estimado/a", "no dude en", "quedo a su disposición", "me pongo en contacto", "espero su respuesta", superlativos vacíos, emojis. ≤120 palabras email, ≤300 chars LinkedIn DM.
6. **Variantes por cargo** — CFO (balance), Director de Planta (desimplantación técnica), COO (operaciones), Sostenibilidad (ESG), CEO (estrategia).
7. **Audit log** — tabla `OutreachLog` (id, companyId, contactId, channel, subject, body, status, createdAt, hash).
8. **GDPR** — opt-out por decisor + audit log + derecho al olvido.

## Entregables

### F1. Schema Prisma — `OutreachLog` (NUEVO)

```prisma
model OutreachLog {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  contactId   String
  contact     PlantContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel     String   // 'email' | 'linkedin_dm' | 'preview_only'
  subject     String
  body        String   @db.Text
  status      String   @default("generated") // 'generated' | 'copied' | 'sent_external' | 'discarded'
  createdAt   DateTime @default(now())
  hash        String   // SHA-256 del body para trazabilidad
  createdBy   String   @default("anon")
  
  @@index([companyId, createdAt])
  @@index([contactId, channel])
}
```

### F2. `lib/email/personalize.ts` (NUEVO)

Funciones:
- `extractPainPoints(companyId, days=90, minConfidence=0.6)`: query últimos N `Source` con `deimplantationSignal=true` y `confidence>0.6`, devuelve `Array<{date, title, outlet, signalStrength}>`.
- `seedForContact(companyId, contactId, sector, cargo)`: hash determinista → número 0-1 → seed para DeepSeek.
- `buildPrompt(vars)`: arma prompt a DeepSeek con dolor + cargo + sector + reglas tono + tamaño.

### F3. `lib/ia/email-generator.ts` (NUEVO)

```ts
export interface EmailDraft {
  subject: string;
  body: string;
  variantLinkedinShort: string;
  variantLinkedinLong: string;
  painPoints: PainPoint[];
  model: string;
  seed: number;
}

export async function generateEmailDraft(opts: {
  company: { id, name, slug, sector, subsector };
  contact: { id, fullName, role, roleCategory, email?, linkedinUrl?, plant? };
  painPoints: PainPoint[];
  template: EmailTemplate;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<EmailDraft>;
```

Usa DeepSeek `deepseek-chat` con temperatura 0.85. Si falla, fallback al template estático con `{{vars}}` sustituidos.

### F4. `app/admin/outreach/page.tsx` + `OutreachClient.tsx` (NUEVO)

- `page.tsx` (server): carga lista de todas las Company (orden A&B → Construcción) + roles disponibles + emails templates → pasa a `OutreachClient`.
- `OutreachClient.tsx` (client): "use client", `useState`:
  - `selectedCompany: Company | null`
  - `selectedContacts: PlantContact[]` (multiselect)
  - `emailTemplate: 'auto' | specific-template-id`
  - `drafts: Map<contactId, EmailDraft>`
  - `loadingContactId: string | null`
  - `showKeyHint: boolean` (Ctrl+Alt+A para mostrar/ocultar)
- UI:
  - Header con key combo `Ctrl+Alt+A` toggle visible
  - Dropdown 1: Compañía (search por nombre)
  - Tras seleccionar compañía: tabla de `PlantContact` con multiselect + checkboxes
  - Por cada contacto seleccionado: card con:
    - **Datos del decisor**: nombre, cargo, planta, LinkedIn (link), email (verificado o "no verificado")
    - **Pain points**: chips con fechas de los últimos hallazgos relevantes
    - **Borrador generado** (auto al seleccionar): subject + body email + variante LinkedIn corta + larga
    - **Botones**: "Regenerar", "Copiar email", "Copiar LinkedIn corto", "Copiar LinkedIn largo", "Editar inline"
  - Filtro por sede (planta) para que el operador pueda elegir solo los responsables de UNA sede
  - Footer: contador de borradores generados, link a `/admin/outreach/log`

### F5. `app/admin/outreach/log/page.tsx` (NUEVO)

Tabla con `OutreachLog` ordenado desc por `createdAt`. Filtros: companyId, contactId, channel, status.

### F6. `app/api/admin/outreach/generate/route.ts` (NUEVO)

`POST { companyId, contactIds, templateId?, regenerate? }` → genera `EmailDraft` para cada contact, persiste `OutreachLog` con `status='generated'`. Devuelve array de drafts.

### F7. `app/api/admin/outreach/copied/route.ts` (NUEVO)

`POST { outreachLogId, channel }` → actualiza `status='copied'`. Para tracking de uso.

### F8. Smoke `scripts/smoke-qw-9.ts` (NUEVO)

10 asserts:
- QW-9-A `lib/email/personalize.ts` exporta `extractPainPoints`, `seedForContact`, `buildPrompt`
- QW-9-B `lib/ia/email-generator.ts` exporta `generateEmailDraft`
- QW-9-C Página `/admin/outreach` existe
- QW-9-D Navbar NO contiene link a `/admin/outreach` (público)
- QW-9-E Schema Prisma tiene `OutreachLog` con campos requeridos
- QW-9-F `seedForContact` es determinista (mismo input → mismo seed)
- QW-9-G `seedForContact` distintos contactos misma empresa → seeds distintos
- QW-9-H `generateEmailDraft` con MOCK=true devuelve estructura EmailDraft válida
- QW-9-I Pain points extraídos solo de Source con `confidence > 0.6` y `deimplantationSignal=true`
- QW-9-J Tono OK: subject+body no contienen frases IA prohibidas (regex)

### F9. `package.json` — añadir `smoke:qw-9` script

### F10. `memory/state/active-state.md` — marcar QW-9 completed

## Success Criteria

- 10/10 asserts verdes en `pnpm tsx scripts/smoke-qw-9.ts`
- Type-check 0 errores
- Panel `/admin/outreach` carga <1.5s con lista de ~30+ empresas
- Dropdown 1: Compañía funciona
- Dropdown 2: contactos muestra todos los `PlantContact` con `plant` populated
- Filtro por sede funciona
- Generar borrador: subject + body email + 2 variantes LinkedIn
- Pain points vienen de `Source` real (no inventados)
- Copiar al portapapeles funciona
- Audit log persiste cada generación
- Navbar público NO muestra `/admin/outreach`

## Reglas duras (verificación pre-código)

| Regla | Cómo se enforce |
|---|---|
| Navbar sin `/admin/outreach` | No se añade en `NAV_LINKS` array |
| NO envío automático | Solo `navigator.clipboard.writeText`, sin SMTP |
| Variabilidad | Temperatura 0.85 + seed determinista por decisor |
| Pain point real | Query `Source` con filtros, no inventa |
| Tono NO-IA | Regex en validación, smoke QW-9-J |
| ≤120 palabras email | `wordCount` en validación |
| ≤300 chars LinkedIn DM | `length` en validación |
| Audit log | `OutreachLog.status` actualizado en cada acción |

## Pendiente VPS

Sync queda bloqueado por root pass. Trabajo se valida local con smoke.

## Próximo paso (post QW-9)

QW-3 Dark mode (interrumpido), luego continuar B.2..B.8 y resto del MEGAPLAN.
