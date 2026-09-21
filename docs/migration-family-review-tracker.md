# Migration Family Audit — Findings Tracker

**Status: In-Progress**
_Change to **Implemented** when all items are Done._

_Second-pass technical review incorporated 2026-09-21. Items A12–A22, B5–B10, and Category C are from this review; A1–A11 and B1–B4 are from the original audit._

_Recorded 2026-09-21 from a cross-skill audit of the three-skill migration family (Upgrade · Rewrite · Replatform). Issues are grouped by category with severity. Each item needs its own ICEA (`/icea-feature`) before any implementation work._

---

## Review process

We will review **one item at a time**. For each item, discuss:

1. What the issue is
2. What happens if it remains unresolved
3. Tradeoffs
4. Solution options
5. What must be changed
6. Residual risk after the fix
7. How to verify the fix works
8. Architect/developer argument and review
9. Approval before implementation

Once approved, create the required ICEA where applicable, implement the change, show the result for review, update this tracker, and then proceed to the next item.

---

## Summary

| Category | Count | Severity |
|---|---:|---|
| A: Silent Failures | 22 | 8 P0 · 12 P1 · 2 P2 |
| B: Long-Context Risks | 10 | 2 P0 · 8 P1 |
| C: Migration Family Inconsistencies | 4 | 4 P1 |
| D: Template Sync Gaps | 2 | 2 P2 |
| **Total** | **38** | **10 P0 · 24 P1 · 4 P2** |

---

## A — Silent Failures

| ID | Severity | Status | Short description | First action | Effort |
|---|---|---|---|---|---:|
| A1 | P0 | Done | Upgrade intake gate is checked too late; manual report gate can bypass it | ICEA for Upgrade Step 3 hardening | ~2 SP |
| A2 | P0 | Open | Missing/corrupt checkpoint JSON is not surfaced clearly at resume | Add resume preflight and gate script calls until init | ~2 SP |
| A3 | P0 | Open | Rewrite allows concurrent checkpoint writes under multi-session access | Add exclusive checkpoint lock; superseded by stronger A21 design if adopted | ~3 SP |
| A4 | P1 | Open | Tracker updates are advisory and not verified before phase advance | Validate tracker Next action at phase start | ~1 SP |
| A5 | P1 | Open | Migration log initialization is not read-back verified before append | Verify expected file/header immediately after write | ~1 SP |
| A6 | P1 | Open | PARTIAL integration rows are advisory at Options but hard-block at Design without prominent warning | Add warning at APPROVE OPTIONS; consider threshold | <1 SP |
| A7 | P1 | Open | DAG cycle is not revalidated immediately before cluster spawn | Run decompose check-only before worktree creation | <1 SP |
| A8 | P1 | Open | Strategy tokens are embedded into subagent prompts without placeholder validation | Reject unresolved `{UPPER_CASE}` tokens after resolve | <1 SP |
| A9 | P1 | Open | Judge verdicts are recorded but not required to be acknowledged before proceeding | Add explicit acknowledgement gate for REVISE/BLOCK | ~3 SP |
| A10 | P2 | Open | Missing and empty manifests share ambiguous exit code 2 | Separate missing and empty exit codes | <1 SP |
| A11 | P2 | Open | Retried subagents can duplicate migration log entries | Hash/deduplicate event entries before append | ~1 SP |
| A12 | P0 | Open | `source.roots` is documented but not persisted by `coreEnvelope()` | Add roots to ledger initialization and validate against expected roots | ~1 SP |
| A13 | P0 | Open | `upgrade-checkpoint.cjs` silently ignores unknown CLI flags | Reject unknown options or accept validated JSON patch | ~1 SP |
| A14 | P0 | Open | Replatform uses unsupported `--namespace`/`--payload` flags | Correct all call sites and add persistence integration test | <1 SP |
| A15 | P0 | Open | `check-gate` is a weaker reimplementation of `verify` | Refactor both modes to call one verification function | ~2 SP |
| A16 | P0 | Open | `source_context.skill` is not stored; deep Rewrite/Replatform checks can be skipped | Persist or explicitly pass skill to `check-gate` | <1 SP |
| A17 | P1 | Open | Missing `additionalDirectories` roots are silently skipped | Fail closed or require explicit out-of-scope decision | ~1 SP |
| A18 | P1 | Open | Root coverage uses permissive substring matching | Parse structured root coverage rows | ~2 SP |
| A19 | P1 | Open | Glob citations bypass existence and line validation | Prohibit or expand and validate globs | ~1 SP |
| A20 | P1 | Open | Module accounting can count headers/summary rows as modules | Parse strict module-accounting table | ~2 SP |
| A21 | P1 | Open | Ledger writes are non-atomic and have no revision guard | Temp-write + fsync + atomic rename + revision checking | ~2 SP |
| A22 | P1 | Open | Rewrite/Replatform working-directory assumptions make source/target roots ambiguous | Require explicit `--source-root` | <1 SP |

