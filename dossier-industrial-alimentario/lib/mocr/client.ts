// lib/mocr/client.ts — Cliente MOCR (Docling + Gemini Vision) para clasificar
// documentos subidos: placas, certificados, balances, fotos de activos.
// Genera SkillEvaluation con grade IN [A,B,C,D] y findings JSONB.
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';

const PROMPT_BY_KIND: Record<string, string> = {
  nameplate: `Eres un auditor técnico de activos industriales. Recibirás una imagen de una placa de datos (nameplate). Tu trabajo es:
1. Identificar fabricante, modelo, número de serie.
2. Identificar specs clave (potencia, capacidad, voltaje, año, etc.).
3. Estimar condición técnica A/B/C/D:
   - A: operativo, mantenimiento al día, vida útil restante >70%
   - B: funcional con desgaste menor, vida útil 40-70%
   - C: funcional con desgaste significativo, vida útil 10-40%
   - D: no funcional / fuera de servicio / chatarra
4. Devolver JSON estricto:
{
  "grade": "A|B|C|D",
  "score": 0-100,
  "manufacturer": "string",
  "model": "string",
  "serialNumber": "string|null",
  "specs": { ... },
  "findings": ["..."],
  "confidence": 0-1
}`,
  certificate: `Eres un auditor de certificaciones de equipos industriales. Recibirás una imagen de un certificado (CE, ATEX, RETIE, NOM, INMETRO, COVENIN u otro). Tu trabajo es:
1. Identificar tipo de certificación y organismo emisor.
2. Identificar equipo/máquina certificada (si aparece).
3. Verificar vigencia (fecha de emisión/expiración).
4. Clasificar condición A/B/C/D según vigencia y alcance:
   - A: vigente, cubre toda la operación
   - B: vigente con limitaciones menores
   - C: vence pronto o tiene exclusiones
   - D: vencida o inválida
5. Devolver JSON estricto:
{
  "grade": "A|B|C|D",
  "score": 0-100,
  "certType": "string",
  "issuer": "string",
  "issuedAt": "string|null",
  "expiresAt": "string|null",
  "coveredEquipment": "string|null",
  "findings": ["..."],
  "confidence": 0-1
}`,
  balance_sheet: `Eres un analista financiero industrial. Recibirás un balance o cuenta de resultados. Tu trabajo es:
1. Identificar empresa, ejercicio, moneda.
2. Detectar señales de estrés: pérdidas, deuda creciente, fondos propios negativos, concurso.
3. Clasificar salud financiera A/B/C/D:
   - A: resultados positivos, deuda controlada
   - B: estable, márgenes ajustados
   - C: pérdidas o deuda significativa
   - D: concurso, disolución, fondos propios negativos
4. Devolver JSON estricto:
{
  "grade": "A|B|C|D",
  "score": 0-100,
  "company": "string",
  "fiscalYear": "string|null",
  "currency": "string",
  "keyMetrics": { ... },
  "stressSignals": ["..."],
  "findings": ["..."],
  "confidence": 0-1
}`,
  photo: `Eres un auditor técnico de activos industriales. Recibirás una foto de un activo industrial (maquinaria, vehículo, equipo). Tu trabajo es:
1. Identificar tipo de activo y fabricante si es visible.
2. Estimar condición visual A/B/C/D:
   - A: estado impecable, sin signos de uso intensivo
   - B: funcional con signos normales de uso
   - C: desgaste visible, corrosión, abolladuras
   - D: claramente fuera de servicio, chatarra, vandalizado
3. Devolver JSON estricto:
{
  "grade": "A|B|C|D",
  "score": 0-100,
  "assetType": "string",
  "manufacturer": "string|null",
  "model": "string|null",
  "visualObservations": ["..."],
  "findings": ["..."],
  "confidence": 0-1
}`,
};

export interface MocrResult {
  grade: 'A' | 'B' | 'C' | 'D';
  score: number;
  findings: Record<string, unknown>;
  rawText: string;
  confidence: number;
  durationMs: number;
}

export async function classifyDocument(opts: {
  filePath: string;
  kind: 'nameplate' | 'certificate' | 'balance_sheet' | 'photo';
  skill?: 'hermes-asset-valuation' | 'hermes-certifications' | 'hermes-technical-audit';
  companyId?: string;
  uploadedBy?: string;
}): Promise<MocrResult> {
  const startedAt = Date.now();
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured');

  const fileBytes = await readFile(opts.filePath);
  const sha256 = createHash('sha256').update(fileBytes).digest('hex');
  const base64 = fileBytes.toString('base64');
  const mime = opts.filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

  // Persist Document record
  const doc = await prisma.document.create({
    data: {
      companyId: opts.companyId ?? null,
      kind: opts.kind,
      fileUrl: `file://${opts.filePath}`,
      sha256,
      ocrProvider: 'gemini-2.5-flash',
    },
  });

  // Call Gemini Vision
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = PROMPT_BY_KIND[opts.kind];

  const resp = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: base64, mimeType: mime } },
      ],
    }],
  });
  const text = resp.response.text();

  // Parse JSON robusto
  let parsed: Record<string, unknown> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    parsed = { raw: text };
  }

  const grade = (parsed.grade as 'A' | 'B' | 'C' | 'D') ?? 'D';
  const score = Number(parsed.score ?? 0);
  const confidence = Number(parsed.confidence ?? 0.5);

  // Persist SkillEvaluation
  const skill = opts.skill ?? (opts.kind === 'nameplate' ? 'hermes-asset-valuation' : opts.kind === 'certificate' ? 'hermes-certifications' : 'hermes-technical-audit');
  await prisma.skillEvaluation.create({
    data: {
      documentId: doc.id,
      skill,
      grade,
      score,
      findings: JSON.parse(JSON.stringify(parsed)),
      evaluatorVersion: 'mocr-gemini-2.5-flash-v1',
    },
  });

  return {
    grade,
    score,
    findings: parsed,
    rawText: text,
    confidence,
    durationMs: Date.now() - startedAt,
  };
}
