# Seed spec — One migration engine, two contracts, mode-gated remediation

> **Status:** design seed for a FUTURE `RewriteAndMigrate` command. Not scheduled work.
> Captures the agreed architecture so it can be picked up cleanly later.

## Context

The `migration` skill and the future `RewriteAndMigrate` command have the **same objective** —
source app → target app — but produce **different output**, so they cannot be independent forks.
They must share **one engine** and diverge only at the **contract (oracle)** and an optional
**remediation axis**.

Why this shape (rationale):
- `migration`'s contract is **behavioral equivalence** — same behavior on a new framework/stack;
  oracle = golden-master + as-built reconciliation *proving nothing changed*. Design quality is
  already the base of the target ([project-rules.md](../../.claude/rules/project-rules.md) Design
  philosophy, [clean-architecture.md](../../skills/migration/references/shared/clean-architecture.md),
  coverage targets + NetArchTest/ArchUnit fitness tests) and is *verified* by reconciliation.
- Bolting defect-elimination onto `migration` would silently turn a faithful port into a refactor,
  breaking its own hard rule "NEVER migrate + refactor + change behaviour in one step."
- `RewriteAndMigrate`'s contract is **intent equivalence + better implementation** — behavior may
  change; oracle = approved behavioral inventory + stakeholder sign-off (NOT golden-master). This is
  where defect elimination is a *goal*, not a violation.
- Two parallel skills would duplicate six stages + every mapping/stack reference — a DRY disaster on
  any change. So: **template-method / strategy** — one pipeline, mode selects the contract.

## Architecture: one engine, two contracts

| | `migration` | `RewriteAndMigrate` (future) |
|---|---|---|
| Contract / oracle | behavioral equivalence → golden-master proves nothing changed | intent equivalence → approved inventory + stakeholder sign-off |
| Refactor policy | behavior-preserving only | **behavior-safe** defect elimination + intentional improvement |
| Remediation axis | dormant | **active** (mode-gated) |
| Output framing | "same behavior, new stack" | "improved implementation of the same intent" |

**Shared, unchanged:** Stage 0 identifiers · 0.5 posture · 0.6 inventory · 1 architecture ·
2 feasibility · 3 clusters · 4 migration · 5 tests · 6 verification, plus all
`references/` (code-review engine, clean-architecture, reconciliation, stacks, mappings).

**The selector already exists.** Stage 0.5's posture axis (mechanical port · re-architecture ·
**rewrite-from-spec**) *is* the strategy; stages already branch on it (0.6 depth Light/Medium/Full;
Stage 5 oracle varies). `RewriteAndMigrate` ≈ the **rewrite-from-spec posture promoted to a
first-class command** over the same engine — packaged as one skill, two command stubs (they ship
together; cannot be deployed independently).

## The mode-gated remediation axis (active only in RewriteAndMigrate mode)

Reuse existing machinery — the `code-review` skill as the defect detector, the reconciliation
ledger/gate pattern for verification. Three touch-points, all **guarded by the mode flag** (no-ops
in behavior-preserving `migration`):

