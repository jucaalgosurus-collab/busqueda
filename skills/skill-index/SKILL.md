---
name: skill-index
description: MASTER SKILL REGISTRY. The orchestrator consults this index to know which skill to invoke for any task. This is the brain that knows WHAT each skill does, WHEN to use it, and HOW to chain them. ALWAYS consult this before delegating work.
dependencies: [orchestrator-route]
triggers:
  - any task that requires specialized knowledge
  - before delegating to any agent
  - when uncertain about which skill to use
tags: [core, registry, routing, master]
---

# Skill Index — Master Registry

This is the brain of HJC. The orchestrator consults this index to find the right skill for any task. Each entry maps a trigger condition to a skill with a one-line description, so the system always knows WHAT to invoke and WHEN.

## How This Index Works

When the orchestrator receives a task, it:
1. Scans the trigger conditions below
2. Matches the task to the most relevant skill(s)
3. Loads ONLY the matched skill (lazy loading)
4. Delegates to the appropriate agent with the skill's context

This replaces ECC's "load all 246 skills and hope the LLM picks the right one" approach with a deterministic routing table.

---

## CORE — Essential Workflow Skills

These skills are ALWAYS available and form the backbone of HJC:

| Skill | Trigger | One-Line Description |
|-------|---------|---------------------|
| always-execute | any task start | Execute immediately, don't ask permission |
| memory-preserve | before compaction, session end, task transition | Never lose context, preserve structured state |
| sprint-contract | before implementing, before refactoring | Define "done" before building, negotiate criteria |
| strategic-compact | context > 60%, before agent delegation | Compact strategically, preserve objective |
| instinct-evolve | session end, pattern observed 3+ times | Auto-evolve instincts with decay and conflict resolution |
| orchestrator-route | any multi-step task, any non-trivial request | Route through orchestrator for decomposition |
| evaluator-gate | after code generation, after feature implementation | Independent evaluation with hard PASS/FAIL thresholds |
| semantic-index | session start, task change, context budget concern | Lazy-load skills by relevance, not all at once |

---

## LANGUAGE — Framework & Language Patterns

Invoke when working with a specific language or framework. These contain idiomatic patterns, testing approaches, and common pitfalls.

