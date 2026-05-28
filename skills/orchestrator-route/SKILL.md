---
name: orchestrator-route
description: Use PROACTIVELY for every non-trivial task. This skill activates the orchestrator's routing protocol — decomposing tasks, selecting agents, establishing sprint contracts, and tracking progress.
dependencies: [always-execute, sprint-contract, memory-preserve]
triggers:
  - user requests a feature
  - user reports a bug
  - user asks for refactoring
  - user requests analysis
  - any multi-step task
tags: [core, orchestration, routing]
---

# Orchestrator Route

## The Problem This Solves

ECC has no formal orchestrator. Agent routing is based on the host LLM reading AGENTS.md descriptions and guessing which agent to use. This leads to misrouting, skipped evaluation, and lost objectives. This skill formalizes the routing protocol.

## Routing Decision Tree

```
Incoming task
  │
  ├─ Is it trivial? (1 action, < 50 lines)
  │   └─ YES → Execute directly, skip orchestration
  │
  ├─ Is it simple? (1-3 actions, < 200 lines)
  │   └─ YES → Delegate to one agent with a contract
  │   │
  │   │   Task type:
  │   │   ├─ Feature → generator
  │   │   ├─ Bug → build-fixer
  │   │   ├─ Review → code-reviewer
  │   │   ├─ Security → security-reviewer
  │   │   ├─ Test → tdd-guide
  │   │   └─ Design → architect
  │   │
  │   └─ After delegation → evaluator verifies
  │
  └─ Is it moderate/complex? (3+ sub-tasks)
      └─ YES → Full orchestration protocol
```

## Full Orchestration Protocol

### Phase 1: Plan
1. Invoke planner agent to decompose the task
2. Create sprint contracts for each sub-task
3. Identify dependencies and critical path
4. Estimate context budget per sub-task

### Phase 2: Execute
1. For each sub-task in dependency order:
   a. Activate the sprint contract
   b. Delegate to the assigned agent
   c. After completion, invoke evaluator
   d. If passes: mark complete, preserve state, move to next
   e. If fails: provide feedback, retry (max 3)
   f. If fails 3 times: escalate to planner for re-decomposition

### Phase 3: Deliver
1. Consolidate all sprint results
2. Verify against original objective
3. Present deliverable to user
4. Final state preservation

## Agent Selection Matrix

| Task Pattern | Agent | Model | Why |
|---|---|---|---|
| New feature | generator | sonnet | Full tool access, fast |
| Bug fix | build-fixer | sonnet | Minimal diff focus |
| Code review | code-reviewer | sonnet | Read-only = objective |
| Security | security-reviewer | sonnet | Specialized detection |
| Quality gate | evaluator | opus | Adversarial, hard thresholds |
| Planning | planner | opus | Strategic decomposition |
| Architecture | architect | opus | Design reasoning |
| TDD | tdd-guide | sonnet | Test-first enforcement |

## Context Budget Rules

- Each sub-task: estimate tokens before delegating
- Reserve 40% for evaluator and state preservation
- If a sub-task exceeds budget, split it further
- Never load all skills at once — lazy load by relevance