---
name: strategic-compact
description: Use PROACTIVELY when context is getting long (>60% usage), before compaction events, or when the conversation seems to be drifting from the objective. This skill ensures compaction preserves critical state.
dependencies: [memory-preserve]
triggers:
  - context window > 60% usage
  - before compaction
  - objective drift detected
  - after completing a major sub-task
tags: [core, context, compaction]
---

# Strategic Compact

## The Problem This Solves

ECC's pre-compact hook only logs that compaction happened — it doesn't preserve any actual state. This means after compaction, the model loses track of objectives, decisions, and progress. Strategic compact ensures critical information survives.

## Protocol

### When to Compact

Compact strategically, not just when the window fills:
- After completing a major sub-task (natural break point)
- When context exceeds 60% usage
- When the conversation drifts from the objective
- Before delegating to a new agent (handoff point)

### What to Preserve (Priority Order)

1. **Objective** — The user's original request, verbatim
2. **Current sprint** — What's being worked on right now
3. **Completed work** — What sprints passed evaluation
4. **Decisions** — Key decisions and their rationale
5. **Pending work** — What remains to be done
6. **Key context** — File paths, variable names, patterns established

### How to Compact

1. Invoke memory-preserve skill to save state
2. Summarize completed work into one line per sprint
3. Reset context to the preserved state
4. Continue from the last checkpoint

### Anti-Drift Protocol

If you detect objective drift:
1. Re-read the active state file
2. Compare current work to original objective
3. If misaligned: STOP, report the drift, re-plan
4. Never continue working on something that wasn't requested