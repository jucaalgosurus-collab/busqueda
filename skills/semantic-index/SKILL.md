---
name: semantic-index
description: Use when the system needs to find relevant skills, instincts, or past sessions based on the current task. Provides lazy loading of context based on relevance rather than loading everything.
dependencies: [memory-preserve]
triggers:
  - session start
  - task change
  - context budget concern
tags: [core, context, lazy-loading]
---

# Semantic Index

## The Problem This Solves

ECC loads all 246 skills into context, consuming 30-50% of the context window before work even begins. This skill provides lazy loading: a compact index that is always in context, and full skill content loaded only when triggered.

## How It Works

### Index Format (Always Loaded)

The index is a compact table mapping triggers to skill paths:

```
| Trigger Pattern | Skill | Est. Tokens | Priority |
|-----------------|-------|-------------|----------|
| implement, code, build | generator | 800 | high |
| review, quality, check | code-reviewer | 1200 | high |
| security, vulnerability | security-reviewer | 1500 | high |
| plan, decompose, break down | planner | 600 | high |
| evaluate, verify, pass/fail | evaluator | 1000 | high |
| fix, build error, compile | build-fixer | 500 | medium |
| test, TDD, red-green | tdd-guide | 700 | medium |
| architecture, design, ADR | architect | 600 | medium |
| context, memory, preserve | memory-preserve | 900 | high |
| contract, sprint, done | sprint-contract | 600 | high |
| compact, compress, drift | strategic-compact | 500 | high |
| instinct, learn, pattern | instinct-evolve | 800 | medium |
| route, orchestrate, delegate | orchestrator-route | 700 | high |
| execute, do, now | always-execute | 400 | critical |
```

### Loading Protocol

1. At session start, load ONLY the index table (above)
2. When a task arrives, match trigger patterns to skills
3. Load ONLY the matching skill's full content
4. Never load more than 4 skills per session (excluding always-execute and memory-preserve which are always active)

### Context Budget Rule

- Always-execute and memory-preserve are ALWAYS active (non-negotiable)
- Orchestrator-route is active for moderate/complex tasks
- All other skills: lazy load on trigger match
- Maximum 4 additional skills per session
- If context exceeds 60%: trigger strategic-compact before loading more

## Instinct Injection

Instincts follow the same lazy-loading pattern:
1. At session start, load the instinct index (name + confidence)
2. Filter: confidence >= 0.5, max 8
3. Sort by relevance to current task, then confidence
4. Inject top 8 instinct summaries (not full content)
5. Load full instinct content only when triggered