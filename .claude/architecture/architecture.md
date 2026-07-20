# Architecture — ai-assisted-development Plugin

_Generated: 2026-07-13 | Stack: Node.js (CJS) · Markdown skills · Claude Code Plugin_

## Overview

A Claude Code plugin that enforces an ICEA-driven development workflow for distributed teams using
Azure DevOps. Language-agnostic: supports .NET 8, ASP.NET Framework 4.x, Java/Spring Boot,
Python (FastAPI/Django/Flask), Node.js, Angular 17+, and React.

The plugin is not a deployed web service — it runs entirely within the Claude Code process on a
developer's local machine. It installs into `~/.claude/plugins/cache/`.

## Technology Stack

| Item | Value |
|---|---|
| Runtime | Node.js (CJS scripts, no build step) |
| Plugin format | Claude Code Plugin v1 — markdown skill files + YAML frontmatter |
| Package name | `ai-assisted-development` |
| Version | 3.12.0 |
| External integrations | Azure DevOps REST API · OWASP ZAP (Docker) |
| Test runner | `tests/validate.js` (offline) · `tests/runner.js` (requires API+network) |
| CI/CD | None — manual publish to KirklandAndEllis marketplace |

## Public API Surface (Commands)

The plugin exposes 37 slash commands, grouped by function:

**ICEA Workflow** — `/icea-feature`, `/icea-approve`, `/icea-implement`, `/icea-review`,
`/icea-revise`, `/icea-status`

**Code Quality** — `/code-review`, `/security-review`, `/dynamic-scan`, `/critic`, `/fix`,
`/dismiss`, `/checkin`

**Setup & Memory** — `/setup-init`, `/setup-sync`, `/setup-status`, `/setup-teardown`,
`/dream`, `/dream-health`, `/dream-audit`, `/dream-rollback`, `/session-start`

**Architecture & Graph** — `/update-arch`, `/graph-sync`, `/graph-viz`

**PR & ADO** — `/pr-describe`, `/pr-create`, `/pr-spec-review`, `/ado-tasks`, `/sprint-metrics`

**Other** — `/bug`, `/explain`, `/gitignore-sync`, `/sync-dirs`, `/token-analysis`,
`/app-readiness`, `/plugin-readiness`, `/product-docs`

## Folder Structure

| Folder | Purpose |
|---|---|
| `skills/` | 26 skill SKILL.md files — loaded on invocation |
| `skills/shared/` | Shared specs (graph schema, model routing, consent gate, etc.) |
| `skills/architect/` | Architect skill + per-stack prompts + architecture templates |
| `scripts/` | Node.js CJS scripts (bootstrap, graph-extract-edges, plugin-state, etc.) |
| `commands/` | 37 command stub `.md` files deployed to `.claude/commands/` in target projects |
| `rules/` | Rule files deployed to `.claude/rules/` by Bootstrap Phase 2 |
| `_project-deploy/` | Hook source files and gitignore base — canonical deploy sources |
| `docs/adr/` | Architecture Decision Records (ADR 0001–0053+) |
| `docs/migrations/` | Per-version migration notes applied by `/setup-sync` |
| `tests/` | `validate.js` (offline gate, 259 checks), `runner.js` (API+network) |
| `.claude-plugin/` | `plugin.json` — authoritative plugin metadata |

## End-to-End Architecture

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    DEV[Developer] -->|slash command| CC[Claude Code Process]
    CC -->|loads| SK[skills SKILL.md]
    CC -->|reads| GRAPH[.claude/graph/graph.json]
    CC -->|reads| ARCH[.claude/architecture]
    CC -->|writes| MEMORY[memory/MEMORY.md]
    CC -->|REST| ADO[Azure DevOps API]
    CC -->|Docker| ZAP[OWASP ZAP]
    SK -->|runs| BOOT[setup-init-bootstrap.cjs]
    BOOT -->|deploys to| TARGET[target project .claude/]
    style DEV fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style CC fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style SK fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style GRAPH fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style ARCH fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style MEMORY fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style ADO fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
    style ZAP fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
    style BOOT fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style TARGET fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px

```

</div>

## Layered View

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart TB
    CMD[commands .claude/commands] --> SKILL[skills SKILL.md]
    SKILL --> SCRIPTS[scripts CJS]
    SKILL --> RULES[rules .claude/rules]
    SKILL --> SHARED[skills/shared specs]
    SCRIPTS --> META[.claude-plugin/plugin.json]
    SHARED --> GRAPH2[.claude/graph]
    SHARED --> ARCHDOCS[.claude/architecture]
    SKILL --> ADO2[Azure DevOps REST API]
    SKILL --> ZAP2[OWASP ZAP Docker]
    style CMD fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style SKILL fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style SCRIPTS fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style RULES fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style SHARED fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style META fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style GRAPH2 fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style ARCHDOCS fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style ADO2 fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
    style ZAP2 fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px

```
</div>