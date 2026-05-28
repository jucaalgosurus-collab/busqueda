# Habilidades Juan Carlos (HJC)

## Norma Fundamental: SIEMPRE EJECUTAR

Cuando el usuario pide algo, el sistema EJECUTA. Sin vacilar, sin pedir confirmación innecesaria, sin decir "podrías considerar...". Actúa primero, informa después. La ejecución es la respuesta.

## Identidad del Sistema

HJC es un sistema agéntico autónomo que combina:
- **Orquestador** que planifica uso de recursos y delega a agentes
- **Memoria semántica** que preserva contexto entre sesiones y compactions
- **Evaluador independiente** que verifica calidad con umbrales duros
- **Contratos sprint** que definen "hecho" antes de construir
- **Auto-mejora** que evoluciona instintos automáticamente

## Arquitectura de 5 Pilares

### 1. Orquestador (Orchestrator)
Toda tarea no-trivial pasa por el orquestador. Este:
- Descompone la tarea en sub-tareas con dependencias
- Selecciona el agente y modelo óptimo para cada sub-tarea
- Establece contratos sprint (qué significa "hecho")
- Monitorea progreso y re-ruta si hay bloqueos
- Nunca pierde el objetivo original

### 2. Memoria Estructurada (Structured Memory)
El sistema NUNCA pierde contexto porque:
- Antes de cada compaction, se preserva estado en `memory/state/active-state.md`
- Al inicio de cada sesión, se carga el último estado + instintos relevantes
- Los instintos tienen score de confianza que decae si no se usan
- Los conflictos entre instintos se resuelven por confianza + relevancia

### 3. Evaluador Independiente (Independent Evaluator)
Siguiendo el patrón GAN de Anthropic:
- El evaluador es un agente SEPARADO del generador
- Usa umbrales duros: si CUALQUIER criterio falla, el sprint falla
- Combate la tendencia del LLM a auto-elogiarse
- Los criterios son específicos, medibles, y no-negociables

### 4. Contratos Sprint (Sprint Contracts)
Antes de cada bloque de trabajo:
- El generador propone qué construirá y cómo se verifica el éxito
- El evaluador revisa la propuesta para asegurar que construye lo correcto
- El contrato es granular: cada criterio es atómico y verificable
- No se avanza sin contrato aprobado

### 5. Auto-Mejora (Auto-Improvement)
Los instintos evolucionan sin intervención manual:
- Cada sesión genera observaciones automáticamente
- Cuando un patrón se repite 3+ veces, se crea un instinto
- La confianza del instinto sube con uso, baja con desuso
- Instintos conflictivos se resuelven: gana el de mayor confianza
- Instintos por debajo de 0.3 se eliminan automáticamente

## Flujo de Trabajo

```
Usuario → Orquestador → Plan (sub-tareas + contratos)
                              ↓
                    Delegar a agentes
                              ↓
                    Generador ejecuta
                              ↓
                    Evaluador verifica
                              ↓
               ¿Pasa contrato? → Sí → Marcar completado → Siguiente sub-tarea
                                  → No → Retroalimentación → Reintentar (max 3)
                              ↓
                    Orquestador consolida
                              ↓
                    Preservar estado en memoria
                              ↓
                    Informar al usuario
```

## Gestión de Contexto

### Budget de Contexto
- El orquestador estima tokens antes de delegar
- Skills se cargan lazy (solo las relevantes)
- Reglas se cargan solo para el lenguaje activo
- Instintos: máximo 8 relevantes por sesión, ordenados por confianza

### Compaction Estratégica
- Antes de compaction: hook preserva estado activo
- Estado activo incluye: objetivo actual, sub-tareas pendientes, decisiones tomadas
- Después de compaction: se re-inyecta el estado preservado
- Nunca se compacta el objetivo principal

## Agentes Disponibles

| Agente | Modelo | Herramientas | Rol |
|--------|--------|-------------|-----|
| orchestrator | opus | Read, Grep, Glob, Agent | Planificar, delegar, coordinar |
| planner | opus | Read, Grep, Glob | Especificar, descomponer |
| architect | opus | Read, Grep, Glob | Diseño de sistema, ADRs |
| generator | sonnet | Read, Write, Edit, Bash, Grep, Glob | Implementar código |
| evaluator | opus | Read, Grep, Glob, Bash | Verificar calidad con umbrales duros |
| code-reviewer | sonnet | Read, Grep, Glob | Revisión de calidad (solo lectura) |
| security-reviewer | sonnet | Read, Grep, Glob | Revisión de seguridad (solo lectura) |
| build-fixer | sonnet | Read, Write, Edit, Bash | Corregir errores de build |
| tdd-guide | sonnet | Read, Write, Edit, Bash | Desarrollo test-first |

## Instalación

```bash
# Copiar a tu proyecto
cp -r habilidades-juan-carlos/.claude/ ~/.claude/

# O instalar como proyecto
cd tu-proyecto
ln -s /path/to/habilidades-juan-carlos/.claude .claude
```

## Principios Derivados del Análisis ECC

### Lo que reutilizamos de ECC:
- Formato de agentes con YAML frontmatter (name, description, tools, model)
- Concepto de skills como markdown con triggers
- Hooks como capa de enforcement
- GAN harness (planner-generator-evaluator)
- Instintos con confianza (mejorados con decay y resolución de conflictos)
- Reglas con paths para activación selectiva

### Lo que reescribimos completamente:
- Memoria: de archivos planos → SQLite + índice semántico
- Orquestación: de delegación implícita → orquestador formal con DAG
- Evaluación: de auto-evaluación → evaluador independiente con umbrales duros
- Compaction: de no-op → preservación estructurada de estado
- Instintos: de manual → auto-evolución con decay
- Skills: de carga total → lazy loading con índice compacto
- Contratos: de inexistentes → obligatorios antes de cada sprint
- Context: de sin presupuesto → budget estimado por sub-tarea