---
paths: always
---
<!-- Graph index — auto-generated from graph.json. Do not hand-edit. Run /graph-sync to refresh. -->
_Generated: 2026-07-13 | Modules: 32 | Structure: domain_

| Module | Domain | Detail File | Entry Point |
|---|---|---|---|
| icea-feature | icea | [icea/icea-feature.md](.claude/graph/icea/icea-feature.md) | skills/icea-feature/SKILL.md |
| icea-approve | icea | [icea/icea-approve.md](.claude/graph/icea/icea-approve.md) | skills/icea-approve/SKILL.md |
| icea-implement | icea | [icea/icea-implement.md](.claude/graph/icea/icea-implement.md) | skills/icea-implement/SKILL.md |
| icea-review | icea | [icea/icea-review.md](.claude/graph/icea/icea-review.md) | skills/icea-review/SKILL.md |
| icea-revise | icea | [icea/icea-revise.md](.claude/graph/icea/icea-revise.md) | skills/icea-revise/SKILL.md |
| icea-status | icea | [icea/icea-status.md](.claude/graph/icea/icea-status.md) | skills/icea-status/SKILL.md |
| ado-tasks | icea | [icea/ado-tasks.md](.claude/graph/icea/ado-tasks.md) | skills/ado-tasks/SKILL.md |
| critic | icea | [icea/critic.md](.claude/graph/icea/critic.md) | skills/critic/SKILL.md |
| architect | setup | [setup/architect.md](.claude/graph/setup/architect.md) | skills/architect/SKILL.md |
| setup-status | setup | [setup/setup-status.md](.claude/graph/setup/setup-status.md) | skills/setup-status/SKILL.md |
| setup-sync | setup | [setup/setup-sync.md](.claude/graph/setup/setup-sync.md) | skills/setup-sync/SKILL.md |
| setup-teardown | setup | [setup/setup-teardown.md](.claude/graph/setup/setup-teardown.md) | skills/setup-teardown/SKILL.md |
| scripts | setup | [setup/scripts.md](.claude/graph/setup/scripts.md) | scripts/setup-init-bootstrap.cjs |
| project-deploy | setup | [setup/project-deploy.md](.claude/graph/setup/project-deploy.md) | _project-deploy/hooks |
| code-review | quality | [quality/code-review.md](.claude/graph/quality/code-review.md) | skills/code-review/SKILL.md |
| security | quality | [quality/security.md](.claude/graph/quality/security.md) | skills/security/SKILL.md |
| dynamic-scan | quality | [quality/dynamic-scan.md](.claude/graph/quality/dynamic-scan.md) | skills/dynamic-scan/SKILL.md |
| dream-rollback | quality | [quality/dream-rollback.md](.claude/graph/quality/dream-rollback.md) | skills/dream-rollback/SKILL.md |
| graph-sync | graph | [graph/graph-sync.md](.claude/graph/graph/graph-sync.md) | skills/graph-sync/SKILL.md |
| graph-viz | graph | [graph/graph-viz.md](.claude/graph/graph/graph-viz.md) | skills/graph-viz/SKILL.md |
| pr-create | pr-ado | [pr-ado/pr-create.md](.claude/graph/pr-ado/pr-create.md) | skills/pr-create/SKILL.md |
| pr-describe | pr-ado | [pr-ado/pr-describe.md](.claude/graph/pr-ado/pr-describe.md) | skills/pr-describe/SKILL.md |
| pr-spec-review | pr-ado | [pr-ado/pr-spec-review.md](.claude/graph/pr-ado/pr-spec-review.md) | skills/pr-spec-review/SKILL.md |
| sprint-metrics | pr-ado | [pr-ado/sprint-metrics.md](.claude/graph/pr-ado/sprint-metrics.md) | skills/sprint-metrics/SKILL.md |
| plugin-readiness | observability | [observability/plugin-readiness.md](.claude/graph/observability/plugin-readiness.md) | skills/plugin-readiness/SKILL.md |
| app-readiness | observability | [observability/app-readiness.md](.claude/graph/observability/app-readiness.md) | skills/app-readiness/SKILL.md |
| token-analysis | observability | [observability/token-analysis.md](.claude/graph/observability/token-analysis.md) | skills/token-analysis/SKILL.md |
| shared | platform | [platform/shared.md](.claude/graph/platform/shared.md) | skills/shared |
| commands | platform | [platform/commands.md](.claude/graph/platform/commands.md) | commands |
| rules | platform | [platform/rules.md](.claude/graph/platform/rules.md) | rules |
| tests | platform | [platform/tests.md](.claude/graph/platform/tests.md) | tests/validate.js |
| docs-adr | platform | [platform/docs-adr.md](.claude/graph/platform/docs-adr.md) | docs/adr |

## Module Summaries