### A1 — Intake gate bypass (upgrade only)

**Skill:** `upgrade/SKILL.md`

**Status:** Done

**What failed:** The intake verification check was described at Step 8, so the normal report-ready path in Step 3/Step 4 was not explicitly fail-closed before presenting report approval/ready prompts.

**Approved solution implemented:**
- Add an explicit Step 3 authoritative fail-closed check before Step 4 readiness/approval prompt:
  - `node "$PLUGIN_DIR/scripts/intake-verify.cjs" check-gate --ado={ADO} --json`
  - If non-zero: stop and do not present report-ready / APPROVE REPORT prompt.
- Keep Step 8 guard and hard rule as checkpoint-level belt-and-suspenders enforcement for direct/manual calls (`upgrade-checkpoint.cjs set-gate/set-payload` report PASS path).

**Residual risks (explicit):**
- Broader shared state-machine enforcement remains deferred to **C2/C3**.
- `check-gate` implementation divergence remains subject to **A15** until verify/check-gate unification.
- Unknown CLI flag handling remains **A13**.

**Verification evidence:**
- Focused test updated to assert fail-closed behavior before intake PASS and success after valid intake setup:
  - `tests/upgrade-checkpoint.test.cjs`
- Executed: `node tests/upgrade-checkpoint.test.cjs`
  - Result: `15 passed · 0 failed`.
- Implementation files:
  - `skills/upgrade/SKILL.md`
  - `tests/upgrade-checkpoint.test.cjs`
- Implementation commit reference: _pending (working tree changes on branch `MigrationFamilyIssues`)_.

### A2 — Checkpoint JSON corruption not surfaced at resume

**Skill:** all skills; `checkpoint-ledger.cjs`; `migration-ledger-schema.md`

**What fails:** Missing or corrupt checkpoint state is not surfaced early and downstream scripts fail late.

**Fix:** Emit a clear warning and gate script invocations until ledger initialization is confirmed.

### A3 — Concurrent checkpoint writes under multi-session access

**Skill:** Rewrite; `checkpoint-ledger.cjs`

**What fails:** The documented single-writer assumption is not enforced.

**Fix:** Add an advisory lock or use the stronger atomic/revision design in A21. A21 supersedes this as the primary fix if implemented.

### A4 — Tracker update is advisory, not gated

**Skill:** all skills

**What fails:** A stale `Next action` field can disorient resume.

**Fix:** Read and validate the tracker before advancing each phase.

### A5 — Migration log init not verified before first append

**Skill:** all skills

**What fails:** A failed log write can leave chat-only entries with no durable history.

**Fix:** Verify file existence and expected header immediately after initialization.

### A6 — PARTIAL integration rows warning

**Skill:** Rewrite

**What fails:** The developer may approve Options without realizing unresolved PARTIAL rows will block Design.

**Fix:** Display a clear warning at the Options gate; optionally block above a defined threshold.

### A7 — DAG cycle check not revalidated at cluster spawn

**Skill:** Rewrite

**What fails:** Manual design changes can introduce a cycle after the original validation.

**Fix:** Run a final cycle check before creating worktrees.

### A8 — Strategy tokens not revalidated inside subagents

**Skill:** Rewrite

**What fails:** Literal placeholders such as `{BUILD}` can reach subagents and produce opaque command failures.

**Fix:** Validate all resolved tokens and reject unresolved placeholders.

### A9 — Judge verdicts recorded but not required

**Skill:** Rewrite, Replatform

**What fails:** REVISE/BLOCK verdicts can be logged without explicit acknowledgement.

**Fix:** Require an explicit acknowledgement before allowing a gated step to proceed when the judge does not PASS.

### A10 — Empty manifest returns ambiguous exit 2

**Skill:** `intake-verify.cjs`

