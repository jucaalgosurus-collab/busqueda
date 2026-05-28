---
name: evaluator-gate
description: Use PROACTIVELY after every code generation or modification sprint. This skill enforces the independent evaluator pattern from Anthropic's harness design — the evaluator is deliberately adversarial and uses hard PASS/FAIL thresholds.
dependencies: [sprint-contract]
triggers:
  - after code generation
  - after feature implementation
  - after bug fix
  - after refactoring
  - sprint completion
tags: [core, evaluation, quality]
---

# Evaluator Gate

## The Problem This Solves

ECC has no independent evaluator. Code is self-evaluated, and LLMs "confidently praise the work — even when, to a human observer, the quality is obviously mediocre" (Anthropic harness design article). This skill enforces the GAN pattern: a separate evaluator with hard thresholds.

## Protocol

### When to Evaluate

After EVERY code generation sprint:
1. The generator completes its sprint
2. The evaluator is invoked INDEPENDENTLY (not by the generator)
3. The evaluator checks against the sprint contract criteria
4. If ANY criterion fails: sprint FAILS
5. Specific, actionable feedback is provided
6. The generator retries (max 3 attempts)
7. If 3 retries fail: escalate to planner for re-decomposition

### Hard Thresholds (Non-Negotiable)

These gates apply to ALL sprints, regardless of the contract:

| Gate | Criteria | Threshold |
|------|----------|-----------|
| Functionality | Does it do what it claims? | 100% of contract criteria must pass |
| Security | OWASP Top 10 scan | 0 critical/high vulnerabilities |
| Maintainability | New developer < 5min understanding | Subjective but strict |
| Context | State preserved in memory | active-state.md updated |

### Anti-Bias Protocol

The evaluator MUST:
1. Start with failures, not successes
2. Never say "this looks good overall"
3. Test edge cases, not happy paths
4. Assume bugs exist until proven otherwise
5. Probe for failure modes: bad input, concurrent access, network errors

### Evaluation Report Format

```markdown
## Sprint Evaluation: [Name]

### Contract Criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | [criterion] | PASS/FAIL | [specific evidence] |

### Universal Gates
| Gate | Result | Notes |
|------|--------|-------|
| Functionality | PASS/FAIL | [evidence] |
| Security | PASS/FAIL | [evidence] |
| Maintainability | PASS/FAIL | [evidence] |
| Context | PASS/FAIL | [evidence] |

### Verdict: PASS / FAIL
[If FAIL: specific, actionable feedback for the generator]
```

### Retry Protocol

After a FAIL:
1. Feed the evaluation report to the generator
2. Generator addresses ONLY the specific failures
3. Do NOT change scope, add features, or refactor unrelated code
4. Re-evaluate against the SAME contract criteria
5. If still fails after 3 attempts: escalate to planner