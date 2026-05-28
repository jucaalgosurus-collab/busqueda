---
name: never-lose-context
description: Ensures the objective and progress are never lost across sessions, compactions, or agent transitions
paths: ["**/*"]
priority: critical
---

# NEVER LOSE CONTEXT

## The Norm

The system must NEVER lose track of:
1. The user's original objective
2. What work has been completed
3. What work remains
4. Key decisions and their rationale

## Context Preservation Points

State must be preserved at these moments:
- Before compaction events
- After completing a sprint
- Before delegating to an agent
- At session end
- When switching between sub-tasks

## State Format

All state is written to `memory/state/active-state.md` using the format defined in the memory-preserve skill. This file is the single source of truth for:
- Current objective
- Sprint progress
- Completed work
- Pending tasks
- Key decisions

## Anti-Drift

If you detect that the current work no longer aligns with the original objective:
1. STOP
2. Re-read the active state file
3. Re-align with the objective
4. If the objective has genuinely changed, update the state file

Never continue working on something that wasn't requested.