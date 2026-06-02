/**
 * Filtro semántico de desimplantación industrial.
 *
 * Pure function: dado un texto scrapeado, determina si describe inequívocamente
 * una desimplantación (cierre de planta, ERE, desinversión de activos, traslado,
 * venta de maquinaria, baja de inventario, mob/IT/vehículos fuera de uso,
 * deslocalización, fin de actividad).
 *
 * Diseño:
 *   1. Normaliza el texto (lowercase + sin acentos + trim).
 *   2. Negative filter primero: si detecta concurso o subasta claros, rechaza
 *      inmediatamente (esos casos NO son desimplantación asistible por Surus).
 *   3. Positive filter: suma pesos por categoría de keyword detectada.
 *   4. Anti-M&A filter: resta peso si detecta señales de inversión/adquisición.
 *   5. Score final = max(0, min(1, positivos - antiMA)). inScope = score >= 0.4.
 *
 * Sin dependencias externas. Cero mutación. Función pura.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeimplantationResult {
  /** true si el texto describe desimplantación (tras pasar filtros) */
  inScope: boolean;
  /** confianza normalizada 0..1 */
  score: number;
  /** keywords (normalizadas) que dispararon el positive filter, sin duplicados */
  signals: string[];
  /** motivo de rechazo si aplica */
  outOfScopeReason: 'not_deimplantation' | 'subasta' | 'concurso' | null;
}

// ---------------------------------------------------------------------------
// Constantes del algoritmo
// ---------------------------------------------------------------------------

/** Umbral mínimo de score para considerar inScope. */
const IN_SCOPE_THRESHOLD = 0.4;

/** Mínimo de caracteres del texto para ser evaluado. */
const MIN_TEXT_LENGTH = 50;

/** Suma teórica de pesos positivos (cap del score antes de anti-M&A). */
const POSITIVE_SCORE_CAP = 1.0;

/** Score mínimo: nunca negativo. */
const SCORE_FLOOR = 0;

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Normaliza texto para matching:
 *   - lowercase
 *   - elimina diacríticos (NFD + remove combining marks)
 *   - colapsa whitespace y trim
 *
 * No muta el input. Devuelve string nuevo.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Helpers de matching (sin regex /g para evitar lastIndex stateful)
// ---------------------------------------------------------------------------

/** Testea si un patrón regex (sin flag g) matchea el texto. */
function matches(pattern: RegExp, text: string): boolean {
  return pattern.test(text);
}

/**
 * Testea una lista de patterns. Devuelve la primera keyword normalizada
 * (string crudo) que matchea, o null si ninguna. Recorre en orden; la
 * "primera" se considera la más representativa para el signal report.
 */
function firstMatch(
  patterns: ReadonlyArray<{ pattern: RegExp; label: string }>,
  text: string
): string | null {
  for (const { pattern, label } of patterns) {
    if (matches(pattern, text)) return label;
  }
  return null;
}

/**
 * Devuelve todas las labels que matchean, sin duplicados.
 *
 * Si dos labels comparten prefijo (p.ej. 'cierre' y 'cierre de planta'),
 * se conserva la más específica (mayor longitud) y se descarta la genérica.
 * Esto evita que señales ruidosas eclipsen la información accionable que
 * verá el depto. comercial de Surus.
 */
function allMatches(
  rules: ReadonlyArray<{ pattern: RegExp; label: string; weight: number }>,
  text: string
): Array<{ label: string; weight: number }> {
  const matched: Array<{ label: string; weight: number }> = [];
  for (const { pattern, label, weight } of rules) {
    if (matches(pattern, text)) {
      matched.push({ label, weight });
    }
  }
  // Orden descendente por longitud: la más específica gana.
  matched.sort((a, b) => b.label.length - a.label.length);
  const kept: Array<{ label: string; weight: number }> = [];
  for (const hit of matched) {
    const isPrefixOfKept = kept.some((k) => k.label.includes(hit.label));
    if (!isPrefixOfKept) kept.push(hit);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Reglas de matching
// ---------------------------------------------------------------------------

/**
 * Negative filter: concurso de acreedores.
 * Estas situaciones NO son desimplantación asistible directa (la masa concursal
 * la gestiona el administrador concursal). Se rechazan antes de evaluar positivo.
 */
const CONCURSO_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /concurso de acreedores/, label: 'concurso de acreedores' },
  { pattern: /concurso voluntario/, label: 'concurso voluntario' },
  { pattern: /autoconcurso/, label: 'autoconcurso' },
  { pattern: /declaracion de concurso/, label: 'declaración de concurso' },
  { pattern: /declarada en concurso/, label: 'declarada en concurso' },
  { pattern: /administrador concursal/, label: 'administrador concursal' },
];

