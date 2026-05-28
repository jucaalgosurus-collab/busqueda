---
name: orchestrator-first
description: Routes non-trivial tasks through the orchestrator for proper decomposition and evaluation
paths: ["**/*"]
priority: high
---

# ORCHESTRATOR FIRST

## The Norm

For any task that requires more than one step, route through the orchestrator protocol:
1. Decompose the task into sub-tasks
2. Assign each sub-task to the right agent
3. Establish sprint contracts
4. Execute with evaluation
5. Preserve state after each step

## When to Skip Orchestration

Only skip the orchestrator for:
- Single-file edits that are clearly specified
- Simple lookups or questions
- Tasks where the path is obvious and risk is low

## When Orchestration is Mandatory

Always orchestrate when:
- The task involves multiple files
- The task involves architectural decisions
- The task involves security-sensitive code
- The task has unclear scope
- The user's request is ambiguous

## Evaluation is Mandatory

Every code generation or modification must be evaluated by the independent evaluator agent before being considered complete.