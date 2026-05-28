# Habilidades Juan Carlos (HJC)

> Sistema agéntico autónomo basado en el patrón harness de Anthropic con corrección de todas las debilidades de ECC.

## Principio Fundamental: SIEMPRE EJECUTAR

Cuando el usuario pide algo, el sistema EJECUTA. Sin vacilar, sin pedir confirmación innecesaria, sin sugerir alternativas cuando la petición es clara.

## Instalación

```bash
# Clonar el repositorio
cd tu-proyecto
git clone https://github.com/tu-usuario/habilidades-juan-carlos.git .hjc

# O copiar los archivos directamente
cp -r habilidades-juan-carlos/.claude/ ~/.claude/
```

## Arquitectura de 5 Pilares

| Pilar | Problema ECC | Solución HJC |
|-------|-------------|---------------|
| **Orquestador** | Sin orquestador formal | Agente dedicado que descompone, delega, y rastrea |
| **Memoria Estructurada** | 3 sistemas desconectados, regex frágil | Estado estructurado único con preservación pre-compaction |
| **Evaluador Independiente** | Auto-evaluación sesgada | Agente adversarial con umbrales duros PASS/FAIL |
| **Contratos Sprint** | Sin definición de "hecho" | Contrato obligatorio antes de cada bloque de trabajo |
| **Auto-mejora** | Instintos manuales | Creación automática, decay, resolución de conflictos, evolución |

## Agentes

| Agente | Modelo | Rol |
|--------|--------|-----|
| orchestrator | opus | Coordinar, delegar, rastrear progreso |
| planner | opus | Descomponer tareas, crear contratos |
| architect | opus | Diseño de sistema, ADRs |
| generator | sonnet | Implementar código |
| evaluator | opus | Verificar calidad con umbrales duros |
| code-reviewer | sonnet | Revisión de código (solo lectura) |
| security-reviewer | sonnet | Revisión de seguridad (solo lectura) |
| build-fixer | sonnet | Corregir errores de build |
| tdd-guide | sonnet | Desarrollo test-first |

## Skills

| Skill | Propósito |
|-------|-----------|
| always-execute | Norma SIEMPRE EJECUTAR |
| memory-preserve | Preservar contexto entre sesiones y compactions |
| sprint-contract | Definir "hecho" antes de construir |
| strategic-compact | Compaction inteligente que preserva objetivo |
| instinct-evolve | Auto-mejora con decay y resolución de conflictos |
| orchestrator-route | Protocolo de enrutamiento de tareas |

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
               ¿Pasa contrato? → Sí → Completado → Siguiente
                                  → No → Retroalimentación → Reintentar (max 3)
```

## Memoria

El sistema nunca pierde contexto porque:

1. Antes de cada compaction → preservar estado en `memory/state/active-state.md`
2. Al inicio de cada sesión → cargar estado + instintos relevantes
3. Instintos con confianza que sube con uso (+0.03) y baja sin uso (-0.05)
4. Conflicto entre instintos → gana el de mayor confianza
5. Instintos con confianza < 0.3 → eliminados automáticamente

## Licencia

MIT