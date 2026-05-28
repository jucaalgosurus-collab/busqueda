---
name: session-memory
description: Use PROACTIVELY when the user references past work ("ayer hicimos...", "te acuerdas de...", "la vez pasada...", "lo que estábamos haciendo..."). Searches previous session files and restores context so the system knows what was done before.
dependencies: [memory-preserve]
triggers:
  - user mentions past work
  - user says "remember" or "te acuerdas"
  - user says "yesterday" or "ayer"
  - user says "last time" or "la vez pasada"
  - session start (to load recent context)
  - user references files or changes from previous sessions
tags: [core, memory, context, continuity]
---

# Session Memory

## The Problem This Solves

Every chat session starts from scratch. The user says "te acuerdas que ayer estábamos trabajando en X?" and the system has no idea. This skill solves that by maintaining session files that can be searched and loaded.

## How It Works

### Session Files

Every chat session creates a file in `memory/sessions/` with this naming format:

```
YYYY-MM-DD-HH-MM-topic-slug.md
```

Each file contains:
- **Objective**: What the session was about
- **Completed Work**: What was accomplished
- **Pending Work**: What was left unfinished
- **Decisions Made**: Key decisions and their rationale
- **Files Modified**: Which files were changed
- **Key Context**: Anything the next session needs to know

### Searching Past Sessions

When the user references past work:

1. **Extract keywords** from the user's message
2. **Search** `memory/sessions/` for files matching those keywords
3. **Read** the top 3-5 most relevant session files
4. **Restore context** by loading the objective, completed work, and decisions
5. **Continue** from where the previous session left off

### Example Interactions

**User**: "Te acuerdas que ayer estábamos trabajando en el sistema de auth?"
**System**: [Searches sessions for "auth"]
→ Finds `2026-05-27-14-30-sistema-auth.md`
→ Loads: objective, completed work, pending work
→ Continues from where it left off

**User**: "La vez pasada hiciste un refactor del módulo de pagos"
**System**: [Searches sessions for "refactor pagos"]
→ Finds `2026-05-25-10-15-refactor-modulo-pagos.md`
→ Loads context and asks: "Continuamos con el refactor del módulo de pagos? Quedó pendiente X."

## Protocol

### At Session Start

1. Load `memory/state/active-state.md` for current state
2. Load the 3 most recent session files for context
3. If the user's first message references past work, search for the relevant session
4. Present a brief summary: "Sesión anterior: [objective]. Quedó pendiente: [pending]."

### During Session

- After each sprint completion, update `memory/state/active-state.md`
- Periodically save session state (every 5+ turns or after significant changes)
- Record all files modified in the session

### At Session End

1. Save complete session state to `memory/sessions/YYYY-MM-DD-HH-MM-topic.md`
2. Update `memory/state/active-state.md` with final state
3. Update instinct confidence scores
4. Prune sessions older than 90 days

### When User References Past Work

1. Extract keywords from the user's message
2. Run: `node scripts/memory/session-memory.js search "[keywords]"`
3. Read the top results
4. Restore context from the most relevant session
5. Ask the user if they want to continue from where they left off

## Anti-Degradation

This skill is part of the ALWAYS-ACTIVE system. It must never be skipped:

- Session files MUST be created at session end
- Active state MUST be updated after every sprint
- Past sessions MUST be searched when the user references prior work
- The system MUST NOT say "I don't have access to previous conversations" — it MUST search the session files instead