| Skill | Trigger | Description |
|-------|---------|-------------|
| python-patterns | Python code, Django, FastAPI, Flask | Python idiomatic patterns, typing, async, error handling |
| python-testing | Python tests, pytest, unittest | Python testing strategies, fixtures, mocking patterns |
| django-patterns | Django projects, models, views, ORM | Django models, views, middleware, ORM patterns |
| django-tdd | Django features, Django bug fixes | Test-driven Django development |
| django-security | Django security, Django auth, CSRF | Django security patterns, OWASP for Django |
| django-verification | Django deployment checks, Django QA | Django verification and deployment readiness |
| fastapi-patterns | FastAPI projects, async Python APIs | FastAPI routing, dependency injection, async patterns |
| golang-patterns | Go code, microservices in Go | Go idiomatic patterns, concurrency, error handling |
| golang-testing | Go tests, table-driven tests | Go testing strategies, benchmarks, fuzzing |
| rust-patterns | Rust code, unsafe Rust, lifetimes | Rust ownership patterns, lifetimes, error handling |
| rust-testing | Rust tests, proptest, benchmark | Rust testing strategies, property testing |
| kotlin-patterns | Kotlin code, coroutines, flows | Kotlin idiomatic patterns, coroutines, flows |
| kotlin-testing | Kotlin tests, JUnit, MockK | Kotlin testing strategies |
| kotlin-ktor-patterns | Ktor projects, Kotlin server | Ktor routing, middleware, authentication |
| kotlin-coroutines-flows | Kotlin async, Flow, Channel | Kotlin coroutines and Flow patterns |
| kotlin-exposed-patterns | Kotlin Exposed ORM, database | Kotlin Exposed ORM patterns |
| java-coding-standards | Java code, Spring, JPA | Java coding standards, patterns |
| springboot-patterns | Spring Boot projects | Spring Boot DI, REST, configuration patterns |
| springboot-security | Spring security, OAuth2, JWT | Spring Security patterns |
| springboot-tdd | Spring Boot features, Spring tests | Test-driven Spring Boot development |
| springboot-verification | Spring Boot deployment, Spring QA | Spring Boot verification |
| jpa-patterns | JPA, Hibernate, entity mapping | JPA entity patterns, N+1 prevention |
| typescript-patterns | TypeScript code, React, Node | TypeScript patterns, type safety, async |
| angular-developer | Angular projects, components, services | Angular component patterns, services, routing |
| dotnet-patterns | .NET code, C#, ASP.NET | .NET patterns, DI, middleware |
| csharp-testing | C# tests, xUnit, NUnit | C# testing strategies |
| fsharp-testing | F# tests, Expecto | F# testing strategies |
| laravel-patterns | Laravel projects, Eloquent, Blade | Laravel patterns, Eloquent, Blade, middleware |
| laravel-security | Laravel auth, CSRF, XSS | Laravel security patterns |
| laravel-tdd | Laravel features, Laravel tests | Test-driven Laravel development |
| laravel-verification | Laravel deployment, Laravel QA | Laravel verification |
| nestjs-patterns | NestJS projects, decorators, guards | NestJS patterns, decorators, guards |
| quarkus-patterns | Quarkus projects, reactive | Quarkus patterns, reactive programming |
| quarkus-security | Quarkus security, JWT | Quarkus security patterns |
| quarkus-tdd | Quarkus tests, Quarkus features | Test-driven Quarkus development |
| swiftui-patterns | SwiftUI, iOS, Swift | SwiftUI patterns, declarative UI |
| swift-concurrency-6-2 | Swift 6.2, async/await, actors | Swift concurrency patterns |
| swift-protocol-di-testing | Swift protocols, DI, testing | Swift protocol-based DI and testing |
| swift-actor-persistence | Swift actors, persistent data | Swift actor persistence patterns |
| dart-flutter-patterns | Flutter, Dart, widgets | Flutter/Dart patterns, state management |
| flutter-dart-code-review | Flutter PRs, Dart reviews | Flutter/Dart code review checklist |
| cpp-coding-standards | C++ code, modern C++ | Modern C++ patterns, RAII, smart pointers |
| cpp-testing | C++ tests, GTest, Catch2 | C++ testing strategies |
| perl-patterns | Perl code, regex, CPAN | Perl patterns, regex, modules |
| perl-security | Perl security, taint mode | Perl security patterns |
| perl-testing | Perl tests, Test::More | Perl testing strategies |
| mysql-patterns | MySQL queries, indexes, schema | MySQL patterns, indexing, query optimization |
| postgres-patterns | PostgreSQL, SQL, indexes | PostgreSQL patterns, CTEs, window functions |
| redis-patterns | Redis, caching, pub/sub | Redis patterns, caching strategies |
| prisma-patterns | Prisma ORM, schema, migrations | Prisma schema patterns, migrations |
| database-migrations | schema changes, data migrations | Database migration patterns, zero-downtime |
| vite-patterns | Vite, frontend bundling, HMR | Vite configuration and patterns |
| nextjs-turbopack | Next.js, Turbopack, SSR | Next.js patterns with Turbopack |
| nuxt4-patterns | Nuxt 4, Vue, SSR | Nuxt 4 patterns |
| android-clean-architecture | Android, Kotlin, MVVM | Android clean architecture patterns |
| docker-patterns | Dockerfile, docker-compose, containers | Docker patterns, multi-stage builds |
| nodejs-keccak256 | Node.js, crypto, hashing | Node.js keccak256 patterns |

---

## DOMAIN — Industry-Specific Knowledge

Invoke when working in a specific industry domain.