/**
 * Negative filter: subasta pública/judicial.
 * Cuando un activo sale a subasta ya hay un proceso concursal/judicial detrás;
 * no es desimplantación preventiva asistible.
 */
const SUBASTA_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /subasta publica/, label: 'subasta pública' },
  { pattern: /subasta judicial/, label: 'subasta judicial' },
  { pattern: /salida a subasta/, label: 'salida a subasta' },
  { pattern: /salen a subasta/, label: 'salen a subasta' },
  { pattern: /salira subasta/, label: 'salir a subasta' }, // typos ocasionales
  { pattern: /\bpuja\b/, label: 'puja' },
  { pattern: /lote (de )?subasta/, label: 'lote subasta' },
  { pattern: /lotes de subasta/, label: 'lotes subasta' },
  { pattern: /subasta (de|del) \d+/, label: 'subasta num' },
];

/**
 * Positive filter rules con peso. Cada entrada es un patrón regex (sin flag g)
 * con una label canónica para signals y un peso.
 *
 * Estructura: { pattern, label, weight }
 *   - pattern: RegExp.test compatible (sin /g)
 *   - label:   string normalizado que aparece en DeimplantationResult.signals
 *   - weight:  peso positivo (0..1)
 */
const POSITIVE_RULES: ReadonlyArray<{
  pattern: RegExp;
  label: string;
  weight: number;
}> = [
  // --- Cierre físico (peso 1.0) ---
  { pattern: /\bcierr[aeo]?\b/, label: 'cierre', weight: 1.0 },
  { pattern: /cierre (de |de la |del )?(su |la |el |las |los )?planta/, label: 'cierre de planta', weight: 1.0 },
  { pattern: /cierre de (la |el )?(fabrica|fábrica|instalacion|instalación)/, label: 'cierre de fábrica', weight: 1.0 },
  { pattern: /\bdesmantela\b/, label: 'desmantela', weight: 1.0 },
  { pattern: /desmantelamiento/, label: 'desmantelamiento', weight: 1.0 },
  { pattern: /\bclausur[oa]\b/, label: 'clausura', weight: 1.0 },
  { pattern: /clausura (de |de la |del )?(su |la |el )?(planta|fabrica|fábrica|instalacion|instalación)/, label: 'clausura de planta', weight: 1.0 },
  { pattern: /baja (de |de la |del )?(su |la |el )?(planta|linea|línea|instalacion|instalación)/, label: 'baja de planta', weight: 1.0 },
  { pattern: /fin de actividad/, label: 'fin de actividad', weight: 1.0 },

  // --- ERE / empleo (peso 0.9) ---
  { pattern: /\bere\b/, label: 'ERE', weight: 0.9 },
  { pattern: /expediente de regulacion/, label: 'expediente de regulación', weight: 0.9 },
  { pattern: /despido colectivo/, label: 'despido colectivo', weight: 0.9 },
  { pattern: /reduccion de plantilla/, label: 'reducción de plantilla', weight: 0.9 },
  { pattern: /recorte de empleo/, label: 'recorte de empleo', weight: 0.9 },
  { pattern: /ajuste laboral/, label: 'ajuste laboral', weight: 0.9 },

  // --- Desinversión / venta de activos (peso 0.9) ---
  { pattern: /desinvirt/, label: 'desinversión', weight: 0.9 },
  { pattern: /enajenacion (de |del )?(activo|instalacion)/, label: 'enajenación de activos', weight: 0.9 },
  { pattern: /vende (la|el|su) (planta|linea|negocio|activo|fabrica)/, label: 'vende planta/activo', weight: 0.9 },
  { pattern: /traspasa (la|el|su) (planta|negocio)/, label: 'traspasa planta/negocio', weight: 0.9 },
  { pattern: /transfiere (la|el) (planta|produccion|actividad)/, label: 'transfiere producción', weight: 0.9 },

  // --- Traslado de producción (peso 0.85) ---
  { pattern: /traslad[ao] (de |del )?(produccion|planta|fabrica|actividad)/, label: 'traslado de producción', weight: 0.85 },
  { pattern: /deslocaliz[ao]/, label: 'deslocalización', weight: 0.85 },
  { pattern: /muda (la|el|su) (produccion|planta) (a|desde)/, label: 'muda producción', weight: 0.85 },
  { pattern: /reubica (la|el|su) produccion/, label: 'reubica producción', weight: 0.85 },

  // --- Maq/IT/veh/mob fuera de uso (peso 0.7) ---
  { pattern: /venta de maquinaria/, label: 'venta de maquinaria', weight: 0.7 },
  { pattern: /liquidacion (de |del )?(equipo|inventario|mobiliario)/, label: 'liquidación de inventario/equipos', weight: 0.7 },
  { pattern: /baja de (equipo|inventario|flota|vehiculo|maquinaria)/, label: 'baja de equipo/flota', weight: 0.7 },
  { pattern: /retirada de (equipo|instalacion)/, label: 'retirada de equipos', weight: 0.7 },
  { pattern: /\bitad\b/, label: 'ITAD', weight: 0.7 },
  { pattern: /\bchatarra\b/, label: 'chatarra', weight: 0.7 },
  { pattern: /\bdesguace\b/, label: 'desguace', weight: 0.7 },
  { pattern: /vehiculo (fuera de uso|baja)/, label: 'vehículo fuera de uso', weight: 0.7 },

  // --- Liquidación no concursal / cese definitivo (peso 0.95) ---
  { pattern: /liquidacion (de la empresa|de la sociedad)/, label: 'liquidación de empresa', weight: 0.95 },
  { pattern: /disolucion (de la empresa|de la sociedad|mercantil)/, label: 'disolución mercantil', weight: 0.95 },
  { pattern: /cese (de |de la )?(actividad|operaciones|negocio)/, label: 'cese de actividad', weight: 0.95 },
  { pattern: /cierre definitivo/, label: 'cierre definitivo', weight: 0.95 },
];

