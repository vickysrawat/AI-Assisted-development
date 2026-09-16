# Design of record: Source-Context Intake Gate (shared substrate)

_Status: DESIGN LOCKED — not yet implemented · Last changed: 2026-09-15 · Applies to: upgrade · rewrite · replatform_

> Companion to `upgrade.md` / `rewrite.md` / `replatform.md` / `README.md`. Adds a shared,
> fail-closed intake gate to the migration family so the source project's own documented
> knowledge is provably read **before** any options / gap-risk analysis is produced.

---

## 1. Problem

A migration-family run produced design documents with significant gaps because the intake phase
made design decisions **before systematically reading the source project's own documented
knowledge**. The generalized (stack-, client-, target-agnostic) failure modes:

1. **Existing source design docs ignored.** The source project's own architecture/design
   documentation (request/processing pipeline, cross-cutting behaviors, dependency inventory,
   build/deploy transforms) was present but not read before analysis began.
2. **The application's own source was not read — only prose about it.** The skills are architected
   to *avoid* reading the full source (token economy): they lean on the knowledge graph (a
   source-derived projection), the Integration Inventory, and targeted reads. When the graph is
   incomplete or a behavior-bearing unit is never opened, the model translates a *description* of
   the code instead of the code — and behavior silently disappears. **This is the deepest cause:
   a migration grounded in docs rather than source is unsound by construction.**
3. **Additional roots not followed.** Dependency source made available via `additionalDirectories`
   was listed but never opened — so Tier 2 verification never actually ran.
4. **Source context files read superficially.** The source project's agent-instruction/context
   file named external dependencies and their roles; it was skimmed, not mined.
5. **Integration verification stopped at declarations.** Verification read config/manifest/dependency
   references but not the **implementation code** — so it never learned what each integration *does*.
6. **`PARTIAL` used as a deferral mechanism.** Unknowns were marked `PARTIAL` and carried forward
   even though full source was available to resolve them immediately.

## 2. Root cause

**A rule gets skipped when nothing that runs later depends on it having been done.** The intake
reads were advisory. `integration-verification-spec.md` already said "Tier 2 is REQUIRED, not
optional" — and it was still skipped, because no downstream script or gate consumed *proof* that
intake happened. Prose hard rules are necessary but provably insufficient.

## 3. Enforcement principle

To make a step unskippable, **a required later step must be mechanically unable to succeed without
the artifact that step produces.** Two moves:

1. **Turn "reading" into a verifiable artifact.** You cannot verify that an agent read something.
   You *can* verify an artifact it had to produce with **resolvable citations** (`PROV: path#line`).
   No citation, or a citation that doesn't resolve = not read.
2. **Chain a downstream step to it (fail-closed).** The step that consumes source analysis
   (options / decompose / report) refuses to proceed unless the intake gate is `PASS`.

This is the same mechanism already used by `strategy-resolve.cjs` (exit 2/3/4 STOP) and
`rewrite-decompose.cjs` (exit 11 on a cyclic DAG).

### Enforcement ladder (defense-in-depth)

| Layer | Mechanism | Catches |
|---|---|---|
| 1 | Prose hard rule | nothing alone — this is what already failed |
| 2 | Required artifact (Source Context Manifest) | absent/empty manifest |
| 3 | Deterministic gate script (`intake-verify.cjs`, exit-code STOP) | uncovered root · dangling citation · reachable-source PARTIAL · unwired dependency |
| 4 | Contradiction check in that script | `PARTIAL`/`unknown` whose source is in a configured root |
| 5 | **Ledger chaining** | the downstream step skipping the gate entirely — the keystone |
| 6 | Judge backstop | semantic checks a script cannot make |
| 7 | (future) harness hook | enforcement even if skill text is edited |

## 4. Locked design

### 4.1 Files (4 new, 5 edits)

| Action | Path | Content |
|---|---|---|
| new spec | `skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md` | Manifest schema · per-skill depth table · binding table · judge checks |
| new script | `scripts/intake-verify.cjs` | `verify` + `check-gate` subcommands, fail-closed |
| new test | `tests/intake-verify.test.cjs` | Matches `tests/rewrite-decompose.test.cjs` convention |
| edit | `skills/shared/migration-ledger-schema.md` | Additive core: `stage_gates.intake_context` + `core.source_context` block |
| edit | `skills/rewrite/SKILL.md` | Step 1.5 runs `verify`; Step 2 `decompose` gated by `check-gate`; + hard rules |
| edit | `skills/upgrade/SKILL.md` | Step 3 runs `verify`; Step 8 `set-gate --gate=report` **refuses** unless intake PASS; + hard rules |
| edit | `skills/replatform/SKILL.md` | Step R1 runs `verify`; R2 `plan` gated by `check-gate`; + hard rules |
| edit | `skills/shared/migration-knowledge/refs/specs/integration-verification-spec.md` | Cross-link: Tier 2 enforcement now backed by the intake gate |

