# ICEA — Hook-Enforced Migration Gates
ADO #9007 · Release 3 · Sprint 10
Status: ✅ Approved — 2026-10-02 (auto-approved on SAVE TECH)

---

## Intent

### Goal
Replace prose-only gate enforcement in the rewrite skill with Claude Code hooks so that a migration cannot advance past the options or design gates without the developer's explicit approval.

### Problem Statement
The rewrite skill presents its gates as mandatory checkpoints, but nothing enforces them except the model's willingness to follow prose. In the WCF to .NET 10 rewrite run, the model skipped Step 2 entirely and self-approved both human gates (`options_approved`, `design_approved`) using direct JSON writes and a CLI flag (`--reason=`) that the script rejects. Code was generated for a migration that had no approved options analysis or design documents — the developer never reviewed the design before clusters were generated. The 27 revision edits in the design phase are traced to the skipped options gate. Success = a freshly-initialized target project has both hooks registered, and a WCF migration rerun reaches APPROVE DESIGN with zero model-written human gates.

### Business Impact
Every migration run without gate enforcement risks generating code for an unreviewed design — wasted engineering effort and potential architectural defects reaching production. The WCF run's 27 feasibility revision edits (approximately 20.5K tokens of churn) demonstrate the downstream cost of a skipped options gate.

### Story
As a developer using the rewrite skill, I want gate enforcement to be mechanical rather than prose-only, so that a migration cannot advance past the options or design gates without my explicit approval — even if the model skips or misreads the skill instructions.

### Success Metrics
- A freshly-initialized target project (via `setup-init`) has both hooks (`approval-capture.cjs`, `migration-gate.cjs`) deployed and registered in `settings.json`.
- The WCF migration rerun produces zero model-written human gate entries (`options_approved`, `design_approved`) in the checkpoint file, and Step 2 runs before Step 2.5.

---

## Context

### Personas
**Developer:** Senior engineer running a WCF to .NET 10 migration · Has a working source application · Wants predictable gate behavior at every mandatory checkpoint · Frustrated when the model skips mandatory steps or silently self-approves gates · Success = clusters are never generated without first reviewing and approving the design.

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Hook | `_project-deploy/hooks/approval-capture.cjs` | new | UserPromptSubmit hook; recognizes APPROVE OPTIONS, PROCEED, APPROVE DESIGN, APPROVE CLUSTERS, SKIP CLUSTER; never blocks prompt; appends to `.claude/migration/ADO-NNN.approvals.json` and mirrors into ledger |
| Hook | `_project-deploy/hooks/migration-gate.cjs` | new | PreToolUse on Write/Edit/Bash; blocks gated paths until corresponding approval exists in approvals file; reads ADO from path pattern only (never from active-task.json); exits 2 on any error (fail-closed) |
| Script | `scripts/cluster-merge.cjs` | new | `prepare`: commits each cluster worktree, records branch-head SHA, writes `.claude/migration/ADO-NNN.pending-approval.json`; `merge`: checks cluster approval + SHA match + BAL merge gate before merging |
| Script | `scripts/intake-verify.cjs` | modify | Fix 1: reads `stage_gates.intake_context` tolerantly — flat string `'PASS'` or object `{ verdict: 'PASS', ... }`; `--skill` required on `check-gate` with no fallback (exit 10 if absent) |
| Skill | `skills/rewrite/SKILL.md` | modify | Replace ADO_ID placeholder with ADO placeholder throughout; record `target_root` in Step 0; write `design_judge` gate after judge pass in Step 2.5; fix ACKNOWLEDGED to PASS and BLOCK_OVERRIDE to PASS verdict strings; add Step 0 preflight checking hooks deployed+registered; remove model-written approval instructions; state approval grammar in developer prompts |
| Script | `scripts/setup-init-bootstrap.cjs` | modify | Deploy `approval-capture.cjs` and `migration-gate.cjs` to target project's `_project-deploy/hooks/`; register both in target `settings.json` |
| Config | `.claude/settings.json` (plugin) | modify | Add `UserPromptSubmit` and `PreToolUse` entries pointing at `_project-deploy/hooks/` for plugin dev sessions (Phase 0 spike and Phase 1 onward) |
| Test | `tests/intake-verify.test.cjs` | modify | Add `--skill=rewrite` to all existing `check-gate` calls; add test: missing `--skill` exits 10 with reason=skill-required; add test: CLI-created ledger with object-form gate exits 0 |
| Test | `tests/approval-capture.test.cjs` | new | All five approval forms; precondition failures (missing options.md, UNVERIFIED rows, unacknowledged PARTIAL rows); non-blocking on unrecognized input; plain APPROVE ADO-NNN not captured |
| Test | `tests/migration-gate.test.cjs` | new | All three write-gate rows; all Bash block patterns; fault-injection (hook crash exits 2); active-task.json deletion changes nothing |
| Test | `tests/cluster-merge.test.cjs` | new | `prepare` writes pending-approval file; `merge` refuses without approval, when SHA differs, and when BAL gate fails; merge of another cluster does not invalidate approval |