1. **A — Source Quality Ledger (Stage 0.6).** New artifact
   `docs/.../ADO-{ID}-source-quality-ledger.md`, kept **separate** from the behavioral inventory
   (behavioral = *what it does*; quality = *how badly it's built*). Run `code-review` against
   `{SOURCE_PATH}` (Phase D + Pass 1, scoped by the source graph). One row per finding:
   `defect class · PROV:location · severity · behavior-safe-to-fix? · disposition`. New spec:
   `skills/migration/references/specs/source-quality-ledger-spec.md`.
2. **B — Remediation mapping (Stage 1).** A "Source Defect Remediation" table in
   `ARCHITECTURE-DECISIONS.md`: each defect class → `Eliminated by {target design decision}` /
   `N/A in target stack` / `Carried — {reason} + debt ADO task`. This is where the design principles
   bite on something concrete (e.g. inline SQL → Dapper parameterized → Eliminated; behavior-safe).
3. **C — Target re-check (Stage 6, 5th reconciliation check).** Re-run `code-review` on the TARGET;
   any ledger class marked `Eliminated` that **recurs** = HIGH divergence (Critical on a B-series
   path) blocking MIGRATION COMPLETE — same gate as unexplained golden-master drift. Honest-label
   imperative stacks `NOT mechanically verified` as the existing checks do.

**Remediation posture:** behavior-safe auto-eliminate — auto-fix defect classes whose fix preserves
behavior (inline→parameterized SQL, resource leak→`using`/try-with-resources, sync-over-async→async,
no-DI→constructor injection); **carry** behavior-changing fixes as debt tasks. Depth scales by
posture (Light for mechanical port, Full for rewrite).

## Implementation sketch (when RewriteAndMigrate is scheduled)

- **Mode flag** in the checkpoint (schema bump): `mode.contract = "behavioral" | "intent"`. Set by
  which command stub was invoked; `migration` → behavioral, `RewriteAndMigrate` → intent.
- **Command stubs:** add `RewriteAndMigrate` stub in `commands/` + `_project-deploy/commands/`;
  both point at the same `skills/migration` engine with the mode preset. Register in
  `.claude-plugin/plugin.json`.
- **Gate wiring:** the A/B/C touch-points check `mode.contract === "intent"` before activating; add
  `stage_gates.quality_remediation_verified` (set at Step 6.5 alongside `asbuilt_reconciled`, only
  in intent mode).
- **Oracle swap (Stage 5/6):** intent mode relaxes golden-master "prove identical" to
  "prove approved-inventory behaviors hold" + stakeholder sign-off; behavioral mode unchanged.
- **Keyword handlers** (§0a in both `CLAUDE.md` and `_project-deploy/CLAUDE.md`): `REWRITE ADO-{ID}`
  entry + `MIGRATE QUALITY ADO-{ID}` to resume/regenerate the source quality ledger.
- **Consider moving** the `rewrite-from-spec` posture + Stage 0.6 Full-depth path under
  `RewriteAndMigrate` so `migration` is left with port + light re-architecture only (no rewrite
  logic living in the behavior-preserving command).

## Non-goals (avoid over-engineering)
- No SOLID-*scoring* / cohesion-coupling metrics engine — fitness tests already enforce the
  dependency rule; defect-class recurrence is the concrete verified signal.
- No new detector — `code-review` reused verbatim (DRY).
- No per-cluster Stage-4 review gate — source scan + Stage-6 re-check only.
- Do **not** activate any remediation touch-point in behavior-preserving `migration`.

## Verification (when built)
1. Static: `bash verify-plugin.sh` + `python tests/validate.py` — new spec resolves, handler table
   parses, no broken `$PLUGIN_DIR` refs, command/skill counts updated.
2. Behavioral-mode regression: an existing `migration` run shows the A/B/C touch-points are no-ops
   (no ledger, no Check 5) — the faithful-port contract is untouched.
3. Intent-mode happy path: defect-seeded fixture (inline SQL + undisposed `IDisposable`) →
   (a) ledger flags both `behavior-safe? = yes`; (b) Stage 1 shows both `Eliminated by …`;
   (c) target uses parameterized Dapper + `using`; (d) Stage 6 Check 5 = zero recurrence,
   `quality_remediation_verified = true`.
4. Intent-mode negative: reintroduce inline SQL in a generated file → Check 5 raises HIGH, blocks
   completion until dispositioned. Idempotence: re-run Step 6.5 → zero new divergences.

---

## ⚠ Note on filename — "PluginIsolation" not yet covered

This document currently covers only the **RewriteAndMigrate** design. The filename also references
**Plugin Isolation**, which is not yet a section here. If you intend this doc to also capture a
plugin-isolation design (e.g. isolating the migration engine as an independently versioned
plugin/module, or worktree/context isolation between the two command modes), tell me the scope and
I'll add that section.
