# 0055 — External repo stacks are stored in a separate `external_detected_stacks` field, not merged into `detected_stacks`
Status: Accepted · Date: 2026-07-15
Governs: `dream-init-state.json`, `scripts/external-stack-detection.cjs`,
`skills/icea-feature/SKILL.md`, `commands/setup-init.md`, `skills/setup-sync/SKILL.md`,
`commands/sync-dirs.md`
Relates to: [[0046-dream-init-bootstrap-pattern]], [[0054-plugin-path-runtime-resolution]]

## Problem

Multi-repo projects — a common K&E pattern where an Angular + Node.js frontend repo
depends on a separate .NET API repo — caused incorrect Tech Spec overlay selection.

`detected_stacks` only captured stacks from the **primary repo** (the one `setup-init`
ran in). A KE.Web project with `detected_stacks: ["angular", "nodejs"]` would fall to
"unknown" in the `icea-feature` overlay table because there was no row for that combination
without `dotnet`. The .NET API in `additionalDirectories` was invisible to overlay selection.

Two consumers of `detected_stacks` have opposing requirements:

| Consumer | Needs | Why |
|---|---|---|
| Rules deployment (`setup-init` Phase 2) | **Primary repo only** | Do not deploy `.NET rules` to an Angular project just because a .NET API is in additionalDirectories |
| Overlay selection (`icea-feature` Step 8) | **Full combined picture** | A Tech Spec for KE.Web must include Angular, Node.js, AND .NET sections if the project calls a .NET API |

Merging external stacks into `detected_stacks` satisfies the second consumer but breaks
the first — a single field cannot carry both semantics simultaneously.

## Decision

Add a **second field** `external_detected_stacks: string[]` to `dream-init-state.json`
alongside the existing `detected_stacks`.

- `detected_stacks` — unchanged; primary repo only; drives rules deployment exclusively.
- `external_detected_stacks` — new; populated from `additionalDirectories` repos by
  `scripts/external-stack-detection.cjs`; used only for overlay selection.

Overlay selection in `icea-feature` Step 8 computes:
```javascript
const all = [...new Set([...(s.detected_stacks||[]), ...(s.external_detected_stacks||[])])];
```
and selects an overlay from `all_stacks`. Rules deployment ignores `external_detected_stacks`
entirely.

A third field `external_stacks_prompted: boolean` (default `false`) ensures the interactive
question (asking the developer for external repo paths) is shown at most once across all
setup-init and setup-sync runs.

### Detection script

`scripts/external-stack-detection.cjs` is a **zero-dependency** standalone script (`fs`
and `path` built-ins only). It cannot `require('glob')` or any third-party package because
it executes from the plugin cache, which has no `node_modules/`. A small recursive walker
replaces glob. The script is the single canonical writer of `external_detected_stacks` and
is called from setup-init (Step 2d), setup-sync (Step 5b), and sync-dirs.

### Stack token rules

`dotnet` and `dotnet_framework` are **mutually exclusive** tokens:
- `dotnet` — modern .NET Core / .NET 5+ / .NET 10
- `dotnet_framework` — legacy .NET Framework 4.x, detected by `System.Web` (MVC/WebForms)
  or `System.ServiceModel` (WCF) reference in any `.csproj` file

A project receives one or the other; never both. This matches the token semantics already
established for `detected_stacks` (see bootstrap STACK_SIGNALS map).

### Overlay selection table changes

Three overlay rows were added or corrected in `icea-feature` Step 8:
- `dotnet`/`dotnet_framework` + `angular`, no `nodejs` → `techspec-aspnet-api-angular.md` (new, removes *(future)* marker)
- `angular` + `nodejs` (with or without `dotnet`/`dotnet_framework`) → `techspec-angular-nodejs.md` (new)
- `angular` only → base only (documented known gap — no SPA-only overlay)

The `dotnet-framework` token in the old table (hyphen) was corrected to `dotnet_framework`
(underscore) to match the actual values written by the bootstrap's STACK_SIGNALS map.

## Rejected alternatives

**A) Merge external stacks into `detected_stacks`.**
Rejected: rules deployment would receive `.NET rules`, `.java-rules`, etc. for every external
dependency regardless of what language the primary repo is written in. A pure Angular project
would get C# Dapper/EF rules deployed just because it calls a .NET API.

**B) Keep a single field but add a separate `primary_stacks` field for rules deployment.**
Rejected: inverts the naming convention — `detected_stacks` is the established field name
read by many existing consumers. Renaming or adding an alias would require touching all
those consumers without reducing complexity.

**C) Extend the overlay selection bash block to scan `additionalDirectories` directly at
runtime without a pre-computed field.**
Rejected: scanning external repo directories at ICEA draft time is expensive and slow;
the directories may contain large codebases. Pre-computed detection at setup/sync time
keeps the icea-feature skill Category C (no source scans) and fast at invocation time.

**D) Ask for external repo paths every time setup-init or setup-sync runs.**
Rejected: `setup-init` is documented as safe to re-run and `setup-sync` applies migrations
idempotently. Repeated prompts degrade the experience for experienced developers who have
already answered. The `external_stacks_prompted` flag suppresses the question after the
first answer (whether the developer provided paths or skipped).

## Consequences

- `dream-init-state.json` gains two new fields: `external_detected_stacks: []` and
  `external_stacks_prompted: false`. Migration 024 seeds them in existing projects.
- `setup-init` Step 2d and `setup-sync` Step 5b add interactive questions (guarded by
  `external_stacks_prompted`) and call `external-stack-detection.cjs`.
- `commands/sync-dirs.md` re-runs detection after every `additionalDirectories` update,
  keeping the field current without a full sync cycle.
- Two new Tech Spec overlays ship: `techspec-aspnet-api-angular.md` and
  `techspec-angular-nodejs.md`. Overlay files are plugin reference files (accessed via
  `$PLUGIN_DIR`), not deployed to target projects — `.claude/skills/.hashes` is unaffected.
- The `angular-only` case (no `nodejs`, no `dotnet`) produces base-template-only output.
  This is a documented known gap; the developer can add an external repo path via `/sync-dirs`
  if the API is a detectable .NET/Java/Python/Node.js project.