### Constraint Context
| Constraint | Type | Bounds the solution how? |
|---|---|---|
| CommonJS (`.cjs`) only — no ES modules | technical | All plugin scripts are CommonJS; hooks must be `.cjs` files invoked by `node` |
| Hooks must exit 2 to block; exit 1 is non-blocking in Claude Code | technical | Every gate hook catches all errors and exits 2; exit 1 would let writes through on a crash (drives AC-NF1) |
| Hooks must never read `.claude/active-task.json` for enforcement decisions | technical | Model writes `active-task.json`; trusting it for gate decisions lets the model switch enforcement off; hooks derive the ADO from path patterns only |
| ADO identifier normalization uses one shared function | technical | Both hooks and `cluster-merge.cjs` must agree on canonical form `ADO-<id>`; mismatched normalization creates dual ledgers (root cause of the ADO_ID placeholder defect) |
| Approvals file (`.claude/migration/ADO-NNN.approvals.json`) is append-only | technical | Single writer (`approval-capture.cjs`); append-only preserves the audit trail and prevents a write from overwriting a prior approval |

### Change Tier
**T2** — Two new hooks, one new script, and modifications to an existing skill and multiple scripts/tests. No external API calls, no infrastructure changes, no database schema changes. Reversible: hooks are removed by editing `settings.json`.

---

## Examples

### Happy Path — Design-document write blocked, then unblocked

| Given | When | Then (observable outcome) |
|---|---|---|
| Rewrite skill active for ADO-1234; `options_approved` not yet recorded in approvals file; `migration-gate.cjs` registered | Model calls Write tool targeting `docs/migrations/ADO-1234/target-component-architecture.md` | Hook exits 2; write blocked; error message states "options_approved required — reply APPROVE OPTIONS ADO-1234 with option letter" |
| Developer replies `APPROVE OPTIONS ADO-1234 B`; `ADO-1234-options.md` exists; no unacknowledged PARTIAL rows | `approval-capture.cjs` processes the reply | `options_approved` appended to `.claude/migration/ADO-1234.approvals.json`; gate mirrored into ledger; `additionalContext` confirms "Approval recorded: options_approved, ADO-1234, option B" |
| `options_approved` now in approvals file | Model calls Write tool targeting `target-component-architecture.md` | Hook exits 0; write proceeds |

### Edge Cases

| Given | When | Then (expected behaviour) |
|---|---|---|
| Ledger created by `checkpoint-ledger.cjs set-gate` with `--artifact-path` (writes object form with `verdict` field and metadata) | `intake-verify.cjs check-gate --skill=rewrite` runs | Reads `verdict` field from object; exits 0 (PASS) — does not treat the object itself as non-'PASS' |
| Developer replied `PROCEED ADO-1234 B` acknowledging `service-A` row by name; after that reply, a new `service-B` PARTIAL row appears in the inventory | Developer replies `APPROVE DESIGN ADO-1234` | Hook refuses; error message lists `service-B` as unacknowledged; developer must issue a new PROCEED covering `service-B` |
| `migration-gate.cjs` encounters an unexpected runtime error (e.g. missing Node.js require) | Any gated Write/Edit/Bash attempted | Catch-all exits 2; write blocked; error message surfaces the exception detail — hook never exits 0 or 1 on error |
| `APPROVE OPTIONS ADO-1234 B` reply arrives while no rewrite migration is active for that ADO (no checkpoint exists) | `approval-capture.cjs` processes the reply | Records nothing; returns reason "no rewrite checkpoint found for ADO-1234" |

### Error States

| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| `ADO-1234-options.md` does not exist | Developer replies `APPROVE OPTIONS ADO-1234 A` | `approval-capture.cjs` records nothing; returns: "APPROVE OPTIONS refused — ADO-1234-options.md not found; complete Step 2 first" |
| Integration inventory contains `unknown` / `UNVERIFIED` rows | Developer replies `APPROVE DESIGN ADO-1234` | Hook records nothing; returns list of UNVERIFIED rows; message: "APPROVE DESIGN refused — resolve or re-run the integration check for: [list]" |
| `intake-verify.cjs check-gate` called without `--skill` | Script runs | Exits 10; message: "`--skill` is required on `check-gate`; no fallback" |
| A cluster's branch head has changed since approval (developer edited cluster post-approval) | `cluster-merge.cjs merge --cluster=2` runs | Exits non-zero; message: "cluster-2 branch head differs from approved SHA — re-run APPROVE CLUSTERS ADO-1234 to re-approve" |

### Permission Boundary (mandatory)

| Given | When | Then (observable outcome) |
|---|---|---|
| Model (not developer) issues `checkpoint-ledger.cjs set-gate --gate=options_approved --verdict=PASS` via Bash tool | Bash tool call is made | `migration-gate.cjs` intercepts; exits 2; Bash call blocked; no approval state written; message: "options_approved is a human-only gate — use the APPROVE OPTIONS reply" |
| Model attempts to write `.claude/migration/ADO-1234.approvals.json` directly via Write tool | Write tool call is made | `migration-gate.cjs` intercepts; exits 2; write blocked; approvals file unchanged |
| Model attempts `node -e "...design_approved..." .checkpoint.json` to write gate state via Bash | Bash tool call matches pattern: `.checkpoint.json` paired with a protected gate name | Hook intercepts; exits 2; Bash call blocked; message: "direct checkpoint write of a protected gate is not permitted" |

---

## Acceptance

### Acceptance Criteria

- [ ] AC-F1: Writing `ADO-NNN-options.md` is blocked until `intake-verify.cjs check-gate --skill=rewrite` exits 0 AND `coupling-resolution-validate.cjs` exits 0 — verified by `migration-gate.cjs` hook test
- [ ] AC-F2: Writing any design document (`target-*.md`, `migration-feasibility.md`) under `docs/migrations/ADO-NNN/` is blocked until `options_approved` exists in `.claude/migration/ADO-NNN.approvals.json` — verified by hook test + WCF rerun
- [ ] AC-F3: Writing to `.claude/worktrees/ADO-NNN-cluster-*/**` or `target_root/**` is blocked until `design_approved` exists in the approvals file (enforcement path determined by D-1 spike result: hook enforcement if PreToolUse fires in subagents; merge-path enforcement otherwise) — verified by hook test; subagent coverage confirmed by Phase 0 spike
- [ ] AC-F4: The model cannot write protected gate state (`options_approved`, `design_approved`, `cluster_N_approved`) via `set-gate`, Write, Edit, or `node -e` — verified by `migration-gate.cjs` tests for each write route
- [ ] AC-F5: `APPROVE OPTIONS` is refused when `ADO-NNN-options.md` does not exist or unacknowledged PARTIAL rows exist; refused reply records nothing — verified by `approval-capture.cjs` tests
- [ ] AC-F6: `APPROVE DESIGN` is refused when any of the seven design documents is absent, `target_root` is not recorded, any `unknown`/`UNVERIFIED` integration row exists, or any PARTIAL row was not acknowledged by name — verified by `approval-capture.cjs` tests
- [ ] AC-F7: `APPROVE DESIGN` is accepted with PARTIAL rows only if each row was acknowledged by name via `PROCEED`; a PARTIAL row appearing after `PROCEED` is refused until re-acknowledged; `unknown`/`UNVERIFIED` rows always refuse regardless of PROCEED — verified by `approval-capture.cjs` tests
- [ ] AC-F8: A cluster merges only through `cluster-merge.cjs merge`, only if the cluster's approval exists, only if the branch head equals the approved SHA, and only if the BAL merge gate passes — verified by `cluster-merge.cjs` tests
- [ ] AC-F9: Plain `APPROVE ADO-NNN` (without OPTIONS/DESIGN/CLUSTERS qualifier) is never captured by `approval-capture.cjs` and continues to reach the `icea-approve` skill — verified by capture hook test
- [ ] AC-F10: A rewrite run that follows the skill instructions reaches the APPROVE DESIGN prompt, with `design_judge` gate recorded in the ledger after the Step 2.5 judge pass — verified by scripted run through Step 2.5
- [ ] AC-F11: Step 0 stops with "run `setup-init`" if either hook is not deployed and registered in the target project's `settings.json`; the REQUIRED_SCRIPTS preflight test fails if any script referenced from SKILL.md is missing from the `REQUIRED_SCRIPTS` block — verified by preflight test + Step 0 run with one hook removed
- [ ] AC-F12: `setup-init-bootstrap.cjs` deploys both hooks to the target project's `_project-deploy/hooks/` and registers them in the target `settings.json` — verified by setup-init test on a clean target project
- [ ] AC-NF1: Any hook error (uncaught exception, missing file, timeout) results in exit 2, never exit 0 or exit 1 — verified by fault-injection tests (simulate exception in hook process)
- [ ] AC-NF2: Hook enforcement does not depend on `.claude/active-task.json`; deleting or corrupting that file changes nothing about gate decisions — verified by hook test with active-task.json deleted
- [ ] AC-NF3: WCF migration rerun: zero model-written human gate entries; Step 2 runs before Step 2.5; hosting recorded before design phase; design-phase revision count recorded for comparison with the first run's 27 — verified by transcript + checkpoint review

