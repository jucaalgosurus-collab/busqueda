---
name: hermes-technical-audit
description: Evaluacion tecnica de activos industriales con escala de condicion A/B/C/D, red flags, nameplates y especificaciones por tipo de activo. Usa cuando se mencione auditoria tecnica, evaluacion de activos, inspeccion industrial, condicion de equipos, red flags, nameplate, placa de datos.
dependencies: [orchestrator-route]
triggers:
  - evaluacion tecnica de activos industriales
  - auditoria tecnica industrial
  - inspeccion de equipos de segunda mano
  - condicion de equipos A B C D
  - red flags tecnicos
  - lectura de placas de datos nameplate
  - especificaciones de transformadores turbinas generadores CNC
  - analisis de vibracion ISO 10816
  - diagnostico DGA transformadores
tags: [hermes, industrial, audit, assets, condition, nameplate, red-flags, transformers, turbines, generators]
---

# HERMES - Technical Audit Skill

Evaluacion tecnica exhaustiva de activos industriales de segunda vida.

## Escala de Condicion A/B/C/D

### Condicion A (Excelente)
- Estado fisico equivalente a nuevo, sin fugas, desgaste cosmético o fatiga visible
- Componentes y control funcionan segun especificaciones de diseño
- Parametros Dielectricos: PI >= 4.0, tan(delta) < 0.5%, desviacion TTR < 0.3%
- Vibracion (ISO 10816): Zona A (<=1.8 mm/s Clase II, <=2.8 mm/s Clase III)
- Requiere: solo mantenimiento preventivo

### Condicion B (Bueno)
- Desgaste normal y tolerable derivado del uso continuo
- Operacion estable y confiable, requiere mantenimiento preventivo rutinario
- Parametros Dielectricos: 2.5 <= PI < 4.0, tan(delta) 0.5%-2.0%, TTR < 0.5%
- Vibracion (ISO 10816): Zona B (1.8-7.1 mm/s Clase II, 2.8-11.0 mm/s Clase III)

### Condicion C (Aceptable)
- Envejecimiento fisico evidente y desgaste severo en puntos de friccion
- Opera con confiabilidad degradada, riesgo aumenta, requiere mantenimiento correctivo a corto plazo
- Parametros Dielectricos: 1.0 <= PI < 2.5, tan(delta) > 2.0%, desequilibrio devanados > 2%
- Vibracion (ISO 10816): Zona C (7.1-11.2 mm/s Clase II, 11.0-17.7 mm/s Clase III)

### Condicion D (Para Desguace o Refabricacion)
- Inoperabilidad, dano estructural grave o alto riesgo fisico inminente de falla catastrofica
- Requiere retiro inmediato del servicio para reconstruccion total o chatarra
- Parametros Dielectricos: PI < 1.0, TTR > 0.5%, niveles criticos de gases DGA como acetileno
- Vibracion (ISO 10816): Zona D (>11.2 mm/s Clase II, >17.7 mm/s Clase III)

## Red Flags Criticos

### Electricos (Transformadores)
1. **PI < 1.0 o tan(delta) > 2.0%**: Deterioro termico severo y saturacion de humedad en celulosa dielectrica
2. **TTR > ±0.5%**: Cortocircuitos latentes entre espiras, arcos electricos, desalineacion en OLTC
3. **Desequilibrio de Resistencia > 1-2%**: Soldaduras debilitadas o hilos de devanados rotos
4. **Desequilibrio de Corriente de Excitacion > 10%**: Deformacion del nucleo magnetico o fallas en laminas
5. **Acetileno (C2H2) en DGA**: Arcos electricos activos de alta energia en fluido dielectrico interno

### Mecanicos (Turbinas de Gas)
1. **Desplazamiento a Zona C/D de vibracion (ISO 10816)**: Desequilibrio del rotor o fallos de alineacion que propagan microfisuras y destruyen rodamientos
2. **Dispersión de temperatura de escape (Exhaust Spread) > 30°C**: Obstruccion de inyectores o fisuras catastroficas por creep en piezas de transicion
3. **Trips desde plena carga frecuentes**: Agotan EOH por estres termomecanico perjudicial en alabes y rotores
4. **Arranques en frio (Cold Starts 2.0-5.0x FFH multiplier)**: Estres termico extremo en alabes y camaras de combustion

### Analisis Espectral FFT
- **Desequilibrio mecanico**: Amplitud dominante en 1x RPM (frecuencia sincrona)
- **Desalineacion**: Amplitud elevada en 2x RPM con componentes axiales dominantes
- **Holgura mecanica**: Multiples armonicos sincronos (1x, 2x, 3x, 4x, 5x RPM)
- **Desgaste de engranajes**: Amplitud en GMF con bandas laterales
- **Fatiga de ejes**: Rapido incremento de vibracion + historial de maquinado deficiente en chaveteros

