# skills/shared — Cross-Skill Primitives

This folder contains specifications and schemas that are shared across multiple
skills. Any skill that reads or writes shared state must reference these files
rather than inventing its own conventions.

## Contents

All 41 shared specs are listed below (matching `.claude-plugin/plugin.json` →
`components.shared`). Grouped by family for readability.

### Review / findings pipeline

| File | Used by | Purpose |
|---|---|---|
| `three-pass-spec.md` | code-review, security | Three-pass scan architecture (structured rules, persona passes, free-flow adversarial) |
| `phase-d-spec.md` | code-review | Deterministic analysis layer — run available machine scanners so "unscanned" is never confused with "clean" |
| `interactive-menu-spec.md` | code-review, security | Interactive scope menu when no flag provided |
| `checkpoint-schema.md` | code-review, security, migration | Resume-on-drop checkpoint file schema |
| `fingerprint-spec.md` | code-review, security, dynamic-scan, graph-sync | FP-xxxxxxxx deterministic finding/module fingerprint generation |
| `ledger-schema.md` | code-review, security, dynamic-scan | Common finding ledger structure and reconciliation rules |
| `ledger-block-mutation.md` | fix, dismiss | Machinery for moving one `### [FP-xxxx]` block between ledger sections and keeping Summary counts correct |
| `file-cache-schema.md` | code-review, security | Schema and merge rules for `.claude/file-cache.json` |
| `scope-flags-spec.md` | code-review, security | Canonical definition of `--changed`, `--pr`, `--full` flags |
| `single-writer-assumption.md` | code-review, security, token-analysis | Concurrency constraints for cache-writing skills |
| `findings-gate.md` | pr-create, checkin | Canonical bash functions and output blocks for Critical/High open findings detection across all three ledgers |
| `dismissed-findings-reconciliation.md` | code-review, security, dynamic-scan | Canonical Rule 5 — dismissed finding reconciliation on re-scan: keep dismissed if file unchanged; re-open with verify flag if code changed since dismissal date |
| `secrets-scan-spec.md` | checkin, pr-create, check-settings-secrets.cjs | Single source of truth for secret / sensitive-file detection patterns and credential value shapes |

### ICEA / Tech Spec / PR

| File | Used by | Purpose |
|---|---|---|
| `icea-schema.md` | icea-feature, pr-spec-review, critic | Normative contract for a valid ICEA document — required sections, field rules, validation gates |
| `techspec-schema.md` | icea-feature, pr-spec-review, critic | Normative contract for a valid Tech Spec — required sections, AC-coverage contract, validation gates |
| `icea-decisions-spec.md` | icea-feature, critic | ICEA-D "Decisions" block — captures load-bearing implementation choices so the approver approves the approach, not a blank cheque |
| `change-manifest-spec.md` | icea-feature, icea-implement | File-level declaration of intended changes generated with the ICEA (instrumentation mode — displayed, measured, harvested) |
| `change-tier-spec.md` | icea-feature, icea-implement | Classifies a proposed change into a ceremony tier — system-classified, mechanical, recorded in the audit trail |
| `traceability-mapping-spec.md` | pr-describe, pr-spec-review | Rules for mapping a code diff to requirements (ICEA ACs) and flagging scope creep |
| `git-remote-provider-spec.md` | pr-create, pr-describe, pr-spec-review | Auto-detect the git remote provider (Azure DevOps vs GitHub) and its API/URL conventions |
| `write-gate-spec.md` | all writing skills | Full artefact write-timing table and edge cases behind CLAUDE.md §0 Write Gate |

### Goal loop / scoring

| File | Used by | Purpose |
|---|---|---|
| `goal-loop-spec.md` | icea-implement, migration | Bounded, gated goal-loop engine — generate → self-score → revise until goal met or ceiling; exits at a human gate |
| `rubric-score-schema.md` | goal-loop-spec, icea-implement, migration | I/O contract for the self-scoring agent (per-criterion PASS/FAIL/PARTIAL + evidence + derived percentDone) |

### Knowledge graph

| File | Used by | Purpose |
|---|---|---|
| `graph-json-schema.md` | graph-sync, graph-viz, architect | Authoritative machine-readable structure of `.claude/graph/graph.json` (typed nodes/edges, per-module fingerprints) |
| `graph-index-schema.md` | architect, graph-sync, icea-feature, icea-review, code-review, security | Schema for `.claude/graph/graph-index.md` (breadth index) |
| `graph-module-schema.md` | architect, graph-sync, orientation readers | Schema for `.claude/graph/<module>.md` (per-module depth) |

### Setup / architecture / stack detection

| File | Used by | Purpose |
|---|---|---|
| `arch-populated-detect.md` | architect, setup-status | Detect whether an architecture doc is genuinely populated vs still a template stub |
| `runtime-generation-spec.md` | architect (stack-signals.cjs) | Second tier of stack detection — pin the runtime generation per language (manifest-first, consent-gated syntax fallback) |
| `plugin-path-resolution.md` | all skills | Canonical way to resolve `PLUGIN_DIR` and detect the project stack — the one approved snippet, no globbing/crawling |
| `claude-md-budget-spec.md` | setup-init, dream-health | Canonical CLAUDE.md length target used by the size advisory and reported by setup-init / dream-health |
| `context-budget-check.md` | icea-feature, migration | Proactively warn before a large operation runs in a context-heavy session (prevents stub outputs) |
| `vcs-detect-spec.md` | gitignore-sync, setup-init, setup-sync, setup-status | Detect Git vs TFVC and select the authoritative ignore file (.gitignore / .tfignore); managed-entry block and TFVC translation rules |

