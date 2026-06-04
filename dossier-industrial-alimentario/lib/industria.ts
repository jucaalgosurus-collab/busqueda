// lib/industria.ts
// Taxonomía de sectores industriales cubiertos por HERMES Dossier.
// Brief 2026-06-03 (Juan Carlos): sectores amplios — 'alimentos y bebidas',
// 'industrial', 'farmaceutico', 'construccion', 'energetico', etc. El
// subsector mantiene el detalle técnico (Cárnicas, Lácteos, Refino, etc.).
//
// Reglas duras (ver plan /memoria):
// - Cobertura SOLO España (17 CCAA), sin Latam/UK/DE.
// - CONTACTOS enriquecidos SOLO para A&B (sector='Alimentos y Bebidas')
//   por orden del usuario. Resto: detección + ficha, sin contactos.
// - NO concursos de acreedores, NO subastas (lo lleva otro dpto. Surus).
//
// Fuentes CNAE: https://www.ine.es/daco/daco42/clasificaciones/cnae25/notas.pdf

export type IndustriaSector =
  | 'Alimentos y Bebidas'   // CNAE 10+11 — alimentación + bebidas (unificado)
  | 'Industrial'            // CNAE 13-33 — manufacturas, química, plástico, metales, transporte, etc.
  | 'Farmaceutico'          // CNAE 21 — productos farmacéuticos
  | 'Construccion'          // CNAE 41-43 — construcción y actividades inmobiliarias industriales
  | 'Energetico'            // CNAE 05-09, 19, 35 — extractivas, refino, energía eléctrica
  | 'Otro industrial';      // catch-all

// Mapa de subsectores granulares (referencia técnica, sin afectar a la jerarquía superior).
// Cualquier CNAE industrial mapea primero a sector amplio; el subsector conserva el detalle.
export const SUBSECTORES_POR_SECTOR: Record<IndustriaSector, string[]> = {
  'Alimentos y Bebidas': [
    // CNAE 10 — Alimentación
    'Cárnicas',          // 10.1
    'Pescado',           // 10.2
    'Frutas y verduras', // 10.3
    'Aceites',           // 10.4
    'Lácteos',           // 10.5
    'Pan, pastas, galletas', // 10.7
    'Azúcar, chocolate, confitería', // 10.8
    'Piensos',           // 10.9
    'Platos preparados', // 10.85
    'Otros alimentación',
    // CNAE 11 — Bebidas
    'Aguas minerales',  // 11.0
    'Refrescos',         // 11.0
    'Cerveza',           // 11.0
    'Vinos',             // 11.0
    'Licores y espirituosos', // 11.0
    'Sidra',             // 11.0
  ],
  Industrial: [
    'Textil',                // 13
    'Confección',            // 14
    'Cuero y calzado',       // 15
    'Madera y corcho',       // 16
    'Papel',                 // 17
    'Artes gráficas',        // 18
    'Química',               // 20
    'Caucho y plásticos',    // 22
    'Productos minerales no metálicos', // 23
    'Metalurgia',            // 24
    'Productos metálicos',   // 25
    'Maquinaria y equipo',   // 28
    'Vehículos de motor',    // 29
    'Otro material de transporte', // 30
    'Muebles',               // 31
    'Otras manufacturas',    // 32-33
  ],
  Farmaceutico: [
    'Principios activos',  // 21.1
    'Preparados farmacéuticos', // 21.2
    'Medicamentos veterinarios', // 21.2
  ],
  Construccion: [
    'Construcción de edificios', // 41
    'Ingeniería civil',         // 42
    'Actividades de construcción especializadas', // 43
  ],
  Energetico: [
    'Extracción de carbón',     // 05
    'Extracción de crudo/gas',  // 06-09
    'Refino de petróleo',       // 19
    'Energía eléctrica',        // 35.1
    'Gas y vapor',              // 35.2-35.3
    'Renovables',               // 35.1
  ],
  'Otro industrial': [
    'No clasificado',
  ],
};

export const INDUSTRIAS: Array<{
  sector: IndustriaSector;
  label: string;
  cnaePrefix: string[];
  descripcion: string;
  contactosHabilitados: boolean;
}> = [
  { sector: 'Alimentos y Bebidas', label: 'Alimentos y Bebidas', cnaePrefix: ['10', '11'],
    descripcion: 'Industria de la alimentación y fabricación de bebidas (CNAE 10+11). Cárnicas, lácteos, pescado, aceite, pan, azúcar, piensos, aguas, cervezas, vinos, refrescos, licores.',
    contactosHabilitados: true },
  { sector: 'Industrial', label: 'Industrial', cnaePrefix: ['13', '14', '15', '16', '17', '18', '20', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
    descripcion: 'Industria manufacturera diversa: textil, madera, papel, química, plástico, metales, maquinaria, vehículos, material de transporte, muebles, etc.',
    contactosHabilitados: false },
  { sector: 'Farmaceutico', label: 'Farmacéutico', cnaePrefix: ['21'],
    descripcion: 'Fabricación de productos farmacéuticos de base y preparados farmacéuticos.',
    contactosHabilitados: false },
  { sector: 'Construccion', label: 'Construcción', cnaePrefix: ['41', '42', '43'],
    descripcion: 'Construcción de edificios, ingeniería civil y actividades especializadas de construcción.',
    contactosHabilitados: false },
  { sector: 'Energetico', label: 'Energético', cnaePrefix: ['05', '06', '07', '08', '09', '19', '35'],
    descripcion: 'Industrias extractivas, refino de petróleo, energía eléctrica, gas, vapor, aire acondicionado y renovables.',
    contactosHabilitados: false },
  { sector: 'Otro industrial', label: 'Otro industrial', cnaePrefix: [],
    descripcion: 'Cualquier otro CNAE industrial no categorizado',
    contactosHabilitados: false },
];

// Devuelve el sector industrial a partir de un código CNAE de 2 dígitos
export function sectorFromCnae(cnae: string | null | undefined): IndustriaSector {
  if (!cnae) return 'Otro industrial';
  const prefix = cnae.split('.')[0].trim();
  for (const ind of INDUSTRIAS) {
    if (ind.cnaePrefix.includes(prefix)) return ind.sector;
  }
  return 'Otro industrial';
}

// Devuelve las industrias para las que SÍ se extraen contactos (FASE 4+5)
// Por ahora: solo Alimentación + Bebidas
export function industriasConContactos(): IndustriaSector[] {
  return INDUSTRIAS.filter((i) => i.contactosHabilitados).map((i) => i.sector);
}

export function labelDeIndustria(sector: string): string {
  return INDUSTRIAS.find((i) => i.sector === sector)?.label || sector;
}