| Skill | Trigger | Description |
|-------|---------|-------------|
| healthcare-cdss-patterns | clinical decision support, CDSS | Clinical decision support system patterns |
| healthcare-emr-patterns | EMR, EHR, medical records | Electronic medical record patterns |
| healthcare-eval-harness | healthcare QA, medical compliance | Healthcare evaluation harness |
| healthcare-phi-compliance | PHI, HIPAA, patient data | Protected Health Information compliance |
| hipaa-compliance | HIPAA, healthcare security | HIPAA compliance checklist |
| energy-procurement | energy contracts, procurement | Energy procurement patterns |
| customs-trade-compliance | customs, trade, import/export | Customs and trade compliance |
| customer-billing-ops | billing, invoicing, payments | Customer billing operations |
| finance-billing-ops | financial billing, reconciliation | Financial billing operations |
| logistics-exception-management | shipping exceptions, logistics | Logistics exception handling |
| production-scheduling | manufacturing scheduling, MES | Production scheduling patterns |
| quality-nonconformance | QC, nonconformance, CAPA | Quality nonconformance management |
| returns-reverse-logistics | returns, reverse logistics | Returns and reverse logistics |
| inventory-demand-planning | inventory, forecasting, planning | Inventory demand planning |
| carrier-relationship-management | carriers, shipping, 3PL | Carrier relationship management |
| defi-amm-security | DeFi, AMM, smart contracts | DeFi AMM security patterns |
| llm-trading-agent-security | trading bots, LLM, financial | LLM trading agent security |
| evm-token-decimals | EVM, tokens, decimals | EVM token decimal handling |
| cisco-ios-patterns | Cisco, IOS, network config | Cisco IOS configuration patterns |
| network-bgp-diagnostics | BGP, routing, network diagnostics | BGP diagnostic patterns |
| network-config-validation | network config, validation | Network configuration validation |
| network-interface-health | interface health, monitoring | Network interface health monitoring |
| visa-doc-translate | visa documents, translation | Visa document translation |

---

## SECURITY — Security & Compliance

Invoke when security review, vulnerability assessment, or compliance is needed.

| Skill | Trigger | Description |
|-------|---------|-------------|
| security-review | security audit, vulnerability scan | Comprehensive security review |
| security-scan | SAST, DAST, vulnerability scanning | Security scanning patterns |
| security-bounty-hunter | bug bounty, vulnerability research | Bug bounty hunting strategies |
| gateguard | gate checks, permission validation | Gate guard validation patterns |
| django-security | Django auth, CSRF, XSS | Django-specific security |
| laravel-security | Laravel auth, CSRF | Laravel-specific security |
| springboot-security | Spring Security, OAuth2 | Spring Boot security patterns |
| quarkus-security | Quarkus JWT, auth | Quarkus security patterns |
| perl-security | Perl taint mode, CGI security | Perl security patterns |

---

## FRONTEND & DESIGN — UI/UX

Invoke when working on frontend, UI, or design tasks.

| Skill | Trigger | Description |
|-------|---------|-------------|
| frontend-patterns | frontend code, React, Vue | Frontend architecture patterns |
| frontend-a11y | accessibility, WCAG, ARIA | Frontend accessibility patterns |
| frontend-design-direction | design system, UI direction | Frontend design direction |
| frontend-slides | presentation slides, UI demo | Frontend presentation slides |
| design-system | design tokens, theme, components | Design system patterns |
| liquid-glass-design | glassmorphism, modern UI | Liquid glass design patterns |
| make-interfaces-feel-better | UI polish, micro-interactions | Interface polish and feel |
| ui-demo | UI demo, prototype | UI demo creation |
| ui-to-vue | UI to Vue conversion | UI to Vue component conversion |
| accessibility | a11y, WCAG, screen readers | Accessibility audit and patterns |
| ios-icon-gen | iOS icons, app icons | iOS icon generation |

---

