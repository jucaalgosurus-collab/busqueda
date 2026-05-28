---
name: instinct-evolve
description: Use AUTOMATICALLY at session end and when patterns are observed. This skill manages the instinct learning system with confidence scoring, decay, conflict resolution, and automatic evolution — fixing ECC's manual-only instinct system.
dependencies: [memory-preserve]
triggers:
  - session end
  - pattern observed 3+ times
  - instinct conflict detected
  - confidence decay sweep
tags: [core, learning, instincts]
---

# Instinct Evolve

## The Problem This Solves

ECC's instinct system requires manual `/learn` and `/evolve` invocation. If you forget, instincts never improve. This skill makes instinct evolution automatic: patterns are detected, instincts are created, confidence is adjusted, conflicts are resolved, and low-value instincts are pruned — all without manual intervention.

## How Instincts Work

Instincts are learned patterns stored in `memory/instincts/` as markdown files. Each instinct has:

- **Trigger**: When to apply this pattern
- **Action**: What to do
- **Confidence**: How reliable this pattern has been (0.3 - 0.95)
- **Scope**: project-specific or global
- **Use count**: How many times it's been applied

## Protocol

### Pattern Detection (Automatic)

At session end, review the session for patterns:
- Did the same fix appear 3+ times? → Create instinct
- Did the same mistake appear 3+ times? → Create instinct
- Did a particular approach succeed consistently? → Create instinct

### Instinct Creation

When a pattern is detected:
1. Create `memory/instincts/[pattern-name].md`
2. Set initial confidence to 0.7
3. Set scope based on whether the pattern is project-specific or general
4. Write clear trigger and action

### Confidence Adjustment (Every Session)

For each instinct in `memory/instincts/`:
- If instinct was USED this session: confidence += 0.03 (max 0.95)
- If instinct was NOT used this session: confidence -= 0.05
- If confidence < 0.3: DELETE the instinct (auto-prune)
- Update `last_used` date and `use_count`

### Conflict Resolution (Every Session)

When two instincts have overlapping triggers but contradictory actions:
1. Compare confidence: higher wins
2. If tied: prefer project-scoped (more specific)
3. If still tied: prefer the newer instinct (more recent data)
4. Log the resolution in the winning instinct's file

### Instinct Evolution (Automatic)

When 3+ instincts share a common theme:
1. Create a parent instinct that subsumes them
2. Set confidence to the average of the children
3. Mark children as superseded
4. Delete superseded instincts after 2 sessions

## Instinct Injection (Session Start)

At session start:
1. Scan `memory/instincts/`
2. Filter: confidence >= 0.5
3. Sort by: relevance to current task, then confidence
4. Inject top 8 (max) into context
5. Skip instincts that don't match the current project scope