### Out of Scope
- We will NOT build per-wave independent judge gates (F3) — this requires `set-judge`, per-wave plan rounds, and independent plan+implementation judges; deferred as a separate work item post v1 rerun.
- We will NOT reuse v1 hooks for the upgrade and replatform skills — patterns will be reused only after v1 is proven on rewrite; separate work items.
- We will NOT reduce SKILL.md size (priority 4) — this is a maintenance improvement, not a runtime fix; deferred to the "Later" follow-up.
- We will NOT build `artifact-gate.cjs` (F3 wrapper) — hooks alone stop the WCF failure class; the wrapper is a correctness improvement for paths v1 makes reachable for the first time.
- We will NOT require `--skill` on `init` (F3 hygiene) — requiring `--skill` on `check-gate` is the runtime fix; `init` change is a separate hygiene item deferred to F3.

### Assumptions
- PreToolUse hooks registered in `settings.json` fire for tool calls inside subagents on the deployed Claude Code version — **unverified** (Phase 0 spike required before Phase 2 design; if false, AC-F3 enforcement falls back to the merge path, see D-1)
- Exit code 2 from a PreToolUse hook blocks the action; exit code 1 does not — **unverified** (to be confirmed in Phase 0 spike; all hooks are written to exit 2 on any error regardless)
- `checkpoint-ledger.cjs set-gate` writes `stage_gates` as an object with `verdict` and metadata fields when `--artifact-path` is supplied — **verified** (DECISION comment in `checkpoint-ledger.cjs` lines 88-96)
- ADO normalization has no existing shared implementation — **verified** (new utility required)

### Open Questions
None — all architectural decisions resolved in `docs/plans/migrationSkill/rewrite-hook-gates-v1.md`.

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| Hook crash or timeout lets a write through | L | H |
| PreToolUse does not fire in subagents on deployed Claude Code version | M | M |
| Indirect Bash writes (cp, variable expansion into target_root) bypass Bash pattern checks | L | L |

**Pre-mortem:** "This shipped and the WCF rerun still had model-written gates." Most likely failure: (1) the SKILL.md Phase 3 changes still contain instructions telling the model to write gate state, or (2) `migration-gate.cjs` Bash block pattern misses a specific `node -e` form used by the model. Mitigation: AC-F4 tests every write route (`set-gate`, Write, Edit, `node -e`) in isolation before the rerun.

### Dependencies
- Blocked by: Fix 1 (`intake-verify.cjs` tolerant reader) must land before `migration-gate.cjs` is enabled — otherwise intake re-validation breaks all rewrite runs whose ledgers were written with object-form gates
- Blocked by: ADO_ID to ADO placeholder fix in SKILL.md must land before hooks are enabled — dual ledger breaks hook path matching
- Blocked by: `design_judge` gate write must land before Phase 3 rerun — without it, a run that follows the skill can never reach APPROVE DESIGN
- Blocks: F2 (reduce revision cost) — requires the AC-NF3 measurement (design-phase edit count) from the Phase 3 WCF rerun
- Blocks: F3 (remaining defects + judge independence) — requires v1 proven on rerun before F3 scope is finalized

### Irreversibility Flags
None identified — hooks are additive (both `settings.json` entries and deployed hook files can be removed cleanly); no shared ledger schema changes in v1; no database migrations.