## AGENTIC — Agent Orchestration & Automation

Invoke when building or managing agentic systems.

| Skill | Trigger | Description |
|-------|---------|-------------|
| agent-architecture-audit | agent system audit, multi-agent | Agent architecture audit |
| agent-eval | agent evaluation, benchmark | Agent evaluation harness |
| agent-harness-construction | building agent harnesses | Agent harness construction |
| agent-introspection-debugging | agent debugging, self-reflection | Agent introspection and debugging |
| agent-sort | agent classification, DAILY/LIBRARY | Agent/skill classification |
| agentic-engineering | agentic system design | Agentic engineering patterns |
| agentic-os | OS-level agent operations | Agentic OS patterns |
| autonomous-loops | autonomous iteration, loop | Autonomous loop patterns |
| continuous-agent-loop | continuous agent execution | Continuous agent loop |
| plan-orchestrate | multi-step planning, orchestration | Plan and orchestrate |
| verification-loop | verification cycles, quality loops | Verification loop patterns |
| autonomous-agent-harness | autonomous harness setup | Autonomous agent harness |
| council | multi-agent council, debate | Multi-agent council pattern |
| nanoclaw-repl | interactive REPL, session | NanoClaw REPL for sessions |
| agent-payment-x402 | agent payments, x402 | Agent payment protocol (x402) |

---

## OPS — Operations & Deployment

Invoke for deployment, monitoring, and production concerns.

| Skill | Trigger | Description |
|-------|---------|-------------|
| deployment-patterns | deployment, CI/CD, release | Deployment patterns and strategies |
| production-audit | production readiness, audit | Production audit checklist |
| canary-watch | canary deployment, monitoring | Canary deployment monitoring |
| cost-tracking | cost monitoring, token budget | Cost and budget tracking |
| cost-aware-llm-pipeline | LLM cost optimization | Cost-aware LLM pipeline patterns |
| token-budget-advisor | token budget, context window | Token budget advisory |
| context-budget | context window management | Context budget management |
| flox-environments | Flox, Nix, reproducible | Flox environment management |
| uncloud | cloud abstraction, multi-cloud | Cloud abstraction patterns |
| github-ops | GitHub workflows, CI | GitHub operations patterns |
| email-ops | email processing, automation | Email operations |
| messages-ops | messaging, notifications | Message operations |
| unified-notifications-ops | notification aggregation | Unified notification operations |
| terminal-ops | terminal ops, automation | Terminal operations |
| jira-integration | Jira, issue tracking | Jira integration patterns |
| google-workspace-ops | Google Workspace, Calendar, Docs | Google Workspace operations |
| workspace-surface-audit | workspace audit, surface check | Workspace surface audit |
| click-path-audit | click path, user flow audit | Click path audit |
| homelab-network-setup | homelab, network setup | Homelab network setup |
| homelab-network-readiness | homelab readiness check | Homelab readiness check |
| homelab-pihole-dns | Pi-hole, DNS, ad blocking | Homelab Pi-hole DNS |
| homelab-vlan-segmentation | VLAN, network segmentation | Homelab VLAN segmentation |
| homelab-wireguard-vpn | WireGuard, VPN, tunneling | Homelab WireGuard VPN |
| netmiko-ssh-automation | SSH automation, network | Netmiko SSH automation |
| windows-desktop-e2e | Windows desktop, E2E | Windows desktop E2E testing |

---

## DATA — Data & Database

Invoke for data operations, databases, and data pipelines.

