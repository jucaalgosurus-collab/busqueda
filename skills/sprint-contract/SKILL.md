---
name: sprint-contract
description: Use PROACTIVELY before every non-trivial work block. This skill establishes what "done" means before work begins, following Anthropic's harness design pattern. Without a contract, work direction is ambiguous and evaluation is impossible.
dependencies: [always-execute, memory-preserve]
triggers:
  - before implementing a feature
  - before fixing a bug
  - before refactoring
  - before any work block
tags: [core, contract, quality]
---

# Sprint Contract

## The Problem This Solves

ECC has no sprint contracts at all — agents work without a clear definition of "done." This leads to scope creep, ambiguous completions, and the tendency to self-evaluate positively. Sprint contracts are the Anthropic harness pattern that ensures every work block has a clear, measurable target.

## Protocol

### Before the Sprint (Contract Negotiation)

1. **Generator proposes**: What I will build, how success is verified
2. **Evaluator reviews**: Is this building the right thing? Are criteria testable?
3. **Contract approved**: Both sides agree on what "done" means

### Contract Format
```markdown
# Sprint Contract: [Name]

## Objective
[One sentence: what this sprint delivers]

## Success Criteria
1. [Specific, measurable criterion]
2. [Specific, measurable criterion]
3. [Specific, measurable criterion]

## Scope Exclusions
- [What is explicitly NOT included]

## Agent Assignment
- Generator: [agent name]
- Evaluator: evaluator

## Budget
- Estimated tokens: [N]
- Max retries: 3

## Context
- Previous sprint: [what was completed]
- Key decisions: [decisions that affect this sprint]
```

### During the Sprint

- The generator implements ONLY what the contract specifies
- If the generator discovers the contract is incomplete, STOP and renegotiate
- NEVER silently expand scope

### After the Sprint (Evaluation)

- The evaluator checks EACH success criterion independently
- If ANY criterion fails → sprint FAILS → specific feedback → retry (max 3)
- If ALL criteria pass → sprint PASSES → move to next sprint

### Contract Granularity

Contracts should be granular enough that each criterion is atomic:
- BAD: "The feature works correctly"
- GOOD: "POST /api/users returns 201 with valid data, 422 with invalid email"

The Anthropic article notes: "Sprint 3 alone had 27 criteria." Be specific.