/**
 * Anti-M&A / anti-inversión. Cada match resta del score. Si un texto tiene
 * tanto señales de desimplantación como de inversión, se interpreta como
 * movimiento estratégico complejo y se rechaza.
 *
 * Peso negativo: -0.6 por pattern detectado (cap de modo que el score final
 * no quede negativo).
 */
const ANTI_MA_RULES: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\badquier[eoa]\b/, label: 'adquisición' },
  { pattern: /\bcompra (la|el|el 100|el 50)\b/, label: 'compra activo' },
  { pattern: /\bfusion\b/, label: 'fusión' },
  { pattern: /\babsorcion\b/, label: 'absorción' },
  { pattern: /joint venture/, label: 'joint venture' },
  { pattern: /ampli[ae] (la|el|su) (planta|inversion|fabrica)/, label: 'amplía planta' },
  { pattern: /invierte \d+ millones/, label: 'invierte millones' },
  { pattern: /nueva planta/, label: 'nueva planta' },
  { pattern: /nueva fabrica/, label: 'nueva fábrica' },
  { pattern: /\bexpansion\b/, label: 'expansión' },
  { pattern: /\bcrecimiento\b/, label: 'crecimiento' },
];

const ANTI_MA_PENALTY = 0.6;

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

/**
 * Determina si un texto describe una desimplantación industrial.
 *
 * Función pura, sin efectos secundarios, sin mutación de input.
 *
 * @param text Texto scrapeado del artículo (título + cuerpo).
 * @returns DeimplantationResult con inScope, score, signals y motivo.
 */
export function isDeimplantation(text: string): DeimplantationResult {
  // 1) Edge case: texto vacío o demasiado corto.
  if (typeof text !== 'string' || text.length < MIN_TEXT_LENGTH) {
    return {
      inScope: false,
      score: 0,
      signals: [],
      outOfScopeReason: 'not_deimplantation',
    };
  }

  const normalized = normalize(text);

  // 2) Negative filter: concurso.
  const concursoHit = firstMatch(CONCURSO_PATTERNS, normalized);
  if (concursoHit) {
    return {
      inScope: false,
      score: 0,
      signals: [concursoHit],
      outOfScopeReason: 'concurso',
    };
  }

  // 3) Negative filter: subasta.
  const subastaHit = firstMatch(SUBASTA_PATTERNS, normalized);
  if (subastaHit) {
    return {
      inScope: false,
      score: 0,
      signals: [subastaHit],
      outOfScopeReason: 'subasta',
    };
  }

  // 4) Positive filter: desimplantación.
  const positiveHits = allMatches(POSITIVE_RULES, normalized);
  const positiveScore = positiveHits.reduce((acc, h) => acc + h.weight, 0);

  // 5) Anti-M&A filter.
  const antiMaHits = allMatches(
    ANTI_MA_RULES.map((r) => ({ ...r, weight: 0 })),
    normalized
  );
  const antiMaScore = antiMaHits.length * ANTI_MA_PENALTY;

  // 6) Score final normalizado a [0, 1].
  const raw = positiveScore - antiMaScore;
  const score = Math.max(SCORE_FLOOR, Math.min(POSITIVE_SCORE_CAP, raw));

  // 7) Sin matches positivos → noticia neutra / no relevante.
  if (positiveHits.length === 0) {
    return {
      inScope: false,
      score: 0,
      signals: [],
      outOfScopeReason: 'not_deimplantation',
    };
  }

  return {
    inScope: score >= IN_SCOPE_THRESHOLD,
    score,
    signals: positiveHits.map((h) => h.label),
    outOfScopeReason: score >= IN_SCOPE_THRESHOLD ? null : 'not_deimplantation',
  };
}