| Skill | Trigger | Description |
|-------|---------|-------------|
| data-scraper-agent | web scraping, data extraction | Data scraping agent patterns |
| data-throughput-accelerator | data pipeline, throughput | Data throughput acceleration |
| recsys-pipeline-architect | recommendation systems | Recommendation system architecture |
| scientific-db-pubmed-database | PubMed, medical literature | PubMed database patterns |
| scientific-db-uspto-database | USPTO, patent data | USPTO database patterns |
| scientific-pkg-gget | gget, bioinformatics | gget bioinformatics package |
| scientific-thinking-literature-review | literature review, research | Literature review patterns |
| scientific-thinking-scholar-evaluation | scholar evaluation, citations | Scholar evaluation patterns |
| clickhouse-io | ClickHouse, OLAP, analytics | ClickHouse patterns |
| content-hash-cache-pattern | caching, hash, memoization | Content hash cache pattern |

---

## RESEARCH — Research & Analysis

Invoke for research, analysis, and intelligence gathering.

| Skill | Trigger | Description |
|-------|---------|-------------|
| deep-research | comprehensive research, analysis | Deep research methodology |
| market-research | market analysis, competitive | Market research patterns |
| research-ops | research operations, sourcing | Research operations |
| exa-search | Exa search, web research | Exa-powered search |
| search-first | search before implementing | Search-first pattern |
| codebase-onboarding | new codebase, understanding | Codebase onboarding |
| code-tour | code walkthrough, tour | Code tour guide |
| repo-scan | repository scanning, analysis | Repository scan |
| ito-market-intelligence | market intelligence, ITO | Market intelligence |
| ito-data-atlas-agent | data atlas, data discovery | Data atlas agent |
| ito-trade-planner | trade planning, strategy | Trade planner |
| ito-basket-compare | basket comparison, analysis | Basket comparison |
| prediction-market-oracle-research | prediction markets, oracle | Prediction market research |
| prediction-market-risk-review | prediction markets, risk | Prediction market risk review |
| investor-materials | investor docs, pitch deck | Investor materials |
| investor-outreach | investor communication | Investor outreach |
| lead-intelligence | lead scoring, intelligence | Lead intelligence |
| brand-voice | brand voice, tone, messaging | Brand voice patterns |
| article-writing | article writing, content | Article writing patterns |
| social-publisher | social media, publishing | Social media publishing |
| crosspost | cross-posting, multi-platform | Cross-posting patterns |
| content-engine | content creation, strategy | Content engine |
| seo | SEO, search optimization | SEO patterns |

---

## VIDEO & MEDIA

Invoke for video creation, editing, and media tasks.

| Skill | Trigger | Description |
|-------|---------|-------------|
| video-editing | video editing, post-production | Video editing patterns |
| manim-video | Manim, mathematical animation | Manim video creation |
| remotion-video-creation | Remotion, React video | Remotion video creation |
| videodb | VideoDB, video database | VideoDB patterns |
| fal-ai-media | fal.ai, media generation | fal.ai media generation |

---

## TESTING & QUALITY

Invoke for testing strategies and quality assurance.

| Skill | Trigger | Description |
|-------|---------|-------------|
| tdd-workflow | test-driven development, TDD | Test-driven development workflow |
| e2e-testing | end-to-end testing, Playwright | End-to-end testing patterns |
| ai-regression-testing | AI regression, model testing | AI regression testing |
| benchmark | benchmarking, performance | Benchmark patterns |
| benchmark-optimization-loop | benchmark optimization, iteration | Benchmark optimization loop |
| verification-loop | verification cycles, quality | Verification loop patterns |
| eval-harness | evaluation harness, scoring | Evaluation harness |
| skill-comply | skill compliance, measurement | Skill compliance measurement |
| santa-method | SANTA method, structured analysis | SANTA method for analysis |

---

## ARCHITECTURE & PATTERNS

Invoke for architectural decisions and design patterns.

