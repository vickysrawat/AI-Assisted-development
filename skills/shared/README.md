# skills/shared — Cross-Skill Primitives

This folder contains specifications and schemas that are shared across multiple
skills. Any skill that reads or writes shared state must reference these files
rather than inventing its own conventions.

## Contents

| File | Used by | Purpose |
|---|---|---|
| `three-pass-spec.md` | code-review, security | Three-pass scan architecture (structured rules, persona passes, free-flow adversarial) |
| `interactive-menu-spec.md` | code-review, security | Interactive scope menu when no flag provided |
| `checkpoint-schema.md` | code-review, security | Resume-on-drop checkpoint file schema |
| `fingerprint-spec.md` | code-review, security, dynamic-scan | FP-xxxxxxxx deterministic finding fingerprint generation |
| `ledger-schema.md` | code-review, security, dynamic-scan | Common finding ledger structure and reconciliation rules |
| `file-cache-schema.md` | code-review, security | Schema and merge rules for `.claude/file-cache.json` |
| `scope-flags-spec.md` | code-review, security | Canonical definition of `--changed`, `--pr`, `--full` flags |
| `graph-index-schema.md` | architect, icea-feature, icea-review, code-review, security | Schema for `.claude/graph/graph-index.md` (breadth index) |
| `graph-module-schema.md` | architect, graph-sync, orientation readers | Schema for `.claude/graph/<module>.md` (per-module depth) |
| `single-writer-assumption.md` | code-review, security, token-analysis | Concurrency constraints for cache-writing skills |
| `model-routing-spec.md` | all generation and review skills | Model routing tiers, env vars, defaults |
| `personas-spec.md` | all skills | Expert Persona roster (the role lens a skill reasons through), per-skill assignments, and guardrails — orthogonal to model routing |
| `source-file-consent.md` | all skills | Consent categories and gate format for source file access |
| `business-context-severity.md` | all review skills | B1–B7 business severity override triggers |
| `findings-gate.md` | pr-create, checkin | Canonical bash functions and output blocks for Critical/High open findings detection across all three ledgers |
| `dismissed-findings-reconciliation.md` | code-review, security, dynamic-scan | Canonical Rule 5 — dismissed finding reconciliation on re-scan: keep dismissed if file unchanged; re-open with verify flag if code changed since dismissal date |
| `vcs-detect-spec.md` | gitignore-sync, setup-init, setup-status | Detect Git vs TFVC and select the authoritative ignore file (.gitignore / .tfignore); managed-entry block and TFVC translation rules |

---

## Cross-skill dependency map

Skills depend on outputs from other skills. Run them in the order shown or the
dependent skill will fail or produce incomplete output.

| Skill | Requires | Produced by |
|---|---|---|
| `icea-review` | An approved ICEA document in `docs/icea/` | `icea-feature` |
| `pr-create` | A PR description in the current conversation | `pr-describe` |
| `pr-spec-review` | An ICEA file path and a PR diff | `icea-feature` + `pr-create` |
| `app-readiness` | `.claude/architecture/architecture-deployment.md` populated | `architect` (Step 0.5) via `setup-init` or `update-arch --deployment` |
| `plugin-readiness` | All setup-status checks green, ICEA files present, security scan run | `setup-init`, `icea-feature`, `security-review` |
| `fix` | A finding with a fingerprint in the code-review ledger | `code-review` |
| `dismiss` | A finding with a fingerprint in any ledger | `code-review`, `security`, or `dynamic-scan` |
| `checkin` | Staged files, optional ICEA doc for compliance check | developer + `icea-feature` |
| `sync-dirs` | Manifest files present in the working directory | developer (auto-called by `setup-init`) |

**First-time setup order:**
1. `/setup-init` — creates memory, rules, architecture docs, and architecture-deployment.md
2. `/session-start` — verify setup and warm context
3. Then normal workflow: `icea-feature` → code → `checkin` → `pr-describe` → `pr-create`

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