**What fails:** Missing and empty manifests are indistinguishable.

**Fix:** Use distinct exit codes and update callers.

### A11 — Log entry duplication on subagent retry

**Skill:** all skills; Rewrite orchestrator

**What fails:** Retries can append duplicate findings and decisions.

**Fix:** Hash event headers/content and skip already-recorded events.

### A12 — `source.roots` not persisted by `coreEnvelope()`

**Skill:** all skills

**What fails:** Multi-root provenance is missing from newly initialized ledgers.

**Fix:** Add roots to `coreEnvelope()`, pass detector roots from all skills, and validate roots against `source_context.roots_expected` before intake PASS.

### A13 — Upgrade checkpoint silently ignores unknown CLI flags

**Skill:** Upgrade

**What fails:** Flags such as `--report-path` and `--proceed-after-report` can be accepted by the shell but discarded by the adapter.

**Fix:** Reject unknown flags or replace custom parsing with a validated JSON patch contract.

### A14 — Replatform uses unsupported ledger flags

**Skill:** Replatform

**What fails:** `--namespace` and `--payload` are not implemented by the generic ledger CLI, so payload fields may not be recorded.

**Fix:** Use `--skill`, `--ado`, and `--payload-json`; add an integration test.

### A15 — `check-gate` is a weakened reimplementation of `verify`

**Skill:** all skills; `intake-verify.cjs`

**What fails:** Revalidation omits important checks such as dangling citations, reachable PARTIAL integrations, unwired dependencies, and row-level grounding.

**Fix:** One shared verification function must serve both `verify` and `check-gate`.

### A16 — `source_context.skill` not stored

**Skill:** Rewrite, Replatform

**What fails:** Deep cross-cutting validation can be skipped because the revalidation code cannot identify the skill.

**Fix:** Persist the skill explicitly or pass it to `check-gate`. Explicit argument is preferred over relying on top-level last-writer state.

### A17 — Missing configured roots silently skipped

**Skill:** all skills; `intake-verify.cjs`

**What fails:** Deleted, unmounted, or stale configured dependency roots disappear from the validation denominator.

**Fix:** Fail closed unless an explicit out-of-scope decision records the reason and assurance consequence.

### A18 — Root coverage matching too permissive

**Skill:** all skills

**What fails:** Generic path segments can satisfy coverage accidentally.

**Fix:** Require parsed `ROOT_ID`, normalized path, and status fields.

### A19 — Glob citations bypass validation

**Skill:** all skills

**What fails:** A citation such as `src/**/*.cs#L999999` can pass without matching a file or line.

**Fix:** Prohibit globs for provenance, or expand them and validate matches/line numbers. Behavior evidence must use concrete file#line citations.

### A20 — Module accounting inflated by headers and summaries

**Skill:** all skills

**What fails:** Word-search counting can inflate mapped/out-of-scope totals and accept non-module rows.

**Fix:** Parse a strict `module_id | disposition | source_citations | rationale` table with duplicate/unknown/missing checks.

### A21 — Ledger writes not atomic or revision-guarded

**Skill:** all skills; `checkpoint-ledger.cjs`

**What fails:** Crashes or concurrent writes can corrupt JSON or silently lose updates.

**Fix:** Read, validate revision, write temp, fsync, atomic rename, and reject stale revisions. This supersedes A3 as the primary safety mechanism if adopted.

### A22 — Rewrite/Replatform working-directory ambiguity

**Skill:** Rewrite, Replatform

**What fails:** Current working directory can be confused with source or target, causing the wrong tree to be scanned.

**Fix:** Require an explicit `--source-root`; reject unsafe source-root/current-directory combinations.

---

## B — Long-Context Risks

