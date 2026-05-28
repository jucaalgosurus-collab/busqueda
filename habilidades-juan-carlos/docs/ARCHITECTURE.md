# Habilidades Juan Carlos — Architecture

## System Overview

HJC is an autonomous agent system built on the Anthropic harness design pattern (Planner → Generator → Evaluator) with 5 core pillars that fix every weakness found in ECC.

## The 5 Pillars

### 1. Orchestrator
**Problem in ECC**: No formal orchestrator. Agent routing is based on the host LLM reading descriptions and guessing, leading to misrouting and lost objectives.

**HJC Solution**: A dedicated orchestrator agent that decomposes tasks, selects agents, establishes sprint contracts, and tracks progress. The orchestrator NEVER loses the objective.

### 2. Structured Memory
**Problem in ECC**: Three disconnected storage systems (flat markdown files, JSONL observations, SQLite state store). Session files parsed with fragile regex. No state preservation before compaction. Instincts require manual invocation.

**HJC Solution**: Single structured state file (`memory/state/active-state.md`) with:
- Structured sections (Objective, Current Sprint, Completed Work, Decisions, Pending)
- Pre-compaction preservation via hooks
- Session start restoration
- Instinct engine with auto-decay, auto-evolve, and conflict resolution

### 3. Independent Evaluator
**Problem in ECC**: Self-evaluation only. LLMs "confidently praise the work" even when it's mediocre. No hard thresholds.

**HJC Solution**: Separate evaluator agent with:
- Binary PASS/FAIL criteria (no partial credit)
- Anti-bias instructions (start with failures, not praise)
- Hard thresholds on universal quality gates
- Sprint contracts that define "done" before work begins

### 4. Sprint Contracts
**Problem in ECC**: No contracts. Agents work without a clear definition of "done." Scope creep, ambiguous completions, self-praise.

**HJC Solution**: Before every sprint, the generator and evaluator negotiate a contract:
- What will be delivered
- How success is verified (specific, measurable criteria)
- What is explicitly excluded
- Budget and max retries

### 5. Auto-Improvement
**Problem in ECC**: Instincts require manual `/learn` and `/evolve` invocation. No confidence decay. No conflict resolution. Windows not supported.

**HJC Solution**: Automatic instinct evolution:
- Patterns detected after 3+ observations
- Confidence increases with use (+0.03) and decreases without (-0.05)
- Auto-prune below 0.3 threshold
- Conflict resolution: higher confidence wins, project-scoped beats global
- 3+ related instincts auto-evolve into a parent pattern

## Directory Structure

```
habilidades-juan-carlos/
├── CLAUDE.md                    # System instructions (always loaded)
├── agents/                      # 9 specialized agents
│   ├── orchestrator.md          # Central coordinator (opus)
│   ├── planner.md               # Strategic decomposition (opus)
│   ├── architect.md             # System design (opus)
│   ├── generator.md              # Code implementation (sonnet)
│   ├── evaluator.md              # Quality gate (opus, adversarial)
│   ├── code-reviewer.md          # Code review (sonnet, read-only)
│   ├── security-reviewer.md      # Security review (sonnet, read-only)
│   ├── build-fixer.md           # Error resolver (sonnet)
│   └── tdd-guide.md             # Test-first enforcement (sonnet)
├── skills/                      # 7 core skills
│   ├── always-execute/          # SIEMPRE EJECUTAR norm
│   ├── memory-preserve/         # Never lose context
│   ├── sprint-contract/         # Define "done" before building
│   ├── strategic-compact/       # Smart compaction
│   ├── instinct-evolve/         # Auto-improvement
│   ├── orchestrator-route/      # Task routing
│   └── semantic-index/          # (Future) Embedding-based retrieval
├── rules/                       # Always-on norms
│   ├── always-execute.md        # Execute without hesitation
│   ├── never-lose-context.md    # Preserve state always
│   └── orchestrator-first.md    # Route through orchestrator
├── hooks/                       # Lifecycle enforcement
│   └── hooks.json               # Claude Code hook configuration
├── scripts/                     # Implementation
│   ├── memory/                  # State preservation
│   │   └── state-preserve.js    # Session start: load state + instincts
│   ├── state/                   # Session management
│   │   └── state-store.js       # Session end: save state + archive
│   ├── contract/                # Sprint contracts
│   │   └── verify.js            # Contract creation and verification
│   └── instinct/                # Auto-improvement
│       └── engine.js            # Decay, conflicts, evolution
├── contexts/                    # Working modes
│   ├── dev.md                   # Active development
│   ├── review.md                # Code review
│   └── research.md              # Exploration
├── memory/                       # Persistent state
│   ├── state/
│   │   └── active-state.md      # Current session state
│   ├── instincts/               # Learned patterns
│   ├── contracts/               # Sprint contracts
│   └── sessions/                # Archived sessions
└── docs/
    └── ARCHITECTURE.md          # This file
```

## Comparison with ECC

| Aspect | ECC | HJC |
|--------|-----|-----|
| Orchestrator | None (implicit delegation) | Dedicated agent with routing protocol |
| Memory | 3 disconnected systems, regex-parsed | Single structured state, JSON frontmatter |
| Compaction | Only logs that it happened | Preserves state before compaction |
| Instincts | Manual `/learn` and `/evolve` | Automatic creation, decay, conflict resolution |
| Evaluator | Self-evaluation only | Independent adversarial agent with hard thresholds |
| Sprint Contracts | None | Mandatory before every work block |
| Context Budget | Manual skill disabling | Lazy loading, 8 instincts max, budget estimation |
| Storage | Flat files + JSONL + SQLite (disconnected) | Structured markdown with sections (parseable) |
| Hooks | Fragile, broke repeatedly (#29, #52, #103) | Simple, focused, with error recovery |
| Auto-improvement | Manual invocation | Automatic pattern detection and evolution |
| Agent Tool Access | Inconsistent (security-reviewer can write) | Principle of least privilege enforced |
| Windows Support | Observer explicitly disabled | Cross-platform Node.js scripts |

## Design Principles (from Anthropic Harness Design)

1. **Decompose into tractable chunks** — The orchestrator breaks tasks into sprints, each with a clear contract
2. **Structured artifacts for context handoff** — `active-state.md` carries state between agents and sessions
3. **Generator-evaluator feedback loops** — Separate agents, adversarial evaluation, hard thresholds
4. **Strategic pivoting** — If a sprint fails 3 times, escalate to planner for re-decomposition
5. **Progressive simplification** — Start with the full harness, remove components as model capability improves
6. **Few-shot calibration** — The evaluator uses specific criteria, not vibes