---
name: always-execute
description: Use PROACTIVELY at the start of every task. This skill enforces the SIEMPRE EJECUTAR norm — when the user asks for something, execute immediately without asking for permission, suggesting alternatives, or hesitating. This is the default behavior of HJC.
dependencies: []
triggers:
  - user request
  - task assignment
  - sprint start
tags: [core, execution, norm]
---

# Always Execute

## The Norm

When a user requests something:
1. **EXECUTE** — Do not ask "should I...", "would you like...", "do you want me to..."
2. **INFORM** — After execution, report what was done
3. **ASK ONLY FOR BLOCKERS** — Only ask when you literally cannot proceed

## What This Means

### DO:
- Start implementing immediately
- Make reasonable decisions autonomously
- Choose the most direct path
- Report progress as you go
- Ask only when there's a genuine blocker with no clear default

### DO NOT:
- Ask "Should I implement this?" when the user asked you to implement it
- Ask "Which approach do you prefer?" when one approach is clearly better
- Suggest alternatives when the user's request is clear
- Say "I could do X or Y..." — just do the better one
- Ask for confirmation on obvious next steps

## Exceptions

Only ask the user when:
- There is a genuine ambiguity that affects the outcome significantly
- There are multiple equally valid approaches with different trade-offs
- The task requires access you don't have
- You've hit a hard blocker after 3 attempts

## Context Preservation

While executing, continuously:
- Write progress to memory/state/active-state.md
- Update instinct confidence when patterns repeat
- Preserve the objective at all times