| ID | Severity | Status | Short description | First action | Effort |
|---|---|---|---|---|---:|
| B1 | P0 | Open | Large integration inventory is embedded in every design-doc subagent | Partition inventory by ownership above threshold | ~3 SP |
| B2 | P1 | Open | Source-context manifest is read twice in the main session | Cache compact summary in checkpoint | ~2 SP |
| B3 | P1 | Open | Specs are independently reloaded by subagents without orchestrator preflight | Preflight required spec files before spawning | <1 SP |
| B4 | P1 | Open | Plugin scripts are not existence-checked before invocation | Add per-skill script preflight | ~1 SP |
| B5 | P0 | Open | Rewrite context budget estimates contradict each other | Replace with deterministic file/byte budgets | ~1 SP |
| B6 | P0 | Open | Migration log grows without bound and is fully loaded on resume | Split into index/events/lessons/judgments | ~5 SP |
| B7 | P1 | Open | Step 2.5 lacks per-document resumability | Add document-level checkpoint state | ~3 SP |
| B8 | P1 | Open | Full cluster instructions are copied into every subagent prompt | Use a versioned execution contract | ~3 SP |
| B9 | P1 | Open | Cluster results are passed as shell JSON strings | Write and validate result files | ~2 SP |
| B10 | P1 | Open | Source scan truncation is not surfaced as an assurance limitation | Emit scan metadata and gate incomplete scans | ~2 SP |

### B1 — Integration inventory unbounded in design-doc subagents

**Skill:** Rewrite

Large inventories are passed to multiple design subagents. Partition by ownership above a defined threshold and warn when the full inventory is large.

### B2 — Source-context manifest read twice

Cache line count, PARTIAL count, coverage verdict, and other compact summary data in the checkpoint so later checks do not require re-injecting the full manifest.

### B3 — Spec files not preflighted

Verify all required spec paths before spawning design-document subagents. Fail at orchestrator level, not inside a subagent.

### B4 — Plugin scripts not existence-checked

Add a shared preflight for every script required by the selected skill before analysis or subagent work begins.

### B5 — Rewrite context budget estimates contradict each other

Replace incompatible token estimates and subjective “session feels slow” rules with deterministic file, byte, row, prompt, and artifact limits.

### B6 — Migration log grows without bound

Keep full history, but split the current tracker from indexed event details, lessons, and judge outputs. Resume should load only the tracker, ledger, active gate artifacts, current cluster, and compact decision summary.

### B7 — Step 2.5 not safely resumable mid-document

Persist document-level status, active document, dependency readiness, and revision wave. Each design document should be independently resumable and gated.

### B8 — Full cluster instructions copied into every prompt

Replace copied procedural prose with a versioned JSON execution contract containing cluster identity, profile, required inputs, allowed outputs, and gates.

### B9 — Cluster results passed as shell JSON strings

Write `.claude/migration/{ADO}/clusters/{N}/result.json`, validate it against a schema, then apply only validated fields to the ledger.

### B10 — Source scan truncation not surfaced

Expose file/depth/size/read-error counters and a `coverage_status`. Incomplete scans should cap assurance or block Options until explicitly accepted with a written reason.

---

## C — Migration Family Inconsistencies

| ID | Severity | Status | Short description | First action | Effort |
|---|---|---|---|---|---:|
| C1 | P1 | Open | Upgrade lacks durable Step 0 | Initialize log, tracker, and ledger before analysis | ~1 SP |
| C2 | P1 | Open | Resume behavior is documented but not centrally enforced | Implement deterministic legal state transitions | ~3 SP |
| C3 | P1 | Open | Arbitrary gate names/verdicts are accepted | Add per-skill gate/verdict registries | ~1 SP |
| C4 | P1 | Open | Test-plan failure is non-blocking for completion | Show PASS WITH TEST-PLAN GAP; hard-block high-risk classes | ~1 SP |

### C1 — Upgrade lacks durable Step 0

Upgrade should initialize the log, tracker, and ledger before detection, classification, or tool preflight, and record early-stop results durably.

### C2 — Resume behavior not centrally enforced

The shared ledger should enforce legal per-skill state transitions and preconditions instead of relying only on prose.

### C3 — Arbitrary gate names and verdicts accepted

Validate gate names against per-skill registries and verdicts against `PASS | REVISE | BLOCK | NOT_STARTED`.

### C4 — Test-plan generation failure is non-blocking

Completion should say `PASS WITH TEST-PLAN GAP` when absent. For B-series, regulated, financial, healthcare, and production migrations, missing test plans should block completion.

### Follow-up (deferred) — C2/C3 shared state-machine enforcement

**Status:** Deferred (not implemented in A1 scope)

**Deferred scope to generalize centrally across migration family:**
- Gate preconditions (e.g., intake PASS required before report PASS).
- Per-skill gate registries (allowed gate names).
- Verdict validation (`PASS | REVISE | BLOCK | NOT_STARTED` and skill-specific constraints).
- Legal state transitions for resume/advance paths.

