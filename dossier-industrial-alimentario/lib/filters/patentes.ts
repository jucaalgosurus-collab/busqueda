// lib/filters/patentes.ts — Sprint C.3
//
// Filtro de matching titular ↔ empresa.
// Dado un RawPatentHit.applicant, decide si pertenece a la empresa
// que estamos buscando. Tolerante a variaciones: 'CALIDAD PASCUAL, S.A.U.'
// matchea "Calidad Pascual".

function nfd(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/["',.\s]+/g, ' ')
    .trim();
}

/**
 * Devuelve los tokens significativos (≥4 chars) del nombre de la empresa.
 * "Calidad Pascual" → ['calidad', 'pascual']
 * "Nueva Pescanova" → ['nueva', 'pescanova']
 */
export function significantTokens(companyName: string): string[] {
  return nfd(companyName)
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

/**
 * Decide si el applicant (titular de la patente) corresponde a la empresa
 * que estamos buscando. La heurística exige que al menos UN token
 * significativo del nombre empresa aparezca en el applicant.
 */
export function isRelevantPatentHit(
  hit: { applicant: string; title?: string },
  companyName: string,
): boolean {
  const tokens = significantTokens(companyName);
  if (tokens.length === 0) return false;
  const applicantNfd = nfd(hit.applicant);
  if (!applicantNfd) return false;
  return tokens.some((t) => applicantNfd.includes(t));
}
