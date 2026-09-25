# Architecture — Reference

> Load this file only for npm dependency version checks, dependency upgrades,
> or fan-out analysis during refactoring.

## Dependency Versions (package.json)

| Package | Version | Role |
|---|---|---|
| c8 | ^10.1.2 | Code coverage via NODE_V8_COVERAGE (dev) |
| jest | ^29.7.0 | Test framework (dev) |
| jest-junit | ^16.0.0 | JUnit XML reporter for ADO pipeline (dev) |
| pptxgenjs | ^4.0.1 | PPTX generation for story slides (dev) |

> ⚠ No runtime npm dependencies — the plugin uses Node.js stdlib only at runtime.

## CI/CD Pipelines

| File | Trigger | Purpose |
|---|---|---|
| `azure-pipelines.yml` | push main/dev, PR to main/dev | CI: structural validator + Jest + coverage + npm audit |
| `azure-pipelines.yml` | tag push `v*` | ReleaseValidation: same + version consistency + tag/plugin.json match |

## Most-Imported Internal Modules

| Module | Imported by |
|---|---|
| `scripts/stack-signals.cjs` | `repo-detect.cjs`, `setup-init-bootstrap.cjs`, `external-stack-detection.cjs` |
| `scripts/audit-write.cjs` | `icea-approve`, `icea-implement`, `upgrade-orchestrate.cjs`, `governance-report.cjs` |
| `scripts/checkpoint-ledger.cjs` | `upgrade-checkpoint.cjs`, `intake-verify.cjs`, `strategy-resolve.cjs` |
| `scripts/lib/source-classifier.cjs` | `code-review`, `security`, `explain` skills |
| `skills/shared/plugin-path-resolution.md` | Referenced by nearly every SKILL.md |
| `skills/shared/write-gate-spec.md` | `icea-implement`, `upgrade`, `rewrite`, `replatform` skills |
| `skills/shared/migration-ledger-schema.md` | `upgrade`, `rewrite`, `replatform` skills |

## Largest Modules (by complexity)

| Module | Approximate size | Content |
|---|---|---|
| `scripts/setup-init-bootstrap.cjs` | ~900 lines | All mechanical provisioning logic |
| `scripts/graph-extract-edges.js` | ~400 lines | Import parsing + edge extraction |
| `scripts/upgrade-orchestrate.cjs` | ~350 lines | Multi-hop upgrade orchestration |
| `scripts/repo-detect.cjs` | ~300 lines | 12-type detection ladder |
| `skills/architect/SKILL.md` | ~1200 lines | Full architect skill instructions |
| `skills/icea-feature/SKILL.md` | ~600 lines | ICEA planning gate |
| `skills/rewrite/SKILL.md` | ~800 lines | Out-of-place migration skill |
