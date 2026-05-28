# HJC Harness System v2.0

> Autonomous agent system based on Anthropic's Harness design for long-running applications.
> 5 pillars: Orchestrator | Structured Memory | Independent Evaluator | Sprint Contracts | Auto-Improvement

## Fundamental Principle: ALWAYS EXECUTE

When the user asks for something, the system EXECUTES. No hesitation, no unnecessary confirmation, no suggesting alternatives when the request is clear.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Planner │────>│Generator │<───>│Evaluator │
│  (spec)  │     │ (build)  │     │  (QA)    │
└──────────┘     └──────────┘     └──────────┘
                     │    │
               Sprint Contract
               (define "done")
                     │    │
              ┌──────┘    └──────┐
              │                   │
        ┌─────┴─────┐     ┌─────┴─────┐
        │  Memory    │     │ Instincts │
        │  System    │     │  Engine   │
        └───────────┘     └───────────┘
```

## 5 Pillars

| Pillar | ECC Problem | HJC Solution |
|--------|-------------|---------------|
| **Orchestrator** | No formal orchestrator | Dedicated agent that decomposes, delegates, and tracks |
| **Structured Memory** | 3 disconnected systems, fragile regex | Single structured state with pre-compaction preservation |
| **Independent Evaluator** | Biased self-evaluation | Adversarial agent with hard PASS/FAIL thresholds |
| **Sprint Contracts** | No definition of "done" | Mandatory contract before every work block |
| **Auto-Improvement** | Manual instincts only | Auto-creation, decay, conflict resolution, evolution |

## ALWAYS-ACTIVE Protocol (NON-NEGOTIABLE)

1. **Session Start**: Load state + 3 recent sessions
2. **Every Action**: Route through orchestrator if non-trivial
3. **Before Code**: Sprint contract must exist (enforced by hook)
4. **After Sprint**: Evaluator grades with hard thresholds
5. **Session End**: Save state + archive session
6. **Context Pressure**: Compact at logical boundaries

## Agents (9 Core + 61 Reference)

| Agent | Model | Role |
|-------|-------|------|
| orchestrator | opus | Coordinate, delegate, track progress |
| planner | opus | Decompose tasks, create contracts |
| architect | opus | System design, ADRs |
| generator | sonnet | Implement code |
| evaluator | opus | Verify quality with hard thresholds |
| code-reviewer | sonnet | Code review (read-only) |
| security-reviewer | sonnet | Security review (read-only) |
| build-fixer | sonnet | Fix build errors |
| tdd-guide | sonnet | Test-first development |

+ 61 ECC reference agents in `agents/ecc-agents/` covering TypeScript, Python, Go, Rust, Kotlin, Java, C++, C#, F#, Swift, Dart, and domain specialists.

## Skills (13 Core + 246 ECC)

| Skill | Purpose |
|-------|---------|
| always-execute | ALWAYS EXECUTE norm |
| sprint-contract | Define "done" before building |
| evaluator-gate | Independent evaluation with hard thresholds |
| orchestrator-route | Task routing protocol |
| memory-preserve | Preserve context across sessions |
| instinct-evolve | Auto-improvement with decay and evolution |
| session-memory | Cross-chat memory search and restore |
| semantic-index | Lazy loading of skills by relevance |
| skill-index | Master registry of available skills |
| strategic-compact | Smart compaction that preserves objectives |
| hermes-asset-valuation | Industrial asset valuation from NotebookLM |
| hermes-certifications | Certification verification from NotebookLM |
| hermes-technical-audit | Technical audit from NotebookLM |

+ 246 ECC skills in `skills/` covering frameworks, languages, DevOps, and domains.

## Rules (3 Core + 20 ECC)

- **always-execute** (CRITICAL): Execute first, inform second
- **never-lose-context** (CRITICAL): State preservation at 5 mandatory moments
- **orchestrator-first** (HIGH): Route non-trivial tasks through orchestrator

+ 20 ECC rules in `rules/` covering coding style, security, testing, patterns, and language-specific standards.

## Workflow

```
User → Orchestrator → Plan (sub-tasks + contracts)
                            ↓
                  Delegate to agents
                            ↓
                  Generator executes
                            ↓
                  Evaluator verifies
                            ↓
           Pass contract? → Yes → Complete → Next
                           → No  → Feedback → Retry (max 3)
```

## Memory System

The system never loses context because:

1. **Before compaction** → preserve state in `memory/state/active-state.md`
2. **Session start** → load state + relevant instincts (confidence >= 0.5, top 8)
3. **Instincts** with confidence that rises with use (+0.03) and falls without (-0.05)
4. **Conflicts** between instincts → higher confidence wins
5. **Instincts** below 0.3 confidence → auto-pruned
6. **3+ instincts** sharing a theme → evolve into parent instinct

## Hooks

| Event | Script | Purpose |
|-------|--------|---------|
| SessionStart | state-preserve.js | Load state + instincts + recent sessions |
| SessionEnd | state-store.js | Save state + update instincts + archive session |
| PreToolUse | contract/verify.js | Block Write/Edit without sprint contract |

## Installation

```bash
git clone https://github.com/jucaalgo/habilidadesclaude.git
cd habilidadesclaude
npm run setup
```

## Based On

- [Anthropic Harness Design](https://www.anthropic.com/engineering/harness-design-long-running-apps) — GAN pattern, sprint contracts, independent evaluation
- [ECC by Affaan Mustafa](https://github.com/affaan-m/ECC) — 246 skills, 61 agents, 20 rules, hooks, manifests

## License

MIT