**Reason deferred now:** A1 is scoped to fail-closed hardening for Upgrade Step 3 and checkpoint-level report PASS protection only; shared ledger/state-machine design work remains tracked under C2/C3.

---

## D — Template Sync Gaps

| ID | Severity | Status | Short description | First action | Effort |
|---|---|---|---|---|---:|
| D1 | P2 | Open | Four release metrics/lessons handlers are missing from `_project-deploy/CLAUDE.md` | Add handlers with matching descriptions | <30 min |
| D2 | P2 | Open | `APPROVE CONFIG` exists in the deploy template but not main `CLAUDE.md` | Decide canonical behavior and synchronize | <30 min |

### D1 — Missing handlers in deploy template

Add:

- `METRICS RELEASE-{N}`
- `METRICS RELEASE-{N} SPRINT-{S}`
- `METRICS RELEASE-{N} VS RELEASE-{M}`
- `LESSONS RELEASE-{N}`

with the same descriptions as the main `CLAUDE.md`.

### D2 — `APPROVE CONFIG` variance

Review whether the handler is intentional for deployed projects. If intentional, document the scope in the main file; if stale, remove it from the deploy template.

---

## Recommended Fix Order

| Order | Item(s) | Description | Effort |
|---:|---|---|---:|
| 1 | A13 + A14 | Reject unknown CLI arguments and correct Replatform persistence flags | <1 SP |
| 2 | A15 + A16 | Unify `verify` and `check-gate`; persist/pass skill | ~2 SP |
| 3 | A17 | Fail closed on missing configured roots | ~1 SP |
| 4 | A12 + C2 + C3 + A21 | Ledger schema, validation, state, and revision integrity | ~3 SP |
| 5 | A21 | Atomic writes with revision field | ~2 SP |
| 6 | B6 | Indexed migration log summaries | ~5 SP |
| 7 | B7 | Per-document Step 2.5 resumability | ~3 SP |
| 8 | B10 | Expose source scan truncation | ~2 SP |
| 9 | A18 | Structured root coverage | ~2 SP |
| 10 | A19 | Reject/validate glob citations | ~1 SP |
| 11 | A20 | Strict module-accounting table | ~2 SP |
| 12 | A22 | Explicit `--source-root` | <1 SP |
| 13 | B5 | Deterministic Rewrite budgets | ~1 SP |
| 14 | B8 | Versioned cluster execution contract | ~3 SP |
| 15 | B9 | Cluster result files/schema | ~2 SP |
| 16 | C1 | Upgrade durable Step 0 | ~1 SP |
| 17 | C4 | Test-plan completion gate | ~1 SP |
| 18 | A6 | PARTIAL rows warning | <1 SP |
| 19 | A7 | DAG cycle re-check | <1 SP |
| 20 | A8 | Strategy token validation | <1 SP |
| 21 | B3 | Spec-file preflight | <1 SP |
| 22 | B4 | Script existence preflight | ~1 SP |
| 23 | A4 | Tracker update warning | ~1 SP |
| 24 | A5 | Migration log write-back verification | ~1 SP |
| 25 | A10 | Distinct manifest exit codes | <1 SP |
| 26 | A11 | Log deduplication | ~1 SP |
| 27 | B2 | Manifest summary cache | ~2 SP |
| 28 | A2 | Missing checkpoint resume preflight | ~1 SP |
| 29 | A1 | Upgrade Step 3 intake hard block | ~1 SP |
| 30 | B1 | Integration inventory partitioning | ~3 SP |
| 31 | A9 | Judge verdict acknowledgement | ~3 SP |
| 32 | A3 | Concurrent checkpoint lock; reconsider after A21 | ~1 SP |
| 33 | D1 | Deploy-template handlers | <30 min |
| 34 | D2 | `APPROVE CONFIG` canonicalization | <30 min |

---

## Item review records

Use this template for the active item:

### Review record — [ITEM ID]

- **Status:** Open / In Discussion / Approved / Implementing / Review / Done / Deferred
- **Issue:**
- **Impact if unresolved:**
- **Tradeoffs:**
- **Solution options:**
- **Agreed solution:**
- **Residual issue after resolution:**
- **Verification plan:**
- **Discussion notes:**
- **Approval:**
- **ICEA:**
- **Implementation PR/commit:**
- **Verification evidence:**
- **Date completed:**