| Skill | Trigger | Description |
|-------|---------|-------------|
| architecture-decision-records | ADR, architectural decisions | Architecture Decision Records |
| hexagonal-architecture | hexagonal, ports/adapters | Hexagonal architecture patterns |
| backend-patterns | backend architecture, APIs | Backend architecture patterns |
| error-handling | error handling, resilience | Error handling patterns |
| api-design | API design, REST, GraphQL | API design patterns |
| api-connector-builder | API connectors, integration | API connector building |
| hexagonal-architecture | ports, adapters, clean | Hexagonal architecture |
| latency-critical-systems | low latency, performance | Latency-critical system patterns |
| recursive-decision-ledger | decision tracking, audit | Recursive decision ledger |
| connections-optimizer | connection optimization, pooling | Connection optimization |
| parallel-execution-optimizer | parallelism, concurrency | Parallel execution optimization |
| mcp-server-patterns | MCP server, tool protocol | MCP server patterns |

---

## MARKETING & CONTENT

Invoke for marketing, content creation, and outreach.

| Skill | Trigger | Description |
|-------|---------|-------------|
| marketing-campaign | marketing, campaign, launch | Marketing campaign creation |
| content-engine | content creation, strategy | Content engine |
| brand-voice | brand, voice, tone | Brand voice patterns |
| article-writing | article, writing, blog | Article writing |
| social-publisher | social media, publishing | Social media publishing |
| crosspost | cross-post, multi-platform | Cross-posting |
| seo | SEO, optimization | SEO patterns |
| product-lens | product, features, positioning | Product lens analysis |
| product-capability | product capability, features | Product capability mapping |

---

## MISC & SPECIALIZED

| Skill | Trigger | Description |
|-------|---------|-------------|
| blueprint | project blueprint, scaffolding | Project blueprinting |
| codebase-onboarding | new codebase, onboarding | Codebase onboarding |
| code-tour | code walkthrough | Code tour |
| configure-ecc | ECC configuration | ECC configuration |
| documentation-lookup | docs, reference | Documentation lookup |
| git-workflow | git, branching, commit | Git workflow patterns |
| hookify-rules | hooks, rules conversion | Hook to rules conversion |
| plankton-code-quality | code quality, linting | Plankton code quality |
| prompt-optimizer | prompt optimization, LLM | Prompt optimization |
| rules-distill | rules distillation | Rules distillation |
| ralphinho-rfc-pipeline | RFC pipeline | RFC pipeline |
| skill-scout | skill discovery | Skill scouting |
| skill-stocktake | skill inventory | Skill stocktake |
| team-builder | team composition | Team building |
| tinystruct-patterns | tinystruct, micro | Tinystruct patterns |
| blender-motion-state-inspection | Blender, motion | Blender motion inspection |
| motion-foundations | motion, animation basics | Motion foundations |
| motion-advanced | advanced motion | Advanced motion |
| motion-patterns | motion, UI patterns | Motion patterns |
| motion-ui | motion, UI | Motion UI |
| compose-multiplatform-patterns | Compose Multiplatform | Compose Multiplatform patterns |
| foundation-models-on-device | on-device ML, models | On-device foundation models |
| nutrient-document-processing | document processing, PDF | Nutrient document processing |
| regex-vs-llm-structured-text | regex, LLM, parsing | Regex vs LLM for structured text |
| uncloud | cloud abstraction | Cloud abstraction |
| openclaw-persona-forge | persona, character, AI | OpenClaw persona forge |
| ck | CK patterns | CK patterns |
| iterative-retrieval | RAG, retrieval, iteration | Iterative retrieval |
| dashboard-builder | dashboard, metrics, visualization | Dashboard building |

---

## INVOCATION PROTOCOL

When the orchestrator receives a task, it MUST:

1. **Scan the trigger column** for keywords matching the task
2. **Select the top 3 most relevant skills** (no more)
3. **Load those skills** via lazy loading
4. **Delegate to the appropriate agent** with the skill context
5. **Never load more than 4 skills per sprint** (excluding always-execute and memory-preserve which are always active)

### Priority Order for Conflicting Skills

When multiple skills could apply:
1. Security skills override everything (safety first)
2. Core workflow skills override domain skills
3. Language-specific skills override general patterns
4. Domain skills override research skills
5. Research skills are always available as fallback