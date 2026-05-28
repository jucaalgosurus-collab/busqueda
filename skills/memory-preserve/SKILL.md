---
name: memory-preserve
description: Use PROACTIVELY before any compaction, at session end, and at major task transitions. This skill ensures the system NEVER loses context by preserving structured state that can be fully restored.
dependencies: []
triggers:
  - before compaction
  - session end
  - sprint completion
  - task transition
  - before delegation
tags: [core, memory, context]
---

# Memory Preserve

## The Problem This Solves

ECC's session persistence uses regex-parsed markdown files that break on format drift, with no quality scoring, no compaction state preservation, and disconnected storage (3 separate systems). This skill replaces all of that with a single structured state format that survives compaction, session boundaries, and agent transitions.

## Protocol

### Before Compaction
When a compaction event is about to occur:

1. Write the following to `memory/state/active-state.md`:
```markdown
# Active State

## Objective
[One sentence: the user's original request]

## Current Sprint
- Sprint #: N of M
- Contract: [What this sprint delivers]
- Agent: [Current agent]
- Status: in-progress | completed | failed

## Completed Work
- [Sprint 1: what was delivered - VERIFIED]
- [Sprint 2: what was delivered - VERIFIED]

## Decisions Made
- [Decision]: [Rationale]

## Pending Work
- [Next sprint or sub-task]

## Key Context
- [Anything a new agent needs to know to continue seamlessly]
- [Open files, variables, patterns to follow]
- [What was tried and failed]
```

2. Update instincts if a pattern was observed during this sprint
3. Verify the state file is parseable (read it back)

### After Compaction
1. Read `memory/state/active-state.md`
2. Resume from the exact point of the last sprint
3. Verify the objective matches the user's original request
4. Continue execution without asking the user to re-explain

### Session Start
1. Check for `memory/state/active-state.md`
2. If exists: resume from the saved state
3. If not: check `memory/instincts/` for relevant learned patterns
4. Load relevant instincts (confidence >= 0.5, max 8, sorted by relevance)

### Session End
1. Write final state to `memory/state/active-state.md`
2. Update instinct scores
3. Archive the session to `memory/sessions/YYYY-MM-DD-session.md`

## Instinct Management

### Learning
When a pattern is observed 3+ times across sessions:
1. Create instinct file: `memory/instincts/[pattern-name].md`
2. Format:
```markdown
---
name: [pattern-name]
confidence: 0.7
scope: [project | global]
trigger: [when this pattern applies]
created: [date]
last_used: [date]
use_count: 1
---

[Pattern description]
[When to apply]
[What to do]
```

### Confidence Decay
- Each session where instinct is NOT used: confidence -= 0.05
- Each session where instinct IS used: confidence += 0.03
- Below confidence 0.3: auto-delete the instinct
- Confidence caps at 0.95

### Conflict Resolution
When two instincts have overlapping triggers:
1. Compare confidence scores: higher wins
2. If tied: prefer project-scoped over global
3. If still tied: prefer more specific (narrower trigger)

## Quality Gates

- State files must be re-readable (read back after writing)
- Instincts must have all required fields
- Session archives must include objective, completed work, and key decisions