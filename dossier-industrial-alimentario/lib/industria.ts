// lib/industria.ts
// Taxonomía de sectores industriales cubiertos por HERMES Dossier.
// Sprint E.3 — 10 sectores del brief 2026-06-04. La taxonomía anterior (6 sectores)
// se reemplaza por esta más granular. Backwards compat: 'Otro industrial' → 'Industria en General'.
//
// Reglas duras (ver plan /memoria):
// - Cobertura SOLO España (17 CCAA), sin Latam/UK/DE.
// - CONTACTOS enriquecidos SOLO para A&B (sector='Alimentos y Bebidas') por orden del usuario.
//   Resto: detección + ficha, sin contactos.
// - NO concursos de acreedores, NO subastas (lo lleva otro dpto. Surus).
//
// 3 categorías transversales (sin CNAE):
//   - 'Stock industrial': tickers bursátiles (CNMV, BME Growth, índices IBEX)
//   - 'Propiedad Intelectual Marcas y Patentes': OEPM/EUIPO (vía outletType='patent' / 'trademark')
//   - 'Patentes': alias de PI, queda como tag dentro de PI en queries
//
// Fuentes CNAE: https://www.ine.es/daco/daco42/clasificaciones/cnae25/notas.pdf

export type IndustriaSector =
  | 'Alimentos y Bebidas'                           // 1 — CNAE 10+11
  | 'Construccion'                                  // 2 — CNAE 41-43
  | 'Vehiculos'                                     // 3 — CNAE 29-30
  | 'Maquinaria'                                    // 4 — CNAE 28
  | 'Stock industrial'                              // 5 — sin CNAE, tickers bursátiles
  | 'Equipamiento Medico Laboratorio Biotecnologia' // 6 — CNAE 21, 26.6, 32.5, 72.11
  | 'Propiedad Intelectual Marcas y Patentes'       // 7 — transversal, vía OEPM/EUIPO
  | 'Energia'                                       // 8 — CNAE 05-09, 19, 35
  | 'Patentes'                                      // 9 — alias de PI, tag-only
  | 'Industria en General';                         // 10 — resto CNAE 13-33

// Mapa de subsectores granulares por sector amplio. Solo referencia técnica;
// la jerarquía superior manda en la UI y en Company.sector.
export const SUBSECTORES_POR_SECTOR: Record<IndustriaSector, string[]> = {
  'Alimentos y Bebidas': [
    'Cárnicas', 'Pescado', 'Frutas y verduras', 'Aceites', 'Lácteos',
    'Pan, pastas, galletas', 'Azúcar, chocolate, confitería', 'Piensos',
    'Platos preparados', 'Otros alimentación',
    'Aguas minerales', 'Refrescos', 'Cerveza', 'Vinos',
    'Licores y espirituosos', 'Sidra',
  ],
  Construccion: [
    'Construcción de edificios', 'Ingeniería civil', 'Actividades de construcción especializadas',
  ],
  Vehiculos: [
    'Vehículos de motor', 'Componentes de vehículos', 'Otro material de transporte',
  ],
  Maquinaria: [
    'Maquinaria industrial', 'Maquinaria agrícola', 'Maquinaria de uso específico',
  ],
  'Stock industrial': [
    'IBEX 35', 'Mercado Continuo', 'BME Growth', 'MAB', 'Tickers BME',
  ],
  'Equipamiento Medico Laboratorio Biotecnologia': [
    'Principios activos', 'Preparados farmacéuticos', 'Medicamentos veterinarios',
    'Equipos médicos', 'Material quirúrgico', 'Diagnóstico in vitro',
    'Biotecnología', 'I+D biomédica',
  ],
  'Propiedad Intelectual Marcas y Patentes': [
    'Patentes nacionales (OEPM)', 'Patentes europeas (EPO)', 'Marcas nacionales (OEPM)',
    'Marcas europeas (EUIPO)', 'Modelos de utilidad', 'Diseños industriales',
  ],
  Energia: [
    'Extracción de carbón', 'Extracción de crudo/gas', 'Refino de petróleo',
    'Energía eléctrica', 'Gas y vapor', 'Renovables',
  ],
  Patentes: [
    'Tag-only: igual a Propiedad Intelectual',
  ],
  'Industria en General': [
    'Textil', 'Confección', 'Cuero y calzado', 'Madera y corcho', 'Papel',
    'Artes gráficas', 'Química', 'Caucho y plásticos',
    'Productos minerales no metálicos', 'Metalurgia', 'Productos metálicos',
    'Muebles', 'Otras manufacturas',
  ],
};

