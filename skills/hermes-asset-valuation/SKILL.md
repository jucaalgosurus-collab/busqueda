---
name: hermes-asset-valuation
description: Valuacion y comercializacion de activos industriales de segunda vida. Usa cuando se mencione valoracion de activos, mercado secundario, economia circular, recuperacion de valor, VRC, disposicion de equipos, HERMES, MOCR, OCR de documentos industriales, subastas industriales.
dependencies: [orchestrator-route]
triggers:
  - valoracion de activos industriales
  - economia circular industrial
  - mercado secundario de equipos
  - recuperacion de valor VRC
  - disposicion de activos
  - subasta industrial
  - compraventa de maquinaria usada
  - MOCR OCR documentos industriales
  - HERMES agente
  - evaluacion financiera de activos
tags: [hermes, valuation, circular-economy, VRC, MOCR, industrial-assets, auction, secondary-market]
---

# HERMES - Asset Valuation & Circular Economy

Valoracion y comercializacion de activos industriales de segunda vida con modelo HERMES de inteligencia.

## Modelo HERMES de Evaluacion

### MOCR (Reconocimiento Optico Multimodal)
Hermes utiliza MOCR y herramientas como Docling para analizar:
- Esquemas de ingenieria y planos
- Mapas de instalaciones
- Graficos de rendimiento de activos
- Placas de datos (nameplates) fotograficas
- Informes de pruebas y certificaciones

**Proceso MOCR**:
1. Captura de imagen/documento del activo
2. Extraccion de bloques logicos estructurados (tablas, graficos, texto tecnico)
3. Conversion a datos evaluables (especificaciones, condiciones, metricas)
4. Estimacion de desgaste mecanico y valor residual con precision

### Evaluacion con Vision por Computadora (AI)
- Deteccion de corrosion en aerogeneradores desmantelados
- Identificacion de fugas de aceite en carcasas de transformadores
- Analisis de desgaste mecanico desde imagenes in situ
- Linea base obligatoria: edad, historial de fallos, criticidad

## Fabricantes por Sector

### Sector Electrico / Transformadores
- **WEG**: Transformadores de alta capacidad (500/34.5 kV, 72/96/120 MVA, 96/128/160 MVA)
- **Otros**: ABB, Siemens Energy, GE, Schneider Electric, Eaton

### Sector Eolico
- **Vestas**: 90 aerogeneradores comercializados en Colombia (ejemplo documentado)
- **Otros**: Siemens Gamesa, GE Renewable, Goldwind

### Sector Turbo-generacion (Gas/Vapor)
- **GE**: Series Frame 5, 6, 7, 9 (heavy-duty)
- **Siemens**: Series SGT-500 a SGT-800
- **Mitsubishi Power (MHPS)**: Modelos M501/M701
- **MAN**: Familia MGT6000 (metodo EOH simplificado)
- **Aeroderivativas**: GE LM2500/LM6000, Rolls-Royce Trent

### Material Electrico y BoP (Balance of Plant)
- Celdas, seccionadores, switches, armarios
- Unidades de control, cableado media/alta tension
- Cable de cobre desnudo, fibra optica
- Empalmes, terminales, transponedores, localizadores
- Tuberias electricas

### Equipos de Recuperacion de Valor
- Plantas de cogeneracion completas
- Intercambiadores de calor de placas (valor por aleaciones especializadas)
- Maquinaria pesada y unidades productivas

### Activos de TI y Corporativos
- Equipamiento tecnologico (proceso ITAD para destruccion de datos)
- Mobiliario, vehiculos, inventarios obsoletos (stocks)
- Instalaciones de bienes raices

## Centros de Recuperacion de Valor (VRC)

### Modelo VRC
Operaciones in situ en las plantas de los clientes para:
1. **Segregacion**: Identificar partes con mayor valor metalico vs viabilidad de uso
2. **Filtrado**: Clasificar por condicion y mercado destino
3. **Pesaje**: Cuantificar metales preciosos (cobre, acero electrico)
4. **Verificacion**: Confirmar especificaciones y certificaciones

