# skills/shared — Cross-Skill Primitives

This folder holds the specifications and schemas shared across multiple skills. Any skill that reads
or writes shared state references these files instead of inventing its own conventions.

> **This README is a projection, not a source of truth.** The authoritative list of shared specs is
> `.claude-plugin/plugin.json` → `components.shared`. The table below is **generated** from it by
> `scripts/gen-shared-index.cjs` and verified in CI — do not hand-edit the count or the rows. History
> lives in `CHANGELOG.md` and `docs/adr/`, never here (ADR 0063).

## Shared specs

<!-- BEGIN GENERATED: shared-specs (scripts/gen-shared-index.cjs) — do not hand-edit -->

_46 shared specs — generated from `plugin.json` → `components.shared`. Refresh with `node scripts/gen-shared-index.cjs --write`._

| Spec | Summary (spec H1) |
|---|---|
| `arch-populated-detect.md` | Architecture-Doc Populated Detection Spec |
| `business-context-generation.md` | Business Context Generation |
| `business-context-grounding.md` | Business Context Grounding Loop |
| `business-context-presets.md` | Business Context Presets |
| `business-context-severity.md` | Business Context Severity Spec |
| `change-manifest-spec.md` | Change Manifest — Shared Spec |
| `change-tier-spec.md` | Change Tier Classification — Shared Spec |
| `checkpoint-schema.md` | Checkpoint File Schema |
| `claude-md-budget-spec.md` | Shared spec: CLAUDE.md context budget |
| `context-budget-check.md` | Shared Skill: context-budget-check |
| `dismissed-findings-reconciliation.md` | Dismissed Findings Reconciliation — Shared Spec |
| `dream-memory-reading-spec.md` | Dream Memory Reading — shared primitive |
| `dream-reference.md` | Shared spec: Dream memory — reference detail |
| `executor-seam.md` | Executor Seam — future-autonomy flag (default OFF) |
| `file-cache-schema.md` | file-cache.json — Shared Change Detection Schema |
| `findings-gate.md` | Findings Gate — Shared Specification |
| `fingerprint-spec.md` | Finding Fingerprint Specification |
| `flag-prompt-spec.md` | Flag Prompt Specification |
| `git-remote-provider-spec.md` | Git Remote Provider Spec |
| `goal-loop-spec.md` | Goal-Loop Engine Spec |
| `graph-index-schema.md` | Graph Index Schema |
| `graph-json-schema.md` | Graph JSON Schema |
| `graph-module-schema.md` | Graph Module Schema |
| `icea-decisions-spec.md` | ICEA Decisions Block (ICEA-D) — Shared Spec |
| `icea-schema.md` | ICEA Schema — Shared Specification |
| `interactive-menu-spec.md` | Interactive Scope Menu Specification |
| `judge.md` | Shared LLM-as-Judge Layer (migration family) |
| `ledger-block-mutation.md` | Ledger Block Mutation — shared primitive |
| `ledger-schema.md` | Finding Ledger Schema |
| `migration-ledger-schema.md` | Migration-Family Ledger Schema (Upgrade · Rewrite · Replatform) |
| `model-routing-spec.md` | Model Routing Specification |
| `multi-root-scan.md` | Shared spec: multi-root scan resolution |
| `personas-spec.md` | Expert Personas Specification |
| `phase-d-spec.md` | Phase D — Deterministic Analysis Layer — Shared Spec |
| `plugin-path-resolution.md` | Shared spec: canonical plugin-path & stack resolution |
| `rubric-score-schema.md` | Rubric Score Schema |
| `runtime-generation-spec.md` | Runtime-Generation Resolution Spec |
| `scope-flags-spec.md` | Scope Flags Specification |
| `secrets-scan-spec.md` | Secrets Scan — Shared Specification |
| `single-writer-assumption.md` | Single-Writer Assumption |
| `source-file-consent.md` | Source File Consent Spec |
| `techspec-schema.md` | Tech Spec Schema — Shared Specification |
| `three-pass-spec.md` | Three-Pass Scan Architecture |
| `traceability-mapping-spec.md` | Diff ↔ Requirement Traceability Mapping — Shared Specification |
| `vcs-detect-spec.md` | VCS Detection Spec |
| `write-gate-spec.md` | Shared spec: WRITE GATE — full detail |

<!-- END GENERATED: shared-specs -->

Each row's summary is the spec's own H1. Open the file for its full contract. A spec belongs here only
when **two or more skills** read/write the same artefact or follow the same protocol; every entry must
be registered in `components.shared` (CI fails on a `skills/shared/*.md` that isn't, or a registered
entry missing from disk).

---

## Cross-skill dependency map

Some skills depend on outputs from other skills. Run them in the order shown or the dependent skill
will fail or produce incomplete output.

