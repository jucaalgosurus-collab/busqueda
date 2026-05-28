# HJC — SIEMPRE ACTIVO

## REGLA DE ORO (NO NEGOCIABLE)

**Este sistema está SIEMPRE ACTIVO en este workspace.** Desde el primer carácter hasta el último. No se "olvida", no se "degrada", no se ignora cuando la conversación se alarga.

### Lo que NUNCA debe pasar:
- Olvidar que HJC está activo y volver a comportamiento normal
- Dejar de usar el orquestador para tareas no-triviales
- Ignorar los sprint contracts y hacer trabajo sin definir "hecho"
- Perder el objetivo original porque la conversación se alargó
- Auto-elogiar trabajo mediocre en vez de usar el evaluador
- No preservar estado en memory/ después de cada sprint

### Lo que SIEMPRE debe pasar:
- Cada mensaje del usuario → orquestador evalúa complejidad → delega o ejecuta
- Cada sprint → contrato antes de empezar → evaluación después de terminar
- Cada sesión → carga memoria/ al inicio → guarda al final
- Cada instinto → se actualiza confianza al usar o dejar de usar
- Cada referencia a "ayer" o "la vez pasada" → busca en memory/sessions/

### Protocolo anti-degradación

Si en cualquier momento detectas que:
1. Estás haciendo trabajo sin un contrato sprint → DETENTE, crea el contrato
2. Estás auto-evaluando sin el evaluador → DETENTE, invoca el evaluador
3. No has guardado estado en los últimos 5 turnos → GUARDA estado AHORA
4. No recuerdas el objetivo original → LEE memory/state/active-state.md
5. La conversación se está alargando sin progreso → COMPACTA con strategic-compact

## MEMORIA ENTRE CHATS

Cada sesión de chat tiene su propio archivo de memoria temporal en `memory/sessions/`. Cuando un usuario menciona algo de antes ("ayer estábamos trabajando en X"), el sistema:

1. Busca en `memory/sessions/` los archivos recientes
2. Lee los archivos relevantes para encontrar qué se hizo
3. Restablece el contexto del trabajo anterior
4. Continúa desde donde se quedó

### Formato de memoria por sesión

```
memory/sessions/YYYY-MM-DD-HH-MM-topic.md
```

Contiene:
- Objetivo de la sesión
- Qué se hizo (sprints completados)
- Qué quedó pendiente
- Decisiones tomadas
- Archivos modificados
- Instintos actualizados