### Ejemplo: Transformadores
- Bobinas de cobre: Alto valor en mercado de metales
- Aceros de transformadores: Acero electrico (grano orientado)
- Aceite dielectrico: Valor como lubricante reciclado o desecho controlado

## Jerarquia de Disposicion de Activos (Prioridad)

```
1. Redistribucion interna → Reusar dentro de la organizacion
2. Reacondicionamiento → Reparar y recertificar para venta
3. Venta a terceros → Mercado secundario (subastas, brokers)
4. Recuperacion de componentes → Segregar partes valiosas
5. Reciclaje → Ultimo recurso (metales, materiales)
```

## Metricas Financieras de Viabilidad

### Calculo de Viabilidad
- **Margen neto estimado** = Valor mercado secundario - (Desmontaje + Transporte + Recertificacion + Almacenamiento)
- **Costos de desmontaje**: Incluyendo EHS y mano especializada
- **Transporte**: Especial para equipos pesados (transformadores, turbinas)
- **Plazos de almacenamiento**: Maximo 90 dias tipico
- **Recertificacion**: Costo por pais destino (ver skill hermes-certifications)

### Impacto ESG
- **Huella de carbono evitada (tCO2e)**: Calculada por prolongar vida util del activo
- **Evitacion de extraccion**: Metales y materiales que no se extraen de nuevo
- **Metrica clave**: tCO2e evitadas / valor de recuperacion

## Modelo de Decision: Reventa vs Reciclaje

### Factores que favorecen REVENTA
- Condicion A o B verificable
- Documentacion completa (nameplate, historial, certificaciones)
- Mercado secundario activo para el tipo de activo
- Costos de transporte < 20% del valor de mercado
- Certificaciones transferibles al pais destino

### Factores que favorecen RECICLAJE
- Condicion D verificable
- Documentacion inexistente (data-poor)
- Sin mercado secundario viable
- Costos de recertificacion > valor de mercado
- Contiene componentes peligrosos sin gestion EHS

### Factores que favorecen DESMANTELAMIENTO IN SITU
- Transformadores de gran tamano (costo de transporte prohibitivo)
- Activos con PCB u otros contaminantes
- Valor de metales (cobre, acero) > costo de extraccion local

## Subastas y Mercado Secundario

### Tipos de Transaccion
- **Subastas industriales**: Para lotes de equipos completos
- **Brokers especializados**: Para equipos individuales de alto valor
- **Plataformas digitales**: Mercado online de activos industriales
- **Venta directa**: Negociacion entre partes con due diligence

### Due Diligence Pre-Subasta
1. Verificar propiedad legal y libre de gravamenes
2. Confirmar certificaciones vigentes
3. Evaluar condicion tecnica (usar escala A/B/C/D)
4. Calcular costos totales de transaccion (transporte, impuestos, recertificacion)
5. Verificar compliance regulatorio del pais destino

## Procesos ITAD (Activos de TI)

### Flujo ITAD
1. **Inventario**: Catalogar todos los activos de TI
2. **Sanitizacion**: Destruccion certificada de datos (R2v3, e-Stewards, NAID AAA)
3. **Evaluacion**: Determinar valor residual
4. **Disposicion**: Reventa, donacion, reciclaje
5. **Documentacion**: Cadena de custodia y certificados de destruccion

### Certificaciones ITAD Requeridas
- **R2v3**: Practicas responsables de reciclaje
- **e-Stewards**: Estándar de reciclaje electronico
- **NAID AAA**: Destruccion segura de datos

## Regulacion Transfronteriza

### Convenio de Basilea
- Controla movimiento transfronterizo de desechos y materiales secundarios
- Aplica a activos que puedan clasificarse como desechos

### RCRA (Estados Unidos)
- 40 CFR Seccion 261.4(a): Excluye ciertos materiales reciclables
- Regula residuos solidos no peligrosos

### Catalogo Europeo de Residuos (EWC/LoW)
- Clasifica residuos para disposicion en UE
- Define cuando un activo es "residuo" vs "producto"

### ENEC (Brasil)
- Estrategia Nacional de Economia Circular
- Marco regulatorio para economia circular en Latinoamerica