## Especificaciones por Tipo de Activo

### Transformadores de Potencia
- **Normas**: IEC 60076 (diseño general), IEEE C57 (diagnostico en campo)
- **Parametros clave**: Potencia nominal (MVA transmision, kVA distribucion), tensiones nominales (kV)
- **Refrigeracion**: ONAN (natural), ONAF (aire forzado), ODAF (flujo dirigido), OFAF/OFWF (alta densidad)
- **Fluido dielectrico**: Mineral, silicona, esteres
- **Grupo de conexion**: Vectorial (Dyn1, YNd11, etc.)
- **Regulacion**: Fija NLTC o bajo carga OLTC
- **Red flags adicionales**: Contenido de PCB, fugas de aceite, oxidacion del tanque

### Turbo-grupos de Generacion (Turbinas de Gas)
- **Normas**: API 616 (diseno), API 618 (reciprocantes)
- **Fabricantes principales**: GE (Frame 5/6/7/9), Siemens (SGT-500 a SGT-800), Mitsubishi Power (MHPS)
- **Parametros clave**: Potencia electrica neta (MW), potencia termica (MWth), TIT (temperatura entrada gases), relacion de compresion
- **EOH (Equivalent Operating Hours)**: AOH + (Hot_Starts x 5) + (Cold_Starts x 25) + (Trips x 50-500)
- **Inspecciones**: Combustion (8,000-12,000 FFH), Hot Gas Path (24,000 FFH), Major (48,000-80,000 EOH)
- **Sistemas de control**: GE Mark VIe, Siemens Teleperm XP

### Aerogeneradores (Vestas)
- **Componentes clave**: Gondola (nacelle), buje (hub), tren de potencia (powertrain), secciones de torre, palas de fibra de vidrio
- **Evaluacion**: Dano por corrosion, fatiga en palas, desgaste en rodamientos

### CNC y Maquinaria de Precision
- **Parametros**: Tolerancias de posicionamiento, repetibilidad, horas de uso, desgaste de guias
- **Fabricantes**: Haas, DMG Mori, Mazak, Fanuc, Okuma

### Maquinaria Pesada
- **Parametros**: Horas de operacion, desgaste de componentes criticos, historial de mantenimiento
- **Fabricantes**: Caterpillar, Komatsu, Hitachi, Volvo CE

### Inmuebles Industriales
- **Parametros**: Estructura, sistemas MEP (mecanicos, electricos, plomeria), normativa local, capacidad instalada

## Lectura de Placas de Datos (Nameplates)

### Datos Obligatorios a Registrar
1. **Fabricante y modelo** - Identifica el OEM y la serie
2. **Numero de serie** - Trazabilidad y historial
3. **Ano de fabricacion** - Edad del activo
4. **Potencia nominal** - MVA/kVA/kW/MW segun tipo
5. **Tensiones nominales** - kV primario/secundario
6. **Frecuencia** - 50Hz o 60Hz
7. **Grupo de conexion** - Para transformadores
8. **Tipo de refrigeracion** - ONAN/ONAF/ODAF
9. **Peso total y de aceite** - Para logistica y transporte
10. **Normas de fabricacion** - IEC, IEEE, API aplicables

### Interpretacion de Nameplates
- **Faltan datos**: Activo "data-poor" = valor reducido drasticamente
- **Placa ilegible o alterada**: Red flag critico, posible fraude
- **Datos inconsistentes con inspeccion**: Verificar modificaciones no documentadas
- **Marcas de certificacion ausentes**: Puede requerir recertificacion costosa

## Monitoreo Operativo (API 616 para Turbinas)

### Lecturas Diarias
- Temperatura aire admision compresor vs baseline corregida
- Presion y temperatura descarga compresor (sin degradacion por fouling)
- Dispersion temperatura escape (ningun TC > 30°C del promedio)
- Fluctuacion presion dinamica combustion (dentro de limite OEM)
- Potencia y heat rate vs baseline corregida (degradacion si < 98%)
- Presion aceite lubricacion, nivel reservoir, temperatura (dentro de envelope)

### Verificaciones Semanales
- Presion diferencial filtros aire admision vs baseline limpia
- Tendencia consumo aceite lubricante
- Verificacion alarmas DCS/Mark sin alarmas suprimidas activas

## Jerarquia de Disposicion de Activos

1. **Redistribucion interna** - Reusar dentro de la organizacion
2. **Reacondicionamiento** - Reparar y recertificar
3. **Venta a terceros** - Mercado secundario
4. **Recuperacion de componentes/metales** - Segregacion y valorizacion
5. **Reciclaje** - Ultimo recurso

## Metricas de Viabilidad y ESG

- Margen neto estimado de venta
- Costos de desmontaje y transporte
- Cumplimiento de plazos de almacenamiento (ej. 90 dias)
- Huella de carbono evitada (tCO2e) por prolongar vida util del activo