| Skill | Requires | Produced by |
|---|---|---|
| `icea-review` | An approved ICEA document under `docs/Release*/Sprint*/UserStory*/` | `icea-feature` |
| `pr-create` | A PR description in the current conversation | `pr-describe` |
| `pr-spec-review` | An ICEA file path and a PR diff | `icea-feature` + `pr-create` |
| `app-readiness` | `.claude/architecture/architecture-deployment.md` populated | `architect` (Step 0.5) via `setup-init` or `update-arch --deployment` |
| `plugin-readiness` | All setup-status checks green, ICEA files present, security scan run | `setup-init`, `icea-feature`, `security-review` |
| `fix` | A finding with a fingerprint in a ledger | `code-review`, `security`, `dynamic-scan` |
| `dismiss` | A finding with a fingerprint in any ledger | `code-review`, `security`, or `dynamic-scan` |
| `checkin` | Staged files, optional ICEA doc for compliance check | developer + `icea-feature` |
| `sync-dirs` | Manifest files present in the working directory | developer (auto-called by `setup-init`) |
| `graph-sync` | An existing `.claude/graph/graph.json` (or bootstraps one); conforms to the graph schemas + `fingerprint-spec` | `graph-create` / prior `graph-sync` |
| `graph-viz` | A populated `.claude/graph/graph.json` conforming to `graph-json-schema` | `graph-sync` |
| `setup-sync` | An existing provisioned project (`.claude/dream-init-state.json`); both `setup-init` and `setup-sync` use `vcs-detect-spec` | `setup-init` |

**First-time setup order:**
1. `/setup-init` — creates memory, rules, architecture docs, and architecture-deployment.md
2. `/session-start` — verify setup and warm context
3. Then normal workflow: `icea-feature` → code → `checkin` → `pr-describe` → `pr-create`

**Graph family:** `graph-create` / `graph-sync` build and refresh `.claude/graph/graph.json`
(authoritative) against `graph-json-schema`, `graph-index-schema`, `graph-module-schema`, and
`fingerprint-spec`; `graph-viz` renders that graph.

**Setup family:** `setup-init` provisions a project; `setup-sync` re-provisions it after a plugin
upgrade; `setup-status` reports health. All three use `vcs-detect-spec` to pick the correct ignore file.

**Migration family:** `upgrade` · `rewrite` · `replatform` are directly-invoked skills over a shared
substrate (`migration-ledger-schema` for journey state, `judge` + `model-routing-spec` for the gate
judge ladder, `migration-source-detect.cjs` for stack detection). They do **not** use
`checkpoint-schema` (that is the code-review/security scan-resume file). See ADR 0061/0062.

---

## ADO PAT unavailable — degraded mode

Skills that call the ADO REST API (`pr-create`, `sprint-metrics`, `app-readiness`) require
`$AZURE_DEVOPS_PAT`. When the PAT is missing or expired, each skill must:

1. Announce degraded mode clearly:
   ```
   ⚠ ADO checks skipped — AZURE_DEVOPS_PAT is not set or has expired.
   Set it as a Windows User Environment Variable (Option A) or in
   .claude/settings.json (Option B — confirm it is gitignored).
   Continuing with local checks only…
   ```
2. Skip all ADO API calls — do not fail silently or produce Unknown scores without explanation
3. Produce a partial report with all non-ADO checks completed
4. End with: `ADO-dependent checks: SKIPPED — set AZURE_DEVOPS_PAT to complete`

Do not prompt for the PAT inline in degraded mode — direct the developer to the permanent storage
options instead.

---

## Rules for adding to this folder

1. A file belongs here only if **two or more skills** read or write the same artifact.
2. The file in `shared/` is the **single source of truth** — skill-local copies are forbidden once a
   spec is promoted here.
3. Register it in `.claude-plugin/plugin.json` → `components.shared` (CI enforces manifest == disk).
4. Reference it from a skill via the plugin path `$PLUGIN_DIR/skills/shared/<filename>` (PLUGIN_DIR is
   resolved per `plugin-path-resolution.md`). The old relative path `../shared/<filename>` only works
   from the plugin directory, not from a target project's CWD.
5. When updating a shared spec, update **all** skills that reference it in the same commit.

---

## Bundled-substrate + drift-check governance (migration family)

The migration family (Upgrade · Rewrite · Replatform) must be **deployable standalone** onto a repo
that never ran `setup-init`. Because that vetoes runtime dependency resolution, the substrate is
governed by **bundled-copy + drift-check** (ADR 0063 — this is BUNDLING of first-party substrate, not
third-party "vendoring"), in two modes:

- **In-plugin (dev):** skills read this canonical `skills/shared/` directory directly — no copies, zero drift.
- **Standalone (packaging):** a build step (`scripts/vendor-substrate.cjs`) copies canonical into the
  bundle, stamps a manifest `{substrate_version, per-file sha256, content_hash}`, and banner-marks each
  copy **`GENERATED — DO NOT EDIT`**.
- **Drift-check** (`scripts/substrate-drift-check.cjs`) compares bundled vs canonical (banner excluded)
  and the recorded canonical hashes vs current; **non-zero exit on any drift** (CI-enforced).

> **Seam status:** the bundling seam is **packaging-time only** and is not yet consumed at runtime —
> no code reads a bundle today; `.vendor/` is not committed. It exists so a future standalone package
> can ship a hash-verified copy.
>
> **Retained identifiers:** the script filenames (`vendor-substrate.cjs`), the default `.vendor/` output
> dir, and the `substrate_version` manifest key still carry "vendor" — a deeper rename is a deferred,
> optional follow-up (ADR 0063).

**Change process (not just anti-drift):** to change a governed spec — bump the substrate semver →
re-bundle → drift-check → write an ADR → re-validate consumers. The migration-ledger **core**
(`migration-ledger-schema.md`) is **additive-only** — never remove or repurpose a core field.

Governed members: `migration-ledger-schema.md` · `judge.md` · `model-routing-spec.md` (judge ladder) ·
the gate-keyword grammar · detection · feasibility engine · goal-loop + rubric-score.
