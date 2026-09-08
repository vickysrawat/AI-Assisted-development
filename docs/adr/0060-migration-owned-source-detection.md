# 0060 — Migration-owned, stack-neutral source detection (lean wrapper)
Status: Accepted · Date: 2026-09-05
Governs: `scripts/migration-source-detect.cjs` (new) · `skills/migration/steps/stage-0.md` · `skills/shared/checkpoint-schema.md` · `scripts/repo-detect.cjs` (seam comment)

> **Builds on ADR 0059** (scored stack-key detection) — reuses `repo-detect.cjs --json` as the
> detection engine rather than duplicating it.

## Problem

The `migration` skill's Stage 0 detected the **source** application through scattered inline
`node -e` blocks and ad-hoc `grep`/`find`, leaning on the plugin's **brownfield** detection state
(`dream-init-state.json`, `graph.json`) with a `repo-detect.cjs --root=<src> --json` fallback. The
logic was **.NET-centric** — the only structured signal consumed was `generations.dotnet`;
non-.NET sources got coarse treatment; even the checkpoint field `mode.source_version` was
documented as a ".NET version".

Brownfield detection and migration source detection are **different bounded contexts**: the former
answers "what IS *this* repo so I can safely change it?" (coarse, repo-rooted, long-lived project
state); the latter "what behavior/constructs must survive into a *new target*?" — needing a
**stack-neutral, multi-root** (repo **and** `additionalDirectories`) scan scoped to one migration
run. Coupling migration's source understanding to the brownfield pipeline made it .NET-biased and
hard to extend to Node/Java/Python sources.

## Decision

**Migration owns a single, consolidated, stack-neutral source-detection module that owns the
interface and the migration-specific signals, and *wraps* `repo-detect.cjs` for stack/version.**

1. **New module `scripts/migration-source-detect.cjs`** — `--roots=<path>[,<path>...] [--json]`.
   For each root it invokes `repo-detect.cjs --root=<root> --json` (engine borrowed, interface
   owned) and consolidates the previously-inline Stage-0 signals into one normalized, stack-neutral
   **source descriptor**: `{ roots[], primary:{token,version}, stacks:[{token,role,version,
   generation,projectPath}], dataLayer, auth[], integrations[], sizeEstimate, graphPresent,
   archDocsPresent }`. Read-only w.r.t. the source; opportunistically reads a source's
   `dream-init-state.json`/`graph.json` as a fast path but never requires and never writes them.
2. **Stack-neutral by construction** — dotnet / dotnet_framework / java / nodejs / python /
   angular / react are equal citizens; `.NET`'s `generations.dotnet`/Web.config extraction is one
   *case*, not the primary path. Preserves the ground-truth integration extraction added by the
   integration-verification hardening plan (Web.config `<serviceModel>`/`<connectionStrings>`/
   referenced-assembly evidence) as the `.NET` case of the stack-neutral `integrations[]` signal.
3. **Multi-root, cross-repo** — a source may span the current repo and `additionalDirectories`
   (external re-platform); the module scans all provided roots and merges.
4. **Stage 0 rewired** to resolve the source roots and call the module in place of the inline
   detection blocks, keeping the SOURCE_PATH registration, the analysis display, and the tool
   pre-check.
5. **`.cjs`, flat in `scripts/`** — covered by the existing `scripts/*.cjs` permission allow; no
   permission wiring or cleanup.

## Consequences

- Migration source detection is stack-agnostic and testable in isolation; adding a source stack is
  contained (extend the module + reference files), not a stage-0 surgery.
- `mode.source_token`/`mode.source_version` become stack-neutral (any stack), kept comparable for
  Q1b (`target ≥ source`) and Stage-2 posture.
- The module *calls* `repo-detect`, so it inherits ADR 0059's detection quality and stays in sync
  with engine fixes (shared-fate accepted for the interim; managed by owning the interface + tests).

## Alternatives rejected

- **Full self-contained fork** (no `repo-detect` dependency) — premature: its only live
  justification is plugin-independent (standalone) migration deployment, which is **deferred**.
  Forking now duplicates a mature engine for a deferred benefit (YAGNI). Revisit with the
  standalone plan.
- **Keep detection inline in stage-0.md** — scattered, .NET-biased, untestable; the status quo.
- **A new topology field in `dream-init-state.json`** — a second topology store competing with the
  brownfield pipeline; migration's source picture must be run-scoped, not persisted project state.
- **A `scripts/migration/` subfolder** — deferred with the standalone plan; would require
  broadening the non-recursive `scripts/*.cjs` permission glob for no present benefit.
