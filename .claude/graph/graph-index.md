---
paths: always
---

Generated: 2026-09-23 | Modules: 8 | Structure: flat

## Module Index

| Module | Domain | Detail File | Entry Point |
|---|---|---|---|
| _project-deploy | deployment | [graph/_project-deploy.md](_project-deploy.md) | _project-deploy/CLAUDE.md |
| contest | presentation | [graph/contest.md](contest.md) | — |
| docs | documentation | [graph/docs.md](docs.md) | — |
| guides | documentation | [graph/guides.md](guides.md) | — |
| scripts ⭐ | orchestration | [graph/scripts.md](scripts.md) | scripts/setup-init-bootstrap.cjs |
| skills ⭐ | orchestration | [graph/skills.md](skills.md) | skills/setup-init/SKILL.md |
| tests | testing | [graph/tests.md](tests.md) | tests/jest.suite.test.cjs |
| tools | tooling | [graph/tools.md](tools.md) | — |

⭐ = hub module (high dependency degree)

## Module Summaries

**_project-deploy** — Deployment template files copied by setup-init-bootstrap into target projects during provisioning. Key file: `_project-deploy/CLAUDE.md`

**contest** — Presentation/contest assets for the plugin. Key file: ⚠ not determined

**docs** — Plugin developer documentation: ADRs, migration guides, DEVELOPER-GUIDE.md. Key file: `docs/adr/`

**guides** — Developer and end-user guides for the plugin. Key file: ⚠ not determined

**scripts** — Node.js utility scripts performing all deterministic mechanical work (provisioning, detection, graph generation, migration, upgrade). Key file: `scripts/setup-init-bootstrap.cjs`

**skills** — Markdown SKILL.md instruction files executed by Claude at runtime; `skills/shared/` holds cross-skill specifications. Key file: `skills/setup-init/SKILL.md`

**tests** — Jest-based test suite; raw `.test.cjs` files are spawned as subprocesses by `jest.suite.test.cjs`. Key file: `tests/jest.suite.test.cjs`

**tools** — Tooling utilities for the plugin development environment. Key file: ⚠ not determined
