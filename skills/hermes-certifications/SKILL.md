---
name: hermes-certifications
description: Certificaciones regulatorias por pais para activos industriales: CE marking, ATEX, NOM-001-SEDE, RETIE, INMETRO/NR, COVENIN/OFAC. Usa cuando se mencione certificacion, normativa, regulacion, compliance, exportacion de equipos, homologacion, RETIE, NOM, ATEX, INMETRO, COVENIN, marcado CE, importacion de maquinaria.
dependencies: [orchestrator-route]
triggers:
  - certificaciones industriales por pais
  - cumplimiento normativo de equipos
  - marcado CE y ATEX
  - RETIE Colombia
  - NOM Mexico
  - INMETRO Brasil
  - COVENIN Venezuela
  - homologacion de equipos industriales
  - exportacion/importacion de maquinaria usada
  - compliance regulatorio activos
tags: [hermes, certifications, regulatory, CE, ATEX, RETIE, NOM, INMETRO, COVENIN, OFAC, compliance]
---

# HERMES - Certificaciones Regulatorias por Pais

Marco normativo completo para la comercializacion y operacion de activos industriales de segunda vida en distintos paises.

## Union Europea: Marcado CE y ATEX

### Marcado CE
- **Directiva de Maquinas**: 2006/42/CE - Cumplimiento obligatorio para maquinaria
- **Directiva de Baja Tension**: 2014/35/UE - Equipos electricos baja tension
- **Directiva de Compatibilidad Electromagnetica**: 2014/30/UE
- **Proceso**: Evaluacion de conformidad, documentacion tecnica, declaracion de incorporacion/CE, marcado fisico
- **Para activos usados**: Se requiere demostrar que cumplen las directivas vigentes al momento de la primera puesta en servicio

### Directiva ATEX (2014/34/UE)
- **Alcance**: Equipos y sistemas de proteccion para uso en atmósferas explosivas
- **Categorias**:
  - **Categoria I** (zona 22/21/2/1): Equipos con requisitos basicos
  - **Categoria II** (zona 22/21/1): Alta proteccion
  - **Categoria III** (zona 0/20): Proteccion muy alta
- **Grupos**:
  - **Grupo I**: Minas con grisou
  - **Grupo II**: Otras industrias (superficie)
- **Marcado**: CE + numero del organismo notificado + simbolos de grupo/categoria
- **Obligatorio para**: Refinerias, plantas quimicas, silos, industrias con polvo combustible
- **Red flag**: Un activo sin marcado ATEX en zona clasificada es INOPERABLE legalmente

## Colombia: RETIE

### Reglamento Tecnico de Instalaciones Electricas
- **Certificado de Conformidad de Producto**: Emitido por organismo acreditado por ONAC
- **Dictamen de Inspeccion**: Obligatorio para puesta en marcha
- **Para activos usados/remanufacturados > 1,000 kVA**:
  - Permite "Declaracion de Proveedor" como demostracion de conformidad
  - **Obligatorio**: Demostrar que el equipo esta libre de PCB (Bifenilos Policlorados)
  - Requiere declaracion avalada con ensayos
- **Normas de referencia**: NTC 2050, NTC-IEC 60076, RETIE actualizado
- **Institucion responsable**: Ministerio de Minas y Energia
- **Red flag**: Activos con fluido dielectrico sin certificado libre de PCB = bloqueo total

## Mexico: NOM

### NOM-001-SEDE-2012
- **Alcance**: Instalaciones electricas (basada en NFPA 70)
- **Requisito**: Dictamen por UVIE (Unidad de Verificacion de Instalaciones Electricas) acreditada por SENER
- **Proceso**: Verificacion + dictamen + registro

### NOM-004-STPS-1999
- **Alcance**: Seguridad de maquinaria y equipo
- **Requisitos**: Protecciones, dispositivos de seguridad, manual de operacion en espanol
- **Para maquinaria usada importada**:
  - Debe cumplir con normas mexicanas de seguridad
  - Manual en espanol obligatorio
  - Aviso de riesgo visible

