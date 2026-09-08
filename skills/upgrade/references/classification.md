# Upgrade — Classification & Version-Path Planning (Workstream A + B)

> Loaded by `skills/upgrade/SKILL.md` Step 1. The deterministic logic lives in
> `scripts/upgrade-classify.cjs`; this reference explains the taxonomy it encodes so a reviewer can
> audit the routing decisions. Design of record: `docs/plans/migrationSkill/upgrade.md` §A–§B.

## Why classification is the highest-risk component

Half of what people call "upgrades" are actually out-of-place rewrites that cross a runtime boundary.
Running them through an in-place tool corrupts a working application. The classifier is therefore
**falsifiable and tested** — it must reject every false-upgrade before a single edit.

## False-upgrade taxonomy (→ route to Rewrite, exit 3)

| From | To | Why it is NOT an in-place upgrade |
|---|---|---|
| `.NET Framework` (`dotnet_framework`) | `.NET` (`dotnet`, Core/5+) | Different runtime + BCL; `System.Web`/WCF have no in-place path |
| `AngularJS` (Angular 1.x) | `Angular` (2+) | Complete framework rewrite; no schematic upgrade path |
| `Python 2.x` | `Python 3.x` | Language-level breaking changes; not a version bump |
| `WebForms` | `Blazor` / MVC | Different programming model; out-of-place |

Encoded two ways in the classifier:
- **Cross-stack transition** (`--to-stack` differs): e.g. `--stack=dotnet_framework --to-stack=dotnet`.
- **Within-stack version boundary**: `python` from major `2`; `angular` from major `1` (AngularJS).

Explicit legacy tokens (`angularjs`, `webforms`) passed as `--stack` are also treated as false-upgrade
sources.

## Supported in-place stacks (→ `upgrade`, exit 0)

`dotnet` (Core→Core) · `angular` (2+) · `java` · `python` (3.x→3.x) · `nodejs` · `react`.
An unrecognised stack → `unsupported` (exit 4). A target ≤ current → `invalid` (exit 5).

## Tool selection & coverage (feeds the Gap/Risk report — increment 3)

| Stack | Deterministic tool | Coverage | LLM residual load |
|---|---|---|---|
| `dotnet` | `dotnet upgrade-assistant` | Good | Low–Med |
| `angular` | `ng update` (schematics) | Excellent | Low |
| `java` | OpenRewrite (recipes) | Good (recipe-dependent) | Med |
| `python` | `pyupgrade` / `ruff` | Modest (syntax, not deps) | Med–High |
| `nodejs` | `npm-check-updates` | Weak (bumps versions, not code) | High |

## Multi-hop version-path planning (Workstream B)

Large jumps are sequenced so each hop is a bisectable commit:

| Stack | Hop strategy | Example |
|---|---|---|
| `java` | LTS ladder `8 → 11 → 17 → 21` | 8→21 ⇒ `[11, 17, 21]` |
| `angular` | one major at a time | 15→17 ⇒ `[16, 17]` |
| `nodejs` | even (LTS) majors | 18→22 ⇒ `[20, 22]` |
| `dotnet` | each major (bisectable) | 6→8 ⇒ `[7, 8]` |
| `python` | 3.x minor steps | 3.8→3.11 ⇒ `[3.9, 3.10, 3.11]` |
| `react` | each major | 17→18 ⇒ `[18]` |

The planned hop sequence is emitted into the report **before** any execution.
