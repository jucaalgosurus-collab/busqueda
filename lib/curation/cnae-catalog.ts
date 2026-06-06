// lib/curation/cnae-catalog.ts — Catálogo CNAE-4d por sector
// Sprint S.2 — Top-N por sector con priorización A&B
// Reglas durables: R-08 (A&B prioridad #1 con todas las etapas de cadena)

export type EtapaCadena = 'primaria' | 'transformacion' | 'distribucion';
export type SectorCodigo = 'a&b' | 'energia' | 'quimica' | 'construccion' | 'banca' | 'defensa';

export interface CnaeEntry {
  cnae: string;       // 4 dígitos
  literal: string;    // descripción oficial
  sector: SectorCodigo;
  etapa?: EtapaCadena; // solo A&B
}

export const CNAES_AB: CnaeEntry[] = [
  // === PRIMARIA (origen animal/vegetal) ===
  { cnae: '1011', sector: 'a&b', etapa: 'primaria', literal: 'Procesado y conservación de carne excepto volatería' },
  { cnae: '1012', sector: 'a&b', etapa: 'primaria', literal: 'Procesado y conservación de volatería' },
  { cnae: '1013', sector: 'a&b', etapa: 'primaria', literal: 'Elaboración de productos cárnicos y de volatería' },
  { cnae: '1021', sector: 'a&b', etapa: 'primaria', literal: 'Procesado de pescados, crustáceos y moluscos' },
  { cnae: '1043', sector: 'a&b', etapa: 'primaria', literal: 'Fabricación de aceite de oliva' },
  { cnae: '1061', sector: 'a&b', etapa: 'primaria', literal: 'Fabricación de productos de molinería' },
  { cnae: '1091', sector: 'a&b', etapa: 'primaria', literal: 'Fabricación de productos para alimentación de animales de granja' },
  { cnae: '1092', sector: 'a&b', etapa: 'primaria', literal: 'Fabricación de productos para alimentación de animales de compañía' },

  // === TRANSFORMACIÓN (elaboración) ===
  { cnae: '1022', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de conservas de pescado' },
  { cnae: '1031', sector: 'a&b', etapa: 'transformacion', literal: 'Procesado y conservación de patatas' },
  { cnae: '1032', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de zumos de frutas y hortalizas' },
  { cnae: '1039', sector: 'a&b', etapa: 'transformacion', literal: 'Otro procesado y conservación de frutas y hortalizas' },
  { cnae: '1042', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de margarina y grasas comestibles' },
  { cnae: '1044', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de otros aceites y grasas' },
  { cnae: '1052', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de helados' },
  { cnae: '1053', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de quesos' },
  { cnae: '1054', sector: 'a&b', etapa: 'transformacion', literal: 'Preparación de leche y otros productos lácteos' },
  { cnae: '1071', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de pan y productos frescos de panadería' },
  { cnae: '1072', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de galletas y productos de panadería duradera' },
  { cnae: '1073', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de pastas alimenticias' },
  { cnae: '1081', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de azúcar' },
  { cnae: '1082', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de cacao, chocolate y confitería' },
  { cnae: '1083', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de café, té e infusiones' },
  { cnae: '1084', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de especias, salsas y condimentos' },
  { cnae: '1085', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de platos y comidas preparados' },
  { cnae: '1086', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de preparados alimenticios homogeneizados' },
  { cnae: '1089', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de otros productos alimenticios n.c.o.p.' },
  { cnae: '1101', sector: 'a&b', etapa: 'transformacion', literal: 'Destilación, rectificación y mezcla de bebidas alcohólicas' },
  { cnae: '1102', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de vinos' },
  { cnae: '1103', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de sidra y otras bebidas fermentadas' },
  { cnae: '1104', sector: 'a&b', etapa: 'transformacion', literal: 'Elaboración de otras bebidas no destiladas' },
  { cnae: '1105', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de cerveza' },
  { cnae: '1106', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de malta' },
  { cnae: '1107', sector: 'a&b', etapa: 'transformacion', literal: 'Fabricación de bebidas no alcohólicas y aguas embotelladas' },
];

// === COBERTURA SECUNDARIA (5 sectores, R-08) ===

export const CNAES_ENERGIA: CnaeEntry[] = [
  { cnae: '3511', sector: 'energia', literal: 'Producción de energía eléctrica' },
  { cnae: '3512', sector: 'energia', literal: 'Transporte de energía eléctrica' },
  { cnae: '3513', sector: 'energia', literal: 'Distribución de energía eléctrica' },
  { cnae: '3514', sector: 'energia', literal: 'Comercio de energía eléctrica' },
  { cnae: '3515', sector: 'energia', literal: 'Producción de energía hidroeléctrica' },
  { cnae: '3516', sector: 'energia', literal: 'Producción de energía eólica' },
  { cnae: '3517', sector: 'energia', literal: 'Producción de energía solar' },
  { cnae: '3518', sector: 'energia', literal: 'Producción de energía térmica (carbón, gas, nuclear)' },
  { cnae: '3519', sector: 'energia', literal: 'Producción de otra energía eléctrica n.c.o.p.' },
  { cnae: '3521', sector: 'energia', literal: 'Producción de gas' },
  { cnae: '3522', sector: 'energia', literal: 'Distribución de combustibles gaseosos por tubería' },
  { cnae: '3523', sector: 'energia', literal: 'Comercio de gas por tubería' },
];

export const CNAES_QUIMICA: CnaeEntry[] = [
  { cnae: '2011', sector: 'quimica', literal: 'Fabricación de gases industriales' },
  { cnae: '2012', sector: 'quimica', literal: 'Fabricación de colorantes y pigmentos' },
  { cnae: '2013', sector: 'quimica', literal: 'Fabricación de otros productos básicos de química inorgánica' },
  { cnae: '2014', sector: 'quimica', literal: 'Fabricación de otros productos básicos de química orgánica' },
  { cnae: '2015', sector: 'quimica', literal: 'Fabricación de fertilizantes y compuestos nitrogenados' },
  { cnae: '2016', sector: 'quimica', literal: 'Fabricación de plásticos en formas primarias' },
  { cnae: '2017', sector: 'quimica', literal: 'Fabricación de caucho sintético en formas primarias' },
];

export const CNAES_CONSTRUCCION: CnaeEntry[] = [
  { cnae: '4110', sector: 'construccion', literal: 'Promoción inmobiliaria' },
  { cnae: '4121', sector: 'construccion', literal: 'Construcción de edificios residenciales' },
  { cnae: '4122', sector: 'construccion', literal: 'Construcción de edificios no residenciales' },
  { cnae: '4211', sector: 'construccion', literal: 'Construcción de carreteras y autopistas' },
  { cnae: '4212', sector: 'construccion', literal: 'Construcción de vías férreas' },
  { cnae: '4213', sector: 'construccion', literal: 'Construcción de puentes y túneles' },
  { cnae: '4221', sector: 'construccion', literal: 'Construcción de redes para fluidos' },
  { cnae: '4222', sector: 'construccion', literal: 'Construcción de redes eléctricas y de telecomunicaciones' },
  { cnae: '4291', sector: 'construccion', literal: 'Obras hidráulicas' },
  { cnae: '4299', sector: 'construccion', literal: 'Construcción de otros proyectos de ingeniería civil n.c.o.p.' },
];

export const CNAES_BANCA: CnaeEntry[] = [
  { cnae: '6411', sector: 'banca', literal: 'Banco central' },
  { cnae: '6412', sector: 'banca', literal: 'Otros establecimientos financieros monetarios' },
  { cnae: '6419', sector: 'banca', literal: 'Otra intermediación monetaria' },
  { cnae: '6420', sector: 'banca', literal: 'Actividades de las sociedades holding' },
];

export const CNAES_DEFENSA: CnaeEntry[] = [
  { cnae: '2540', sector: 'defensa', literal: 'Fabricación de armas y municiones' },
  { cnae: '3040', sector: 'defensa', literal: 'Fabricación de vehículos militares de combate' },
  { cnae: '8010', sector: 'defensa', literal: 'Actividades de seguridad privada' },
  { cnae: '8020', sector: 'defensa', literal: 'Servicios de sistemas de seguridad' },
];

export const SECTORES: Record<SectorCodigo, CnaeEntry[]> = {
  'a&b': CNAES_AB,
  'energia': CNAES_ENERGIA,
  'quimica': CNAES_QUIMICA,
  'construccion': CNAES_CONSTRUCCION,
  'banca': CNAES_BANCA,
  'defensa': CNAES_DEFENSA,
};

export const SECTOR_LABELS: Record<SectorCodigo, string> = {
  'a&b': 'Alimentación y Bebidas',
  'energia': 'Energía',
  'quimica': 'Química',
  'construccion': 'Construcción',
  'banca': 'Banca y Finanzas',
  'defensa': 'Defensa',
};

export function getCnaesBySector(sector: SectorCodigo): readonly CnaeEntry[] {
  return SECTORES[sector];
}

export function getCnaesByEtapa(etapa: EtapaCadena): CnaeEntry[] {
  return CNAES_AB.filter((c) => c.etapa === etapa);
}

export function isAandBSector(sector: SectorCodigo): boolean {
  return sector === 'a&b';
}