export const INDUSTRIAS: Array<{
  sector: IndustriaSector;
  label: string;
  cnaePrefix: string[];
  descripcion: string;
  contactosHabilitados: boolean;
  /** Si true, sector se asigna por outletType/heurística (no por CNAE). */
  transversal: boolean;
}> = [
  { sector: 'Alimentos y Bebidas', label: 'Alimentos y Bebidas', cnaePrefix: ['10', '11'],
    descripcion: 'Industria de la alimentación y bebidas (CNAE 10+11).',
    contactosHabilitados: true, transversal: false },
  { sector: 'Construccion', label: 'Construcción', cnaePrefix: ['41', '42', '43'],
    descripcion: 'Construcción y actividades especializadas (CNAE 41-43).',
    contactosHabilitados: false, transversal: false },
  { sector: 'Vehiculos', label: 'Vehículos', cnaePrefix: ['29', '30'],
    descripcion: 'Vehículos de motor y otro material de transporte (CNAE 29-30).',
    contactosHabilitados: false, transversal: false },
  { sector: 'Maquinaria', label: 'Maquinaria', cnaePrefix: ['28'],
    descripcion: 'Maquinaria y equipo mecánico (CNAE 28).',
    contactosHabilitados: false, transversal: false },
  { sector: 'Stock industrial', label: 'Stock industrial', cnaePrefix: [],
    descripcion: 'Transversal: cobertura de tickers bursátiles (IBEX, MAB, BME Growth). Sin CNAE.',
    contactosHabilitados: false, transversal: true },
  { sector: 'Equipamiento Medico Laboratorio Biotecnologia',
    label: 'Equipamiento médico, laboratorio y biotecnología',
    cnaePrefix: ['21', '26.6', '32.5', '72.11'],
    descripcion: 'Farmacéutico (21), equipos médicos (26.6, 32.5), I+D biotecnológica (72.11).',
    contactosHabilitados: false, transversal: false },
  { sector: 'Propiedad Intelectual Marcas y Patentes',
    label: 'Propiedad Intelectual: marcas y patentes',
    cnaePrefix: [],
    descripcion: 'Transversal: outletType=patent|trademark (OEPM, EUIPO). Sin CNAE.',
    contactosHabilitados: false, transversal: true },
  { sector: 'Energia', label: 'Energía', cnaePrefix: ['05', '06', '07', '08', '09', '19', '35'],
    descripcion: 'Extractivas, refino, energía eléctrica, gas, vapor, renovables.',
    contactosHabilitados: false, transversal: false },
  { sector: 'Patentes', label: 'Patentes (tag)', cnaePrefix: [],
    descripcion: 'Alias de Propiedad Intelectual. Queda como tag de query, no sector real.',
    contactosHabilitados: false, transversal: true },
  { sector: 'Industria en General', label: 'Industria en general', cnaePrefix: ['13', '14', '15', '16', '17', '18', '20', '22', '23', '24', '25', '27', '31', '32', '33'],
    descripcion: 'Resto de manufacturas: textil, papel, química, plásticos, metales, muebles, etc.',
    contactosHabilitados: false, transversal: false },
];

export const INDUSTRIAS_POR_SECTOR: Record<IndustriaSector, typeof INDUSTRIAS[number]> =
  INDUSTRIAS.reduce((acc, ind) => {
    acc[ind.sector] = ind;
    return acc;
  }, {} as Record<IndustriaSector, typeof INDUSTRIAS[number]>);

export function sectorFromCnae(cnae: string | null | undefined): IndustriaSector {
  if (!cnae) return 'Industria en General';
  // Soporta prefijos de 2 dígitos y sub-prefijos (ej. "26.6", "32.5", "72.11")
  const prefix = cnae.split('.')[0].trim();
  const subPrefix = cnae.trim();
  for (const ind of INDUSTRIAS) {
    if (ind.transversal) continue;
    if (ind.cnaePrefix.includes(subPrefix)) return ind.sector;
    if (ind.cnaePrefix.includes(prefix)) return ind.sector;
  }
  return 'Industria en General';
}

export function industriasConContactos(): IndustriaSector[] {
  return INDUSTRIAS.filter((i) => i.contactosHabilitados).map((i) => i.sector);
}

export function labelDeIndustria(sector: string): string {
  return INDUSTRIAS.find((i) => i.sector === sector)?.label || sector;
}

/**
 * Transversal: detecta sector por outletType en vez de CNAE.
 * Usado cuando un Source llega sin CNAE claro (OEPM, CNMV, etc).
 */
export function sectorFromOutlet(outletType: string | null | undefined): IndustriaSector | null {
  if (!outletType) return null;
  const lower = outletType.toLowerCase();
  if (lower === 'patent' || lower === 'trademark') return 'Propiedad Intelectual Marcas y Patentes';
  if (lower === 'bofficial' || lower === 'cnmv') return 'Stock industrial';
  if (lower === 'regulatorio_aesan') return 'Alimentos y Bebidas';
  return null;
}

/** True si el sector es transversal (no se infiere por CNAE). */
export function isTransversal(sector: string): boolean {
  const ind = INDUSTRIAS.find((i) => i.sector === sector);
  return ind?.transversal ?? false;
}