**icea-feature** — Drafts ICEA (Intent/Context/Examples/Acceptance) documents before any feature code is written; not source code generation. Key files: `skills/icea-feature/SKILL.md`
**icea-approve** — Approves an ICEA and Tech Spec for a given ADO ID. Key files: `skills/icea-approve/SKILL.md`
**icea-implement** — Generates implementation code for an approved ICEA. Key files: `skills/icea-implement/SKILL.md`
**icea-review** — Reviews a PR or code diff against an approved ICEA. Key files: `skills/icea-review/SKILL.md`
**icea-revise** — Revises an existing ICEA and Tech Spec in response to feedback. Key files: `skills/icea-revise/SKILL.md`
**icea-status** — Shows current state of all ICEA files for an ADO ID: ICEA status, Tech Spec open questions, tracker progress, open bugs, and next action. Key files: `skills/icea-status/SKILL.md`
**ado-tasks** — Generates a complete Azure DevOps task breakdown from an approved ICEA. Key files: `skills/ado-tasks/SKILL.md`
**critic** — Second-pass critic that stress-tests a drafted ICEA before the approval gate. Key files: `skills/critic/SKILL.md`
**architect** — Detects repo type, runs Bootstrap Phase 2, populates 8 architecture docs, generates the initial knowledge graph. Key files: `skills/architect/SKILL.md`, `skills/architect/prompts/`
**setup-status** — Green/amber/red health check for all plugin infrastructure: CLAUDE.md, memory, rules, commands, hooks, architecture docs, knowledge graph, file-cache, token-graph, gitignore coverage, plugin version drift. Key files: `skills/setup-status/SKILL.md`
**setup-sync** — Re-provisions a target project after a plugin upgrade. Key files: `skills/setup-sync/SKILL.md`
**setup-teardown** — Removes plugin-managed content from a target project by scope (--full, --skills, --hooks, --rules, --commands, --state). Key files: `skills/setup-teardown/SKILL.md`
**scripts** — Node.js CJS scripts that handle all mechanical plugin work: bootstrapping, graph edge extraction, plugin state. Key files: `scripts/setup-init-bootstrap.cjs`, `scripts/graph-extract-edges.js`
**project-deploy** — Canonical deploy sources for all hook files and the gitignore base used in target projects. Key files: `_project-deploy/hooks/icea-floor.sh`
**code-review** — Coverity-style static analysis with persistent finding tracking across sessions. Key files: `skills/code-review/SKILL.md`
**security** — OWASP/CWE security scan with a persistent ledger of findings. Key files: `skills/security/SKILL.md`
**dynamic-scan** — DAST scan against a running web app/API using OWASP ZAP via Docker. Key files: `skills/dynamic-scan/SKILL.md`
**dream-rollback** — Reverses a specific Dream consolidation run using the audit trail in memory/dream-log.md. Key files: `skills/dream-rollback/SKILL.md`
**graph-sync** — Incremental knowledge graph refresh: detects fingerprint changes and regenerates stale module detail files and the index. Key files: `skills/graph-sync/SKILL.md`
**graph-viz** — Renders the knowledge graph as a self-contained offline HTML file at .claude/graph/graph.html; read-only consumer of graph.json. Key files: `skills/graph-viz/SKILL.md`
**pr-create** — Creates a Pull Request in Azure DevOps via REST API, or saves a draft artifact for manual submission. Key files: `skills/pr-create/SKILL.md`
**pr-describe** — Generates a complete, ICEA-compliant pull request description from git diff. Key files: `skills/pr-describe/SKILL.md`
**pr-spec-review** — Reviews a PR against a functional specification or ICEA. Key files: `skills/pr-spec-review/SKILL.md`
**sprint-metrics** — Measures three post-sprint KPIs via ADO REST API: ICEA compliance rate, PR rejection rate, rework hours. Key files: `skills/sprint-metrics/SKILL.md`
**plugin-readiness** — Plugin production readiness assessment across 8 dimensions (architecture, graph, rules, hooks, tests, memory). Key files: `skills/plugin-readiness/SKILL.md`
**app-readiness** — Application production readiness assessment from an Enterprise/Solution Architect perspective. Key files: `skills/app-readiness/SKILL.md`
**token-analysis** — Analyses token consumption across recent Claude Code sessions and identifies high-cost patterns. Key files: `skills/token-analysis/SKILL.md`
**shared** — Shared specification files (schemas, model routing, personas, consent gates, write-gate spec) consumed by all skills; not a runtime module. Key files: `skills/shared/graph-json-schema.md`, `skills/shared/graph-index-schema.md`
**commands** — 37 command stub .md files that make plugin commands visible in VS Code and the Claude Code slash-command palette. Key files: `commands/setup-init.md`, `commands/setup-sync.md`
**rules** — Rule files deployed to .claude/rules/ in target projects by Bootstrap Phase 2; enforced on every file edit. Key files: `rules/project-rules.md`
**tests** — Plugin test suite; validate.js enforces structural contracts on all plugin files and must stay at 259✓/0✗. Key files: `tests/validate.js`
**docs-adr** — Append-only Architecture Decision Records for non-obvious plugin design choices. Key files: `docs/adr`