// ---------------------------------------------------------------------------
// SELF-TEST (descomentar para ejecutar en consola con `tsx`)
// ---------------------------------------------------------------------------
//
// import { isDeimplantation } from './deimplantation';
//
// const cases: Array<{ name: string; text: string; expect: (r: DeimplantationResult) => boolean }> = [
//   {
//     name: 'ERE claro',
//     text: 'Empresa X presenta un ERE que afecta a 200 trabajadores de su planta de Toledo',
//     expect: (r) => r.inScope === true && r.score >= 0.4,
//   },
//   {
//     name: 'Cierre de planta',
//     text: 'Y anuncia el cierre de su planta de Vigo con 150 despidos y el cese de la producción',
//     expect: (r) => r.inScope === true && r.signals.includes('cierre de planta'),
//   },
//   {
//     name: 'Inversión (descartar)',
//     text: 'Z invertirá 50 millones en ampliar su fábrica de Murcia con una nueva línea de producción',
//     expect: (r) => r.inScope === false,
//   },
//   {
//     name: 'Concurso (descartar)',
//     text: 'W ha sido declarada en concurso de acreedores tras el impago a proveedores durante meses',
//     expect: (r) => r.inScope === false && r.outOfScopeReason === 'concurso',
//   },
//   {
//     name: 'Subasta (descartar)',
//     text: 'Los activos de la antigua planta saldrán a subasta pública el próximo mes de julio',
//     expect: (r) => r.inScope === false && r.outOfScopeReason === 'subasta',
//   },
//   {
//     name: 'Venta de maquinaria',
//     text: 'Venta de maquinaria industrial procedente de la planta de Lleida, lotes completos disponibles',
//     expect: (r) => r.inScope === true && r.signals.includes('venta de maquinaria'),
//   },
//   {
//     name: 'Noticia neutra',
//     text: 'Resultados financieros del tercer trimestre: la compañía aumenta su facturación un 5%',
//     expect: (r) => r.inScope === false && r.outOfScopeReason === 'not_deimplantation',
//   },
//   {
//     name: 'Deslocalización',
//     text: 'La multinacional ha decidido deslocalizar su producción desde Cataluña a su planta de Polonia',
//     expect: (r) => r.inScope === true && r.signals.includes('deslocalización'),
//   },
//   {
//     name: 'Liquidación no concursal',
//     text: 'La junta de socios aprobó la liquidación de la sociedad y el cese de actividad en el segundo trimestre',
//     expect: (r) => r.inScope === true && r.outOfScopeReason === null,
//   },
//   {
//     name: 'Texto corto',
//     text: 'ERE 200',
//     expect: (r) => r.inScope === false && r.score === 0,
//   },
//   {
//     name: 'Vehículo fuera de uso',
//     text: 'Renovación de flota: baja de vehículo fuera de uso y retirada de equipos obsoletos del almacén',
//     expect: (r) => r.inScope === true,
//   },
//   {
//     name: 'M&A con matiz de desinversión',
//     text: 'La compañía adquiere una nueva planta en Francia tras vender la planta de Sevilla',
//     expect: (r) => r.inScope === false, // anti-M&A (-0.6) supera positivo (0.9) → 0.3 < 0.4
//   },
// ];
//
// for (const c of cases) {
//   const r = isDeimplantation(c.text);
//   const ok = c.expect(r);
//   console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
//   if (!ok) {
//     console.log('   text:', c.text);
//     console.log('   result:', r);
//   }
// }