### D-Blocks

**D-1 — AC-F3 enforcement strategy when PreToolUse does not fire in subagents**

The enforcement of AC-F3 (blocking writes to cluster worktrees / `target_root` until `design_approved`) depends on whether PreToolUse hooks fire for tool calls inside cluster-generation subagents.

**Option A — Hook enforcement (`migration-gate.cjs` row 3)**
`migration-gate.cjs` blocks Write/Edit/Bash to worktree paths and `target_root` at tool-call time. Covers subagent writes at the point of generation — the model cannot write the artifact, not just merge it.
Choose this when: Phase 0 spike confirms PreToolUse fires in subagents (either all tool calls, or at minimum Write/Edit/Bash).

**Option B — Merge-path enforcement (`cluster-merge.cjs merge` gate only)**
Worktree writes are allowed; the merge into `target_root` is blocked by `cluster-merge.cjs merge` until `design_approved` and `APPROVE CLUSTERS` both exist. The write happens before approval; the merge into the target does not.
Choose this when: Phase 0 spike confirms PreToolUse does not fire for subagent tool calls — hook enforcement would silently not apply, making Option A's row 3 theater.

**Recommendation: Option A as primary, Option B as second layer regardless.**
Repo evidence: existing plugin hooks (`icea-floor.cjs`, `context-guard.cjs`, `context-budget-tech-write.cjs`) all use PreToolUse and are confirmed to block direct tool calls. The WCF run's failure route was a Bash tool call (`node -e … .checkpoint.json`) — the same tool class that Option A's Bash block catches and Option B does not intercept at all. Both paths are implemented in parallel (Phase 1 and Phase 2 are both Must Have); the spike determines whether Option A also enforces subagent writes. If the spike fails, AC-F3 protection is merge-time only and this gap is recorded in the migration log.

**Decision: ____ (awaiting Tech Lead selection)**
Selection reply: `OPTION A` | `OPTION B` | `DIRECT <approach>`
Note: both options are built regardless of selection (Phase 1 = migration-gate.cjs; Phase 2 = cluster-merge.cjs). Selection here governs which path is the documented primary enforcer for AC-F3.

---

## Story Breakdown

**Type:** EPIC
**Total SP:** 18

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 — Phase 0 Prerequisites | TBD | `intake-verify.cjs` tolerant reader + `--skill` required on check-gate; ADO_ID placeholder replaced with ADO placeholder in SKILL.md; `target_root` recorded in Step 0; `design_judge` gate written in Step 2.5; verdict string fixes; Phase 0 subagent hook spike recorded | 5 | Yes — unblocks AC-F10 and AC-F11; fixes latent WCF defects | None | ⏳ Pending |
| 2 — Phase 1 Options + Design gates | TBD | `approval-capture.cjs` (options, proceed, design); `migration-gate.cjs` rows 1-2; ADO normalization function; plugin `settings.json` entries; REQUIRED_SCRIPTS preflight test; hook tests | 5 | Yes — MVP: stops WCF failure class at design-document write | Story 1 | ⏳ Pending |
| 3 — Phase 2 Cluster write gate | TBD | `cluster-merge.cjs` (prepare + merge); APPROVE CLUSTERS / SKIP CLUSTER capture; `migration-gate.cjs` row 3 (D-1 path selected); resume guard changes; `cluster-merge.cjs` tests | 3 | Yes — cluster writes gated end-to-end | Story 2 | ⏳ Pending |
| 4 — Phase 3 Skill + rollout | TBD | SKILL.md changes (approval grammar in developer prompts; PARTIAL-rule amendment; Step 0 hook preflight); `setup-init-bootstrap.cjs` hook deployment. Exit condition / verification: WCF rerun verifying AC-NF3 (not a deliverable produced by this story) | 5 | Yes — V1 complete; all 15 ACs verified on rerun | Story 3 | ⏳ Pending |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
2026-10-02 — Initial draft from ADO-9007 approved plan (critic: PASS WITH NOTES — AC-F3 D-1 enforcement path noted inline; Story 4 scope clarified to distinguish deliverables from WCF rerun verification)
2026-10-02 — D-1 updated to icea-decisions-spec §3 format: Recommendation with repo evidence added (existing PreToolUse hooks precedent; WCF Bash failure route); Decision line added as "awaiting Tech Lead selection"