### NOM-001-SEDE vigente (actualizaciones)
- Verificar version mas reciente al momento de la evaluacion
- Requiere instalacion electrica conforme a NOM + verificacion por UVIE

## Brasil: NR-12, NR-10 e INMETRO

### NR-12 (Seguridad de Maquinaria)
- **Barrera severa para maquinaria usada**
- Exige adaptacion a seguridad intrinseca funcional (ISO 13857/ISO 13849-2)
- **Prohibe** el uso de maquinas que no cumplan
- **A.R.T. obligatoria**: Anotacao de Responsabilidade Tecnica firmada por ingeniero del CREA
- **Laudo de Validacao**: Documento tecnico que certifica la conformidad de la maquina

### NR-10 (Seguridad Electrica)
- Rige seguridad electrica
- Impone estandar IEC 60204-1
- Codigo de colores brasileño propio

### INMETRO
- Gestion de calibraciones y conformidades generales
- Certificacion de productos obligatoria para ciertos equipos
- Metrologia legal

### Red flags Brasil
- Maquinaria usada sin A.R.T. = no puede operar legalmente
- Sin Laudo de Validacao = bloqueo regulatorio
- No cumple NR-12 = prohibicion de uso

## Venezuela: COVENIN y OFAC

### Normas COVENIN
- **Contexto critico**: Operan bajo riesgo geopolitico de sanciones OFAC estadounidenses
- **Riesgo SDN**: Activos con historial en PdVSA sin licencia = riesgo de bloqueo en lista SDN
- **Licencia General 4A (GL 4A)**:
  - Revoco temporalmente operaciones de GL 4
  - Cierre al 18 de mayo de 2024
  - Prohibe iniciar nuevos acuerdos de inversion comercial petrolera/gasifera
- **Red flag critico**: Cualquier activo con trazabilidad a PdVSA requiere due diligence OFAC extensiva
- **Normas tecnicas**: COVENIN 301 (electrico), COVENIN 316 (transformadores), entre otras

## Resumen Comparativo Rapido

| Pais | Certificacion | Barrera para Usados | Red Flag Principal |
|------|--------------|---------------------|-------------------|
| UE | CE + ATEX | Alta (directivas vigentes) | Sin marcado ATEX en zona clasificada |
| Colombia | RETIE + ONAC | Media (Declaracion Proveedor >1MVA) | PCB sin certificar |
| Mexico | NOM-001 + UVIE | Alta (dictamen obligatorio) | Sin UVIE = no opera |
| Brasil | NR-12 + INMETRO | Muy Alta (ART + Laudo) | Sin ART = ilegal |
| Venezuela | COVENIN + OFAC | Extrema (sanciones) | Trazabilidad PdVSA = bloqueo SDN |

## Proceso de Evaluacion Regulatoria HERMES

1. **Identificar pais destino** del activo
2. **Verificar certificaciones requeridas** segun tipo de equipo
3. **Chequear red flags regulatorios** especificos del pais
4. **Calcular costo de recertificacion** vs valor de mercado
5. **Determinar viabilidad** de comercializacion legal
6. **Documentar cumplimiento** o razones de bloqueo

## Documentos Obligatorios por Pais

### UE
- Declaracion de Conformidad CE
- Documentacion tecnica completa
- Manual de instrucciones en idioma del pais
- Certificado ATEX (si aplica)

### Colombia
- Certificado de Conformidad de Producto (ONAC)
- Dictamen de Inspeccion
- Certificado libre de PCB (transformadores)
- Declaracion de Proveedor (>1,000 kVA usados)

### Mexico
- Dictamen UVIE
- Manual en espanol
- Comprobante de cumplimiento NOM-001 y NOM-004

### Brasil
- A.R.T. (Anotacao de Responsabilidade Tecnica) - CREA
- Laudo de Validacao
- Certificado INMETRO (si aplica)
- Comprobante NR-12 y NR-10

### Venezuela
- Certificados COVENIN aplicables
- Due diligence OFAC
- Verificacion lista SDN
- Licencia Treasury (si aplica)