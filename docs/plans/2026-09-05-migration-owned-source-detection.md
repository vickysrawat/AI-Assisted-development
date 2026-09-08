# Plan — Migration-owned, stack-neutral source detection (lean interim)

> **Status:** 📋 Not Implemented
> **Status lifecycle:** `📋 Not Implemented` → `🚧 In progress` → `✅ Implemented` (update this line).
> **Author context:** AI-architect brainstorm session, 2026-09-05.
> **Ephemeral plan mirror:** `~/.claude/plans/prancy-nibbling-raven.md`.
> **Companion ADR:** `docs/adr/0060-migration-owned-source-detection.md` (to be written with this work).

---

## 1. Context

The `migration` skill's Stage 0 detects the **source** application via scattered inline `node -e`
blocks and ad-hoc `grep`/`find`, leaning on the plugin's **brownfield** detection pipeline
(`dream-init-state.json`, `graph.json`, `repo-detect.cjs --root=<src>`;
[stage-0.md:105-200](../../skills/migration/steps/stage-0.md#L105-L200)). It is **.NET-centric** —
the only structured signal is `generations.dotnet`; non-.NET sources get coarse treatment; even
`mode.source_version` is documented as a ".NET version".

Brownfield detection and migration source detection are **different bounded contexts**: the former
answers "what IS *this* repo so I can safely change it?"; the latter "what behavior/constructs must
survive into a *new target*?" — which needs a **stack-neutral, multi-root** (repo **and**
`additionalDirectories`) scan scoped to one migration run.

This plan gives migration its **own consolidated, stack-neutral source-detection module** that owns
the interface/shaping/multi-root scan and the migration-specific signals, and **calls
`repo-detect.cjs` internally** for stack/version (formalizing today's ad-hoc seam). It consolidates
the scattered inline detection into one testable module and removes the .NET-centrism.

## 2. Scope

**In scope (this plan):** the detection module + Stage-0 rewire + small stack-neutral adjustments +
tests + ADR.

**Out of scope — deferred (do NOT build here):** a full self-contained *fork* with no
`repo-detect` dependency, a dedicated `scripts/migration/` folder, migration-owned permission
wiring, and Stage-6 cleanup — these belong to the future **plugin-independent-deployment** plan (a
fork's only live justification is standalone deployment, which is deferred). Also deferred: full
Stage-2 posture generalization (a one-line 2.0b tweak is included); the `--area backend/frontend`
tier redesign (parked, separate skill).

## 3. Implementation

### 3.1 New module — `scripts/migration-source-detect.cjs` (flat, plugin convention)
- **Signature:** `node scripts/migration-source-detect.cjs --roots=<path>[,<path>...] [--json]`.
- **Owns:** interface, output shape, multi-root scan, and migration-specific signals; **calls
  `repo-detect.cjs` internally** per root for stack/version (interface owned by migration, engine
  borrowed). Stack-neutral — dotnet / dotnet_framework / java / nodejs / python / angular / react
  as equal citizens.
- **Fixed fidelity target (no scope creep — do not re-implement `stack-signals`):**
  ```
  { roots[], primary:{token,version}, stacks:[{token,role,version,generation,projectPath}],
    dataLayer, auth[], integrations[], sizeEstimate, graphPresent, archDocsPresent }
  ```
  Consolidates today's inline Stage-0 detection (~105-200): stack+version (generalizing the
  `.NET`-only `generations.dotnet` read to per-stack version), data layer, auth patterns,
  external-integration ground truth, size estimate.
- **Flat in `scripts/`** — covered by the existing `scripts/*.cjs` permission allow, so **no
  permission wiring and no Stage-6 cleanup** (both were folder-driven; folder is deferred).
- Committed `.cjs` (avoids the OneDrive `node -e` segfault); `fs`/`path` (+ `child_process` for the
  tool pre-check and to invoke `repo-detect`); 5-point script-transparency header
  (`.claude/rules/project-rules.md`). Read-only w.r.t. the source; opportunistically reads source
  plugin-state as a fast path but never requires and never writes it.

### 3.2 Rewire Stage 0 ([stage-0.md](../../skills/migration/steps/stage-0.md))
- Add an **owned source-root resolution step**: decide where the source is (current repo for an
  upgrade; `additionalDirectories` for external re-platform), producing `--roots`.
- Replace the **detection** blocks (~105-200) with a single call to the module.
- **Keep** the `SOURCE_PATH` additionalDirectory registration (lines 50-60), the "SOURCE
  APPLICATION ANALYSIS" display, and the tool pre-check. **No permission wiring added.**

### 3.3 Small, on-theme adjustments
- [checkpoint-schema.md](../../skills/shared/checkpoint-schema.md) — stack-neutral wording for
  `mode.source_token` / `mode.source_version` ("source primary version string, **any stack**; must
  stay comparable for Q1b `target ≥ source` and Stage-2 posture"), not ".NET version"; optional
  `mode.source_roots[]` for multi-root provenance. No breaking change.
- [stage-2-feasibility.md:65-76](../../skills/migration/steps/stage-2-feasibility.md#L65-L76) —
  tiny 2.0b tweak (*separate concern — feasibility, not detection*): add an explicit stack-neutral
  posture rule — *"source ≠ target → **Re-platform** via `{source}-{target}.md`; same stack, newer
  version → **Upgrade**"* — keeping the .NET rows as the worked example.
- [repo-detect.cjs:289](../../scripts/repo-detect.cjs#L289) — **formalize** (do not retire) the
  migration-source seam: update the comment to name `migration-source-detect.cjs` as the owning
  caller.

## 4. Files to change

| File | Change |
|---|---|
| `scripts/migration-source-detect.cjs` **(new)** | Owned, stack-neutral, multi-root detection module wrapping `repo-detect`; flat in `scripts/` |
| `skills/migration/steps/stage-0.md` | Add source-root resolution; replace detection blocks (~105-200) with the module call; keep SOURCE_PATH reg + display + tool check; **no** permission wiring |
| `skills/migration/steps/stage-2-feasibility.md` | Tiny explicit stack-neutral re-platform/upgrade posture rule in 2.0b |
| `skills/shared/checkpoint-schema.md` | Stack-neutral wording for `source_token`/`source_version` (keep comparable); optional `source_roots[]` |
| `scripts/repo-detect.cjs` | Formalize the migration-source seam comment (name the wrapper as caller) |
| `tests/migration-source-detect.test.cjs` **(new)** | Fixtures per stack + multi-root + external-only + resume-compat |
| `tests/validate.js` | Assert `scripts/migration-source-detect.cjs` exists; keep existing checks green |
| `docs/adr/0060-migration-owned-source-detection.md` **(new)** | Decision (lean wrapper) + alternatives rejected (full fork now — premature; keep inline in stage-0 — scattered/untestable; new field in `dream-init-state` — second topology store) |
| `CLAUDE.md` | Reword if any prose describes migration source detection via the shared pipeline |

## 5. Verification

Read-only fixtures under `tests/` (per the `tests/frontend-parity` precedent):

1. **.NET source** → `primary.token=dotnet`, per-project `versions`/`generation`, data layer +
   integrations detected. Proves no regression vs today's `generations.dotnet` path.
2. **Node/Express source** → `primary.token=nodejs`, auth (`passport`) + data layer detected, with
   **no** `generations.dotnet` and no plugin state present. Proves stack-neutrality.
3. **Java / Python / Angular sources** → correct token/version each (equal-citizen treatment).
4. **Multi-root** — source split across repo + one `additionalDirectories` path → both in
   `roots[]`, stacks merged.
5. **External-source-only** — source entirely in an `additionalDirectories` path → detector scans
   the external root, current repo ignored.
6. **Opportunistic fast-path** — a source *with* `dream-init-state.json`/`graph.json` → detector
   uses them but output matches the from-scratch scan (writes nothing to source state).
7. **Resume / backward-compat** — an in-flight `migration-checkpoint.json` (schema 1.11) resumes
   from stored `source_token`/`source_version` without re-detection; the rewire doesn't break it.
8. **`source_version` comparability** — generalized version string still satisfies Q1b
   (`target ≥ source`) and Stage-2 posture comparisons.

**Regression gates:**
- `node tests/migration-source-detect.test.cjs` (new) — fixtures above.
- `node tests/validate.js` — green (new assertion; existing checks untouched).
- `node tests/repo-detect.test.cjs` / `tests/stack-signals.test.cjs` — green (the module *calls*
  `repo-detect`; assert the seam still returns the expected shape).
- Manual smoke: `MIGRATE ADO-xxxx` Stage 0 on a Node source → "SOURCE APPLICATION ANALYSIS" reports
  correct stack/version/integrations via the module; nothing written to source state.

## 6. Governance note

This is the plugin's own governed session. The new `scripts/migration-source-detect.cjs` and the
`scripts/repo-detect.cjs` edit are **source code** under the Write Gate (§0) and the mechanical
ICEA floor — they require the sanctioned unblock path (`APPROVE ADO-{ID}` or a Tier-T1 change-spec
under `docs/`). The `.md` files, the ADR, and `tests/*` are floor-exempt.
