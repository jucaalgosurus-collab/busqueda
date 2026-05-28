---
name: ecc-adapter
description: Adapter that makes all ECC skills available to HJC. When a task requires specialized knowledge (Django, Rust, healthcare, etc.), this skill loads the corresponding ECC skill and adapts it to HJC's sprint contract and evaluation patterns.
dependencies: [skill-index, sprint-contract, evaluator-gate]
triggers:
  - when working with a specific language or framework
  - when domain-specific knowledge is needed
  - when the skill-index maps to an ECC skill
tags: [core, adapter, bridge]
---

# ECC Skill Adapter

This skill bridges HJC with the full ECC skill library. It provides two mechanisms for accessing ECC skills:

## Mechanism 1: Skill Index Lookup

The orchestrator consults `skill-index` to find which ECC skill matches the current task. Then this adapter loads that skill from the ECC repository and wraps it with HJC's sprint contract and evaluation patterns.

## Mechanism 2: Direct ECC Skill Path

For direct access, ECC skills are located at:
```
/path/to/ecc-analysis/skills/{skill-name}/SKILL.md
```

## How to Use an ECC Skill

When the orchestrator identifies a relevant ECC skill:

1. **Read the skill**: Load `SKILL.md` from the ECC skill directory
2. **Apply HJC wrapper**: Before executing the skill's instructions:
   - Establish a sprint contract (what "done" means)
   - Execute the skill's workflow
   - Run the evaluator gate after completion
   - Preserve state in `memory/state/active-state.md`
3. **Report completion**: Update the sprint contract and state

## ECC Skill Categories Available

### Languages & Frameworks (56 skills)
python-patterns, python-testing, django-patterns, django-tdd, django-security, django-verification, fastapi-patterns, golang-patterns, golang-testing, rust-patterns, rust-testing, kotlin-patterns, kotlin-testing, kotlin-ktor-patterns, kotlin-coroutines-flows, kotlin-exposed-patterns, java-coding-standards, springboot-patterns, springboot-security, springboot-tdd, springboot-verification, jpa-patterns, angular-developer, dotnet-patterns, csharp-testing, fsharp-testing, laravel-patterns, laravel-security, laravel-tdd, laravel-verification, nestjs-patterns, quarkus-patterns, quarkus-security, quarkus-tdd, quarkus-verification, swiftui-patterns, swift-concurrency-6-2, swift-protocol-di-testing, swift-actor-persistence, dart-flutter-patterns, flutter-dart-code-review, cpp-coding-standards, cpp-testing, perl-patterns, perl-security, perl-testing, mysql-patterns, postgres-patterns, redis-patterns, prisma-patterns, database-migrations, vite-patterns, nextjs-turbopack, nuxt4-patterns, android-clean-architecture, docker-patterns, nodejs-keccak256

### Domain-Specific (23 skills)
healthcare-cdss-patterns, healthcare-emr-patterns, healthcare-eval-harness, healthcare-phi-compliance, hipaa-compliance, energy-procurement, customs-trade-compliance, customer-billing-ops, finance-billing-ops, logistics-exception-management, production-scheduling, quality-nonconformance, returns-reverse-logistics, inventory-demand-planning, carrier-relationship-management, defi-amm-security, llm-trading-agent-security, evm-token-decimals, cisco-ios-patterns, network-bgp-diagnostics, network-config-validation, network-interface-health, visa-doc-translate

### Security (9 skills)
security-review, security-scan, security-bounty-hunter, gateguard, django-security, laravel-security, springboot-security, quarkus-security, perl-security

### Frontend & Design (11 skills)
frontend-patterns, frontend-a11y, frontend-design-direction, frontend-slides, design-system, liquid-glass-design, make-interfaces-feel-better, ui-demo, ui-to-vue, accessibility, ios-icon-gen

### Agentic (15 skills)
agent-architecture-audit, agent-eval, agent-harness-construction, agent-introspection-debugging, agent-sort, agentic-engineering, agentic-os, autonomous-loops, continuous-agent-loop, plan-orchestrate, verification-loop, autonomous-agent-harness, council, nanoclaw-repl, agent-payment-x402

### Operations (23 skills)
deployment-patterns, production-audit, canary-watch, cost-tracking, cost-aware-llm-pipeline, token-budget-advisor, context-budget, flox-environments, uncloud, github-ops, email-ops, messages-ops, unified-notifications-ops, terminal-ops, jira-integration, google-workspace-ops, workspace-surface-audit, click-path-audit, homelab-network-setup, homelab-network-readiness, homelab-pihole-dns, homelab-vlan-segmentation, homelab-wireguard-vpn, netmiko-ssh-automation, windows-desktop-e2e

### Data & Research (17 skills)
data-scraper-agent, data-throughput-accelerator, recsys-pipeline-architect, scientific-db-pubmed-database, scientific-db-uspto-database, scientific-pkg-gget, scientific-thinking-literature-review, scientific-thinking-scholar-evaluation, clickhouse-io, content-hash-cache-pattern, deep-research, market-research, research-ops, exa-search, search-first, codebase-onboarding, code-tour

### Architecture & Patterns (13 skills)
architecture-decision-records, hexagonal-architecture, backend-patterns, error-handling, api-design, api-connector-builder, latency-critical-systems, recursive-decision-ledger, connections-optimizer, parallel-execution-optimizer, mcp-server-patterns, santa-method, tinystruct-patterns

### Testing & Quality (9 skills)
tdd-workflow, e2e-testing, ai-regression-testing, benchmark, benchmark-optimization-loop, verification-loop, eval-harness, skill-comply, planner

### Marketing & Content (10 skills)
marketing-campaign, content-engine, brand-voice, article-writing, social-publisher, crosspost, seo, product-lens, product-capability, investor-materials

### Video & Media (5 skills)
video-editing, manim-video, remotion-video-creation, videodb, fal-ai-media

## Key Differences from Raw ECC

When using an ECC skill through this adapter:

1. **Sprint Contracts are Mandatory**: Every ECC skill workflow must be wrapped in a sprint contract before execution
2. **Evaluation is Mandatory**: After completing any ECC skill workflow, the evaluator gate must verify the results
3. **State is Preserved**: Progress is saved to `memory/state/active-state.md` after each step
4. **Context is Budgeted**: Only the relevant ECC skill is loaded, not all 246
5. **Instincts are Updated**: If a pattern is observed during ECC skill execution, an instinct is created