# Sprint Contract 11 — SURUS A&B Dossier: Iconos duotono + Datos verificados + Testimonios reales

## Metadata
- Sprint ID: S11
- Fecha inicio: 2026-06-04
- Agente principal: Generator (Sonnet 4.6)
- Agente evaluador: Evaluator (Opus 4.5)
- Modo: Producción caliente (deck en Vercel)
- Restricción crítica: NO romper lo que funciona

## Objetivo
Reescritura quirúrgica del deck para alinear la realidad del dossier con www.surusin.com: reemplazar 10 iconos genéricos por set duotono sólido unificado, corregir datos verificados, reescribir testimonios con 10 nombres reales, añadir cifras macro Surus, insertar slide de certificaciones.

## F1 — Iconos metodología duotono sólidos (10 SVGs)
Sistema visual común estricto:
- viewBox 0 0 64 64, render 38x38
- fill con linearGradient teal #106070 → bronze #B08A52, id único por icono (s11-grad-ico-01 a s11-grad-ico-10)
- Sombra interior: filter feGaussianBlur stdDeviation=0.5 + offset (0, 0.5)
- Stroke opcional teal oscuro #0A4048 stroke-width=0.5
- Sin emojis ni texto dentro del icono
- aria-hidden="true" focusable="false"
- Cero stroke-width=1.5 (sistema duotono)

Los 10 iconos:
1. 01 Tasación: balanza industrial asimétrica con aguja
2. 02 Inventario: 3 bloques apilados isométricos
3. 03 Marketing: diana con flecha (targeting, no megáfono)
4. 04 Subasta: martillo de subastador
5. 05 Adjudicación: documento con check
6. 06 Retirada: camión de carga con ruedas
+1 Trazabilidad ESG: cadena de 3 eslabones conectados
+2 Reporting notarial: documento con sello circular
+3 Reempleo personal: dos siluetas humanas
+4 Liquidación final: gráfica de barras descendente

## F2 — Datos verificados (línea exacta + cambio)
- 1226: "Plataforma propia con 200.000+ usuarios activos." → "Plataforma propia con +415.000 usuarios registrados y +240.000 subastas celebradas."
- 1228: "→ 200K+ compradores<br>→ Adjudicación media 21 días" → "→ 415K+ usuarios registrados<br>→ 240K+ subastas celebradas"
- 1127: `<div class="bento-n">1.550 m²</div>` → `<div class="bento-n">1,55 M€</div>`
- 1665: "Casalobos<em>Abencys</em>" → "Bodega<em>Casalobos</em>"

## F3 — Cifras de casos
- Fricarne (línea 1107): añadir "+150.000 € en venta en subasta"
- Cuniporc (línea 1121): añadir "+62.500 € en venta en subasta"
- PepsiCo (línea 1135): añadir "3.600 € Garvens XS40" en lugar de "→ Online"

## F4 — Cifras macro Surus
Banda horizontal compacta en slide 2 (Metodología) debajo del título, antes del grid de iconos. 8 cifras: +400 M€ generados, 30,7 M kg CO₂ evitados, 98% tasa de reempleo, +27 países, +15 IBEX 35, +1.000 clientes, 18.000 T capacidad, EcoVadis 78/100 Silver. CSS prefijo s11- (.s11-macro-band, .s11-macro).

## F5 — Slide certificaciones
Nueva slide entre casos (15) y testimonios (16). Título "Acreditaciones y certificaciones". Grid 4x2 con 8 acreditaciones: ISO 14001, ISO 9001, ISO 27001, ISO 19601, ISO 37001, ISO 45001 (sustituye OHSAS 18001), ENS Media, EcoVadis Silver 78/100. Badges minimalistas con nombre + glifo, sin logos externos.

## F6 — Slide 15 testimonios
Reemplazar 8 textos inventados por 10 nombres reales: Ana Villuendas (WorldPathol), Lorenzo López (SENASA), César Asensio (SIGNUS), Luis Sanz (Red Eléctrica), Belén Muñoz (Repsol), Juan Martino (Roca Junyent), Enric Porta (Deloitte Legal), José Antonio Cadahia (AECOM), Paula Pérez (EnergyLoop), Ivan José Galindo (Abencys). Título "Siete" → "Diez". REGLA DURA: cero invención, solo citas encontradas literalmente en surusin.com. Si no hay cita, dejar bloque con nombre+cargo sin texto entre comillas.

## 30 criterios PASS/FAIL (todos deben ser PASS)
- C-01 a C-08: iconos (8 criterios)
- C-09 a C-13: datos verificados (5)
- C-14 a C-16: cifras casos (3)
- C-17 a C-18: cifras macro (2)
- C-19 a C-21: certificaciones (3)
- C-22 a C-25: testimonios (4)
- C-26 a C-30: producción/no-regresión (5)