### Business context

| File | Used by | Purpose |
|---|---|---|
| `business-context-severity.md` | all review skills | B-series business severity override triggers |
| `business-context-generation.md` | architect, setup-init, `SET DOMAIN`, migration | SRP owner — identify domain → ground → synthesize → write `.claude/business-context.md`; the single generation entry point |
| `business-context-presets.md` | business-context-generation | Per-domain starting content for the B-series (verbatim-locked table + augmentable seed) |
| `business-context-grounding.md` | business-context-generation | Grounds the B-series in real, cited regulatory frameworks for the confirmed {domain, jurisdiction} |

### Dream / memory

| File | Used by | Purpose |
|---|---|---|
| `dream-reference.md` | dream, dream-health, dream-audit | Memory consolidation rules, thresholds, and the confidence-scoring contract |
| `dream-memory-reading-spec.md` | dream, dream-health, dream-audit, session-start | The exact memory read set and session-id → URL resolution rules |

### Cross-cutting policy

| File | Used by | Purpose |
|---|---|---|
| `model-routing-spec.md` | all generation and review skills | Model routing tiers, env vars, defaults |
| `personas-spec.md` | all skills | Expert Persona roster (the role lens a skill reasons through), per-skill assignments, and guardrails — orthogonal to model routing |
| `source-file-consent.md` | all skills | Consent categories and gate format for source file access |

---

## Cross-skill dependency map

Skills depend on outputs from other skills. Run them in the order shown or the
dependent skill will fail or produce incomplete output.

| Skill | Requires | Produced by |
|---|---|---|
| `icea-review` | An approved ICEA document under `docs/Release*/Sprint*/UserStory*/` | `icea-feature` |
| `pr-create` | A PR description in the current conversation | `pr-describe` |
| `pr-spec-review` | An ICEA file path and a PR diff | `icea-feature` + `pr-create` |
| `app-readiness` | `.claude/architecture/architecture-deployment.md` populated | `architect` (Step 0.5) via `setup-init` or `update-arch --deployment` |
| `plugin-readiness` | All setup-status checks green, ICEA files present, security scan run | `setup-init`, `icea-feature`, `security-review` |
| `fix` | A finding with a fingerprint in the code-review ledger | `code-review` |
| `dismiss` | A finding with a fingerprint in any ledger | `code-review`, `security`, or `dynamic-scan` |
| `checkin` | Staged files, optional ICEA doc for compliance check | developer + `icea-feature` |
| `sync-dirs` | Manifest files present in the working directory | developer (auto-called by `setup-init`) |
| `migration` | Source-app knowledge graph; consumes `checkpoint-schema`, `goal-loop-spec`, `rubric-score-schema`, `personas-spec`, `traceability-mapping-spec` | `graph-sync` (on the source), the shared specs above |
| `graph-sync` | An existing `.claude/graph/graph.json` (or bootstraps one); conforms to `graph-json-schema`, `graph-index-schema`, `graph-module-schema`, `fingerprint-spec` | `graph-create` / prior `graph-sync` |
| `graph-viz` | A populated `.claude/graph/graph.json` conforming to `graph-json-schema` | `graph-sync` |
| `setup-sync` | An existing provisioned project (`.claude/dream-init-state.json`); both `setup-init` and `setup-sync` use `vcs-detect-spec` | `setup-init` |

**First-time setup order:**
1. `/setup-init` — creates memory, rules, architecture docs, and architecture-deployment.md
2. `/session-start` — verify setup and warm context
3. Then normal workflow: `icea-feature` → code → `checkin` → `pr-describe` → `pr-create`

**Graph family:** `graph-create` / `graph-sync` build and refresh `.claude/graph/graph.json`
(authoritative) against `graph-json-schema`, `graph-index-schema`, `graph-module-schema`, and
`fingerprint-spec`; `graph-viz` renders that graph. The knowledge graph replaces the older
flat "domain map" concept.

**Setup family:** `setup-init` provisions a project; `setup-sync` re-provisions it after a
plugin upgrade; `setup-status` reports health. All three use `vcs-detect-spec` to pick the
correct ignore file.

**Migration:** the `migration` skill derives parallel migration clusters from the source
project's knowledge graph and drives them through the goal loop — it depends on
`checkpoint-schema` (resume), `goal-loop-spec` + `rubric-score-schema` (generate/score/revise),
`personas-spec` (role lenses), and `traceability-mapping-spec` (source↔target behaviour).

---

## ADO PAT unavailable — degraded mode

Skills that call the ADO REST API (`pr-create`, `sprint-metrics`, `app-readiness`)
require `$AZURE_DEVOPS_PAT`. When the PAT is missing or expired, each skill must:

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

Do not prompt for the PAT inline in degraded mode — direct the developer to
the permanent storage options instead.

---

## Rules for adding to this folder

1. A file belongs here only if **two or more skills** read or write the same artifact
2. The file in `shared/` is the **single source of truth** — skill-local copies are
   forbidden once a spec is promoted here
3. Reference from a skill using the plugin path `$PLUGIN_DIR/skills/shared/<filename>` where PLUGIN_DIR is resolved via `.claude/plugin-path.txt`. The old relative path `../shared/<filename>` only works from the plugin directory, not from a target project's CWD.
4. When updating a shared spec, update **all** skills that reference it in the same commit