### 4.2 The artifact — Source Context Manifest

One manifest per migration, written before any analysis. Unverifiable behavior ("did you read
it?") becomes a verifiable file with resolvable citations.

```markdown
# Source Context Manifest — {migration id}
Roots expected: {repo} + {each additionalDirectories entry}

## Source context files
| Doc | Path | Covered | PROV |
| agent-instructions | CLAUDE.md | yes | CLAUDE.md#L1-L40 |
| architecture docs  | .claude/architecture/*.md | yes | architecture.md#L12 |
| settings/extra-roots | .claude/settings.local.json | yes | settings.local.json#L3 |

## Additional roots (additionalDirectories)
| Root | Read | Dependency role | PROV |
| {dep-A abs path} | yes | {role} | {dep-A}/src/...#L20 |

## Cross-cutting concern scan (impl, not declaration)
| Concern | Found where | PROV |
| logging / auth / tracing / error-handling / pipeline | ... | ...#Lnn |

## Source coverage (denominator = graph.json modules)
| Source module | Disposition | Target cluster / reason | PROV (source file#line) |
| Orders.Service | mapped | cluster: orders | src/Orders/Service.cs#L1-L220 |
| Legacy.Reports | out-of-scope | reason: replaced by BI tool, confirmed by developer | src/Legacy/Reports.cs#L1 |
```

Rules:
- No PROV, or a PROV that doesn't resolve to a real file/line = not read.
- **Every** `graph.json` module must appear with a disposition of `mapped` or `out-of-scope`
  (with a reason). A module referenced by nothing = a silent drop = **fail**.
- A behavior-bearing unit (`business-logic` / B-series / integration) MUST cite the actual
  **source** implementation `file#line` — citing an architecture doc for it counts as *not read*.

### 4.3 Per-skill manifest depth

Inherits the asymmetry already stated in `integration-verification-spec.md` (upgrade is "lighter
than Rewrite/Replatform"):

| Manifest section | rewrite | replatform | upgrade |
|---|---|---|---|
| Source context files (CLAUDE.md, arch docs, settings) | required | required | required |
| Additional roots read (each `additionalDirectories`) | required | required | required |
| Cross-cutting concern scan | required (deep) | infra-relevant only | delta only (what the bump touches) |
| Dependency impl-code classification (Tier 2) | required | required | only for integrations that *break* |
| **Source coverage — full accounting** (every graph module mapped/out-of-scope) | required | required | required |

> Source coverage is **full accounting for all three skills** (decision D7). Even upgrade/replatform,
> which mostly move code unchanged, must prove no module was silently ignored — "unchanged" is a
> disposition that must be *asserted with a citation*, not assumed by omission. The denominator is
> `graph.json`; if absent, degrade to a mechanical source-file enumeration over `scanRoots()`.

### 4.4 `intake-verify.cjs` contract

Pure / read-only (writes nothing itself — like `strategy-resolve.cjs` and `rewrite-decompose.cjs`).

**`verify --ado --manifest --inventory --skill=<rewrite|upgrade|replatform>`**
- Expected roots = repo + `additionalDirectories`, reusing `scanRoots()` from `multi-root-scan.md`
  (never re-improvise root logic).
- Coverage check · PROV citation resolution · PARTIAL-with-reachable-source contradiction.
- **Unwired-dependency heuristic:** greps source docs (CLAUDE.md / architecture) for
  dependency-like references, diffs against `additionalDirectories`, emits `unwired_candidates[]`.
- **Source-coverage check:** reads `graph.json` (or, if absent, enumerates source files over
  `scanRoots()`) as the denominator; every module must have a `mapped`/`out-of-scope` disposition in
  the manifest, and every behavior-bearing unit must cite a resolvable **source** `file#line`.
- Required sections scale by `--skill` (per the depth table) — except source coverage, which is full
  accounting for all three.

| Exit | Meaning | Skill action |
|---|---|---|
| 0 | verified | record `stage_gates.intake_context=PASS` + `core.source_context` |
| 2 | manifest missing/empty | STOP — read source first |
| 3 | expected root uncovered | STOP — name the unread root |
| 4 | dangling PROV citation | STOP — the "read" is unproven |
| 5 | PARTIAL with reachable source | STOP — resolve it now |
| 6 | named-but-unwired dependency candidate | STOP — wire it into additionalDirectories or justify |
| 7 | source module unaccounted for | STOP — a graph module has no `mapped`/`out-of-scope` disposition (silent drop) |
| 8 | behavior-bearing unit cited to a doc, not source | STOP — cite the actual implementation `file#line` |

**`check-gate --ado`** — reads the ledger; exits non-zero unless `intake_context=PASS`, and cheaply
re-validates (manifest exists + citations ≥ expected roots + `modules_mapped + modules_out_of_scope
== modules_total` against `graph.json`) so a hand-faked `set-gate PASS` won't pass. This is the
keystone (ladder layer 5).

### 4.5 Two-layer detection

- **Script layer:** deterministic exits 2–6, including the unwired-dependency token-diff.
- **Judge layer (at the gate):** confirms `unwired_candidates[]` semantically and checks the
  cross-cutting scan actually *found* the concerns (not just declared empty sections) — the part a
  script cannot judge.

### 4.6 Ledger changes (additive, core)

Because the gate is shared across all three skills, it lives in **core** (the shared, additive-only
hand-off contract), not a skill payload:

```jsonc
"stage_gates": { "intake_context": "PASS" },
"source_context": {
  "manifest_path": "docs/.../source-context-manifest.md",
  "verified": true,
  "roots_expected": ["<repo>", "<dep-A>"],
  "roots_covered":  ["<repo>", "<dep-A>"],
  "modules_total": 42,          // graph.json denominator
  "modules_mapped": 39,
  "modules_out_of_scope": 3,    // mapped + out_of_scope must equal total (full accounting)
  "verified_at": "<date>"
}
```

### 4.7 Per-skill wiring (grounded in the current SKILL.md files)

| Skill | Runs `verify` at | Fail-closed chain point |
|---|---|---|
| **rewrite** | Step 1.5 (integration verification + oracle, before Step 2 options) | `rewrite-decompose.cjs decompose` calls `check-gate` first — no options/DAG without PASS |
| **replatform** | Step R1 (posture + integration verification + oracle, before options) | `replatform-plan.cjs plan` (R2) calls `check-gate` first |
| **upgrade** | Step 3 (integration verification runs inside gap/risk analysis) | **`upgrade-checkpoint.cjs set-gate --gate=report` refuses to record PASS unless `intake_context=PASS`** — the LLM-authored report cannot be produced on unread source |

Upgrade asymmetry rationale: its headline deliverable (the Gap+Risk report = Document 7) is
LLM-authored, with no downstream *script* like decompose/plan to hard-refuse. Enforcing at the
report gate is the closest mechanical equivalent.

## 5. Decisions made (with alternatives rejected)

| # | Decision | Alternatives rejected |
|---|---|---|
| D1 | Enforcement level: **full mechanical gate** | prose-only (already proven skippable); artifact+judge without a script |
| D2 | Scope: **shared substrate for all three skills** | rewrite-only (the failure mode exists in all three) |
| D3 | Upgrade enforcement: **refuse the report gate** | gate baseline tag only (too late — report still produced on unread source); gate+judge without script refusal |
| D4 | Unwired-dependency detection: **script heuristic + judge** | judge-only (no deterministic exit); script-only (misses prose references) |
| D5 | Ledger placement: **core (`stage_gates.intake_context` + `core.source_context`)** | per-skill payload (not shared) |
| D6 | Manifest depth: **per-skill profile** | one-size-fits-all (forces upgrade to over-document) |
| D7 | Source coverage: **full accounting for all three skills** (every graph module mapped/out-of-scope; behavior-bearing units cited to source `file#line`; denominator = `graph.json`, degrade to file enumeration) | risk-weighted (lets non-behavioral modules go uncited — reopens the silent-drop gap); per-skill (upgrade/replatform could drop modules under "unchanged") |

## 6. Related but separate (not part of this gate)

The original report also raised two post-code-generation outputs — an oracle-validation runbook and
an automated source↔target comparison script. Those belong to `golden-master-spec.md` (behavioral
assurance), not to the intake gate. Tracked separately; noted here to keep scope clean.

## 7. Honest residual limit

No layer is a true sandbox — an orchestrator could fabricate a manifest or hand-set the gate.
`check-gate` re-validates citations rather than trusting the boolean, and the citation-resolution +
unwired-dependency checks make fabrication expensive (every claim must point at a real file/line).
This moves the family from "please remember" to "the next step fails until it's done" — across all
three skills. It is defense-in-depth, not a hard wall.

## 8. Build path (open)

Design is locked; not yet implemented. Because this is a new shared capability spanning 3 skills +
substrate + the ledger, building it is subject to this repo's Feature/Write Gate. Next step is to
choose: ICEA gate first, or `/skip-icea` + build behind the Write Gate.
