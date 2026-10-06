# Migration Skill — Hook-Enforced Gates (Rewrite v1)

**Status:** Planned — ready for ICEA; no open decisions
**Recorded:** October 1, 2026
**Origin:** Review of `skill-loader-architecture.md` and evidence from the WCF → .NET 10 API rewrite run
**Affects:** `skills/rewrite/SKILL.md`, `scripts/intake-verify.cjs`, `tests/intake-verify.test.cjs`,
`scripts/setup-init-bootstrap.cjs`, the plugin's `.claude/settings.json`, `docs/plans/migrationSkill/rewrite.md`;
new: `_project-deploy/hooks/migration-gate.cjs`, `_project-deploy/hooks/approval-capture.cjs`,
`scripts/cluster-merge.cjs`
**Supersedes:** the priority order in `skill-loader-architecture.md` (see "What this changes")

---

## Summary

The rewrite skill presents its gates as mandatory, but nothing enforces them except the model's
willingness to follow prose. In the WCF run the model had the full skill in context, skipped Step 2
entirely and approved both human gates itself. This plan moves gate enforcement out of prose and into
Claude Code hooks and scripts:

- **Machine gates** are re-validated by a script before any gated write is allowed.
- **Human gates** are written only from the developer's own message. The model can ask for approval;
  it cannot grant it.
- **Step order** is enforced by requiring each artifact's predecessor gate before the artifact can be
  written.

---

## Evidence from the WCF run

All facts below come from the session transcript and checkpoint of the run.

| Observation | Evidence |
|---|---|
| The full SKILL.md was in context, including the Hard Rules | A unique line from the end of the file appears in the transcript; no Skill tool call; the one `Read` of SKILL.md was a secondary read |
| Step 2 never ran | `{ADO}-options.md` does not exist; no Read, Edit or Write of it in the transcript |
| The intake check never ran | 0 occurrences of `check-gate --ado` |
| APPROVE OPTIONS and APPROVE DESIGN were never given by the developer | Neither phrase appears in the transcript |
| The model wrote both human gates itself | Checkpoint holds `options_approved: PASS` and `design_approved: PASS` as flat strings; transcript shows `set-gate … --reason=` (a flag the CLI rejects) and direct JSON assignment (`design_approved = true`) via `node -e` |
| The model did not run the skill's own commands | Gates lack the artifact metadata the skill's commands include; `skill: null` although the skill's `init` passes `--skill=rewrite` |
| Hosting was never asked before design | IIS on-prem first appears at transcript line 367, during feasibility revisions |
| Most design-phase context cost was revision churn | `migration-feasibility.md`: 4 Reads (~10.8K tokens) + 27 Edits (~9.8K tokens); edits 3–15 followed the hosting change |
| SKILL.md itself was a minor runtime cost | One secondary Read (~4.8K tokens) |

**Root cause of the skipped steps: unknown.** Candidates: the model improvised commands instead of
executing the skill's blocks; Step 2.5 has no entry check, so nothing noticed Step 2 was missing; the
model did not stop at step boundaries; the intake check's placement inside Step 2. The plan does not
depend on which candidate is true — hooks enforce the gates regardless.

---

## What this changes

`skill-loader-architecture.md` assumed the runtime problem was SKILL.md's size. The run shows the
runtime problem is unenforced gates, and that skipped gates cause the expensive revision churn
downstream. Revised priority:

1. Enforce gates with hooks and scripts (this plan's v1, Phases 0–3).
2. Reduce document re-reads and revision cost (follow-up F2).
3. Fix the remaining defects and make judging independent (follow-up F3).
4. Reduce SKILL.md size — a maintenance improvement, not a runtime fix (follow-up "Later").

The loader, YAML specs and extraction agent are not pursued. If SKILL.md is later reduced, it is done
by moving templates and deterministic bash into `references/` and scripts.

**This document is the plan of record.** `skill-loader-architecture.md` is not updated in parallel; it
receives a short status note pointing here, so the two plans cannot drift apart.

---

## Design principles

- **Machine gates are re-validated, never trusted.** A hook runs the validating script; a stored
  `PASS` alone is not sufficient.
- **Human gates have one writer: the developer's message.** A `UserPromptSubmit` hook records the
  approval. The model is blocked from writing approval state through any tool.
- **Approvals bind to what was shown.** An approval records the option letter, the acknowledged
  PARTIAL rows, the target folder or the cluster commit SHAs the developer saw.
- **Hooks fail closed.** Claude Code treats a hook's exit code 1 as non-blocking, so a crash would let
  the write through. Every gate hook catches all errors and exits 2.
- **Hooks never rely on model-written state to decide whether to enforce.** In particular, the ADO is
  never read from `.claude/active-task.json`: the model writes that file, so a missing or wrong entry
  would switch enforcement off. Approval entries carry no "human" flag either — anything able to write
  the file could set it. Protection comes from blocking writes to the file.
- **The shared ledger substrate is unchanged.** Approvals live in a separate file. The capture hook
  mirrors them into the ledger so existing readers (STATUS, resume, `validate-artifacts`) keep working.

---

## Scope — v1

### 1. Prerequisites

| Item | Change |
|---|---|
| Fix 1 | `intake-verify.cjs check-gate` reads `stage_gates.intake_context` tolerantly — flat string or `{ verdict }` object. New test creates its ledger with `checkpoint-ledger.cjs set-gate --artifact-path…`, the same call Step 1.5 makes; the existing flat-string test stays |
| `--skill` on intake check | `intake-verify.cjs check-gate --skill=<skill>` selects the payload. **No fallback:** if `--skill` is absent, exit 10. The current `led.skill \|\| 'upgrade'` fallback is removed — `led.skill` was null in the run and is the last writer in shared journeys |
| Target folder recorded | Step 0 records the developer-provided target folder: `set-payload --key=target_root` |
| `design_judge` written | Step 2.5 checks `design_judge` before showing APPROVE DESIGN, but nothing writes it, so a run that follows the skill can never reach APPROVE DESIGN. After the design judge pass, the orchestrator records it with `set-gate --gate=design_judge --verdict={PASS\|REVISE\|BLOCK}`. Acknowledgements and overrides are recorded as separate gates with verdict PASS (e.g. `design_judge_acknowledged`), not as `ACKNOWLEDGED` or `BLOCK_OVERRIDE`, which `check-gate` does not recognize |
| One ADO placeholder | SKILL.md mixes `--ado={ADO}` (Step 0 `init`, most gates) and `--ado={ADO_ID}` (the "Flush checkpoint" blocks in Steps 1–5). The ledger file name is derived from `--ado`, so if the two placeholders resolve to `ADO-1234` and `1234`, the skill writes two separate ledgers and each sees only part of the state. Use one placeholder throughout, resolving to `ADO-<id>` (the WCF run's ledger is `.claude/migration/ADO-<id>.checkpoint.json`). The WCF run produced a single ledger, but it did not run the skill's flush commands, so the defect is latent, not disproved |
| Spike: hooks in subagents | Confirm that a PreToolUse hook in project `settings.json` fires for tool calls inside a subagent (see "Verification items") |

### 2. `approval-capture.cjs` — UserPromptSubmit

Never blocks the prompt. Recognizes these replies:

| Reply | Records | Accepted only if |
|---|---|---|
| `APPROVE OPTIONS ADO-{ID} {A\|B\|C}` | `options_approved` + option letter | `{ADO}-options.md` exists; the integration inventory has no PARTIAL rows |
| `PROCEED ADO-{ID} {A\|B\|C}` | `options_approved` + option letter + the list of PARTIAL rows acknowledged, by service name | `{ADO}-options.md` exists |
| `APPROVE DESIGN ADO-{ID}` | `design_approved` + `target_root` | The seven design documents below exist; `target_root` is recorded; the integration inventory has no `unknown`/UNVERIFIED rows; every PARTIAL row currently in the inventory is in the acknowledged list |
| `APPROVE CLUSTERS ADO-{ID}` | `cluster_{N}_approved` + approved commit SHA, for each cluster in the pending-approval file | A pending-approval file exists for that ADO |
| `SKIP CLUSTER ADO-{ID} {N}` | Removes cluster N from that ADO's pending-approval file | A pending-approval file exists for that ADO |

`APPROVE ADO-{ID}` is not used for clusters: CLAUDE.md routes that reply to the `icea-approve` skill.
A distinct keyword cannot be misrouted, whereas intercepting `APPROVE ADO-{ID}` only when a
pending-approval file exists would misroute an unrelated ICEA approval made while a file happened to
exist.

**The seven design documents** (from SKILL.md Step 2.5) checked by `APPROVE DESIGN`:
`target-component-architecture.md`, `target-data-architecture.md`, `target-security-architecture.md`,
`target-integration-architecture.md`, `target-infrastructure-architecture.md`,
`target-deployment-architecture.md` and `migration-feasibility.md`, all under `docs/migrations/{ADO}/`.

**PARTIAL rows — amended rule.** The skill's current rule makes any PARTIAL row a hard block at
APPROVE DESIGN. That rule is amended: a PARTIAL row may remain at APPROVE DESIGN if the developer
acknowledged that specific row with `PROCEED`. The acknowledgement binds to row names, not to a boolean,
so a PARTIAL row that appears after `PROCEED` is not covered. In that case `APPROVE DESIGN` is refused
with the uncovered rows listed, and the developer resolves them or acknowledges them by replying
`PROCEED` again with the same option letter. `unknown`/UNVERIFIED rows still block. Each accepted PARTIAL
row is appended to the migration log's "Risks accepted" table as residual risk.

On each accepted reply it:

1. Appends the approval to `.claude/migration/{ADO}.approvals.json` (append-only).
2. Mirrors the gate into the ledger with `checkpoint-ledger.cjs set-gate`, run by the hook.
3. Appends a `[DECISION]` entry to `migration-log.md` with `cat >>` (audit trail).
4. Returns `additionalContext` confirming what was recorded, e.g. "Approval recorded:
   design_approved, ADO-1234, target folder `<path>`." Echoing `target_root` lets the developer catch a
   wrong path at the moment it matters.

A reply that fails its precondition records nothing and returns the reason.

The grammar is closed: only the replies above are recognized, and no aliases (such as
`APPROVE ARCHITECTURE`) are added. Each alias widens what the hook must parse and what the developer
must remember, for no gain.

### 3. `migration-gate.cjs` — PreToolUse on `Write|Edit|Bash`

**Write and Edit.** The ADO is taken from the path being written (`docs/migrations/{ADO}/…`,
`.claude/worktrees/{ADO}-cluster-*`), never from a directory listing. A gated path whose ADO has no
checkpoint is blocked.

| Writing to | Requires |
|---|---|
| `docs/migrations/{ADO}/{ADO}-options.md` | `intake_context` re-validated by `intake-verify.cjs check-gate --skill=rewrite`; coupling resolution re-validated by `coupling-resolution-validate.cjs --checkpoint=.claude/migration/{ADO}.checkpoint.json` (exit 0) |
| `docs/migrations/{ADO}/target-*.md`, `migration-feasibility.md` | `options_approved` in the approvals file |
| `.claude/worktrees/{ADO}-cluster-*/**`, `target_root/**` | `design_approved` in the approvals file |

`coupling_resolution_confirmed` is an existing gate, set by the model in SKILL.md Step 1.5 item 5 after
`coupling-resolution-validate.cjs` exits 0. Because the model writes it, the hook does not trust the
stored PASS; it re-runs the validator, consistent with the machine-gate principle.

**ADO normalization.** One shared function, used by both hooks and `cluster-merge.cjs`, normalizes the
ADO identifier taken from paths, replies and script arguments to `ADO-<id>`, the form the skill uses
for both `docs/migrations/ADO-<id>/` and `.claude/migration/ADO-<id>.checkpoint.json`.

Ungated paths (migration log, tracker, manifest, inventory and all non-migration files) pass through.
Path patterns are always scoped to `docs/migrations/{ADO}/`, so an `architecture.md` elsewhere in the
repository is never gated.

Writes to `.claude/migration/*.approvals.json` are blocked here, on Write, Edit and Bash alike. This is
not delegated to `icea-floor.cjs`: that hook covers Write and Edit only and applies a recency window,
while the WCF run wrote its approvals through Bash.

**Bash.** Blocks any command that:

- names `.approvals.json` under `.claude/migration/`;
- passes `--gate=` with a protected gate name (`options_approved`, `design_approved`,
  `cluster_*_approved`, `cluster_*_commit_started`, `cluster_*_merged`) — these are written only by the
  capture hook or `cluster-merge.cjs`;
- names a `.checkpoint.json` file together with a protected gate name (catches `node -e` JSON writes);
- runs `git merge`, `git cherry-pick` or `git rebase` on a `cluster-{ADO}-*` branch directly.

Read-only commands that merely mention a gate name (e.g. `grep options_approved skills/rewrite/SKILL.md`)
are not blocked. Matching the bare name would block routine searches in both target projects and
plugin development sessions.

Every block exits 2 with a self-contained message stating what is required and which reply or command
unblocks it.

### 4. `cluster-merge.cjs` — the only path to the target

| Operation | Behavior |
|---|---|
| `prepare --ado --clusters=1,2,3` | Commits each cluster's worktree state to its branch `cluster-{ADO}-{N}`, records the branch head commit SHA and writes `.claude/migration/{ADO}.pending-approval.json`. This file is a request, not an approval — the model may run this |
| `merge --ado --cluster=N` | Checks `cluster_{N}_approved` exists and the branch head still equals the approved SHA; checks the BAL merge gate (`rewrite-bal.cjs merge-gate`); writes `cluster_{N}_commit_started`; merges; records the merge commit SHA in the payload; writes `cluster_{N}_merged` |

**Why a commit SHA, not a diff hash.** A hash of `git diff` output depends on diff settings (rename
detection and, on Windows, `core.autocrlf`), so the same code can hash differently. The branch head SHA
is exact: any change to the cluster changes it, while merges of other clusters into the target branch
do not. (The three-dot diff considered earlier would also have been stable across other merges, since
`git diff A...B` already compares against the merge base; the SHA is chosen for exactness and
simplicity.)

The git operations run inside the script's own process, so the Bash block on raw merges does not
affect them. In v1 the merge gate checks BAL only; the per-wave judge gates are added when they exist.

### 5. SKILL.md changes

- Remove every instruction that has the model write `options_approved` or `design_approved`. The
  ledger copies of these gates are written only by `approval-capture.cjs`.
- Use one ADO placeholder throughout, resolving to `ADO-<id>` (see Prerequisites).
- **Step 0 preflight.** Add every script this plan introduces or newly relies on to the
  `REQUIRED_SCRIPTS` block: `cluster-merge.cjs` and `coupling-resolution-validate.cjs` (the gate hook
  runs it). Add at the same time the scripts SKILL.md already invokes but never listed,
  `research-cache.cjs` and `coupling-boundary-validate.cjs`; the preflight test below would otherwise
  fail on day one. Also check that both hooks are deployed and registered in the target project's
  `settings.json`, and STOP with "run setup-init" if not. A missing script fails loudly when called, but a
  missing hook fails silently: nothing runs, so nothing is enforced.
- **Rule for every later change:** a script is added to `REQUIRED_SCRIPTS` in the same change that
  first references it from SKILL.md.
- Update the Feature Gate note at the top of SKILL.md. It currently says no generated code is written
  until `APPROVE ADO-{ID}`, the `icea-approve` reply. Under this plan, generation requires
  `APPROVE DESIGN ADO-{ID}` and merging into the target requires `APPROVE CLUSTERS ADO-{ID}`.
- Step 0: record `target_root`.
- Step 2.5: record `design_judge` after the judge pass; record acknowledgements and overrides as PASS
  gates (see Prerequisites).
- Step 3, Step C: run `cluster-merge.cjs prepare` before showing diffs; merge through
  `cluster-merge.cjs merge`; move the merge gate here from Step 5.
- Worktree guard on resume: handle `commit_started` without `merged` (check whether the commit is in
  the target branch's history with `git merge-base --is-ancestor`; ask the developer before acting) and
  treat `merged` without `commit_started` as done (pre-change ledgers).
- State the approval reply grammar in the prompts shown to the developer, including
  `APPROVE CLUSTERS ADO-{ID}` and `SKIP CLUSTER ADO-{ID} {N}` in Step C and Step D.
- Amend the PARTIAL-row rule in Step 1.5 ("hard block at APPROVE DESIGN"), the Step 2 `PROCEED` prompt
  ("commit to resolving them") and the APPROVE DESIGN condition in Step 2.5 to the amended rule above.
  Record the change in the design of record (`docs/plans/migrationSkill/rewrite.md`), since it relaxes
  a stated hard block.

### 6. Deployment and tests

- **One file per hook, in `_project-deploy/hooks/`.** `setup-init-bootstrap.cjs` deploys it to target
  projects and registers it in their `settings.json`. For plugin development sessions (including the
  Phase 0 subagent spike), the plugin's own `.claude/settings.json` references the same file as
  `"$CLAUDE_PROJECT_DIR/_project-deploy/hooks/<hook>.cjs"`. There is no second copy, so nothing can
  drift. This deliberately differs from `context-guard.cjs`, which exists in both locations.
- A preflight test scans SKILL.md for every `$PLUGIN_DIR/scripts/*.cjs` it invokes and fails if any is
  missing from the `REQUIRED_SCRIPTS` block. This turns the rule above into a check rather than a
  reminder.
- Hook tests pipe sample stdin payloads into each script and assert the exit code and message. Ledger
  fixtures are created with `checkpoint-ledger.cjs`, never hand-written JSON (the intake test's
  hand-written flat string is what hid Fix 1).

---

## Implementation phases

| Phase | Deliverables | Exit condition |
|---|---|---|
| 0 — Prerequisites | Fix 1; `--skill` on intake check (no fallback); one ADO placeholder in SKILL.md; `target_root` in Step 0; `design_judge` written in Step 2.5; subagent hook spike | Spike result recorded; intake check passes on a CLI-created ledger with object-form gates and fails without `--skill`; SKILL.md contains no `{ADO_ID}` |
| 1 — Options and design gates | ADO normalization function; `REQUIRED_SCRIPTS` gains `coupling-resolution-validate.cjs`, `research-cache.cjs` and `coupling-boundary-validate.cjs`; preflight test; `approval-capture.cjs` (options, proceed with row-level acknowledgement, design); `migration-gate.cjs` (Write/Edit table rows 1–2, Bash blocks); plugin `.claude/settings.json` entries pointing at `_project-deploy/hooks/`; tests | Hook tests and the preflight test pass; a scripted session cannot write a design document before APPROVE OPTIONS |
| 2 — Write Gate | `cluster-merge.cjs` (prepare, merge), added to `REQUIRED_SCRIPTS` in the same change; capture of `APPROVE CLUSTERS ADO-{ID}` and `SKIP CLUSTER ADO-{ID} {N}`; table row 3; resume guard changes; tests | Merge refuses without approval, when the branch head differs from the approved SHA or below the BAL floor |
| 3 — Skill and rollout | SKILL.md changes, including the PARTIAL-rule amendment; design-of-record note in `rewrite.md`; `setup-init-bootstrap.cjs` deploys both hooks and registers them in target `settings.json`; Step 0 checks the hooks are deployed and registered; rerun the WCF migration | A freshly initialized target project has both hooks registered; acceptance criteria below met on the rerun |

Phase 1 alone would have stopped the WCF run at the first design-document write.

---

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | Writing `{ADO}-options.md` is blocked until intake and coupling resolution both re-validate | Hook test + rerun |
| AC-2 | Writing any design document is blocked until the developer replies APPROVE OPTIONS or PROCEED | Hook test + rerun |
| AC-3 | Writing to a cluster worktree or `target_root` is blocked until the developer replies APPROVE DESIGN | Hook test + spike-confirmed subagent coverage |
| AC-4 | The model cannot write approval state by `set-gate`, Write, Edit or `node -e` | Hook tests for each route |
| AC-5 | An approval is refused when its artifact precondition is not met | Capture hook tests |
| AC-6 | A cluster merges only through `cluster-merge.cjs`, only if approved, only if its branch head equals the approved SHA and only if the BAL merge gate passes; a merge of another cluster into the target branch does not invalidate the approval | Script tests |
| AC-7 | Any hook error blocks the action (exit 2), never allows it | Fault-injection tests |
| AC-8 | Existing readers see the approvals: STATUS, resume and `validate-artifacts` | Integration test on a mirrored ledger |
| AC-9 | WCF rerun: zero model-written human gates; Step 2 runs; hosting is recorded before Step 2.5 | Transcript + checkpoint review |
| AC-10 | WCF rerun: design-phase revision count recorded for comparison with the first run's 27 | Transcript measurement |
| AC-11 | A run that follows the skill reaches the APPROVE DESIGN prompt (`design_judge` is recorded) | Scripted run through Step 2.5 |
| AC-12 | Enforcement does not depend on `.claude/active-task.json`: deleting or corrupting it changes nothing | Hook test |
| AC-13 | APPROVE DESIGN is accepted with PARTIAL rows only if each row was acknowledged by name; a PARTIAL row added after `PROCEED` is refused until resolved or re-acknowledged; `unknown`/UNVERIFIED rows always refuse | Capture hook tests |
| AC-14 | `APPROVE ADO-{ID}` is never captured by `approval-capture.cjs` and still reaches `icea-approve` | Capture hook test |
| AC-15 | Step 0 stops when any script SKILL.md invokes is missing, or when either hook is not deployed and registered; every script SKILL.md invokes is in `REQUIRED_SCRIPTS` | Preflight test + Step 0 run with a hook removed |

---

## Verification items

Claude Code behavior this plan depends on, to confirm on the deployed version:

| Behavior | Current understanding | Why it matters |
|---|---|---|
| PreToolUse fires for tool calls inside subagents | **CONFIRMED YES — 2026-10-02.** Spike run: registered `temp/spike-pretooluse.cjs` as a PreToolUse hook in `.claude/settings.json`; invoked an Agent subagent that called Write to `temp/spike-test-output.txt`; spike-log.txt captured `PreToolUse fired — tool: Write \| file: ...spike-test-output.txt` — the inner Write was intercepted. D-1 = **Option A selected.** `migration-gate.cjs` row 3 (cluster worktree write gate) is active at write-time, not just merge-time. Register hooks in `settings.json`, not agent frontmatter. | Rule for worktrees (AC-3) depends on it — confirmed satisfied |
| Exit 2 blocks; exit 1 does not | Exit 1 is a non-blocking error and the action proceeds | Hooks must fail closed (AC-7) |
| A timed-out PreToolUse command hook does not block | Documented | Keep the hook fast; the intake re-validation scans the manifest and must stay within the hook timeout |
| UserPromptSubmit can add context on exit 0 | Plain stdout or JSON `additionalContext`; an earlier bug report showed stdout errors, so use `additionalContext` | Approval confirmation reaches the model |

---

## Risks and known gaps

| Risk | Mitigation |
|---|---|
| Hook crash or timeout lets a write through | Catch-all exit 2; keep checks fast; set an explicit timeout in `settings.json` |
| Subagent tool calls are not hooked on the deployed version | Phase 0 spike decides this before Phase 2; if hooks do not fire, AC-3 relies on the merge path (AC-6) and the gap is recorded |
| Indirect Bash writes (variables, `cp` into `target_root`) bypass pattern checks | Accepted for v1: the model is not adversarial, and the merge path is still enforced by `cluster-merge.cjs`. Revisit if observed |
| An identifier arrives as `1234` instead of `ADO-1234` (a reply, an argument, an older ledger) | One shared normalization function converts every form to `ADO-<id>` |
| Developer edits a cluster after approval | The branch head no longer equals the approved SHA; the merge is blocked and requires re-approval |
| Relaxing the PARTIAL hard block lets designs rest on unverified contracts | Acknowledgement binds to named rows; each accepted row is logged as residual risk; `unknown`/UNVERIFIED rows still block |

---

## Open decisions

None.

Resolved:

- ADO identifier format: the rewrite skill creates its folder as `docs/migrations/ADO-<id>/` and its
  ledger as `.claude/migration/ADO-<id>.checkpoint.json`. `{ADO}` throughout this plan means
  `ADO-<id>`, which matches the form developers already type in replies such as
  `APPROVE OPTIONS ADO-1234`.
- Hook location: one file per hook in `_project-deploy/hooks/`, referenced from the plugin's own
  settings via `$CLAUDE_PROJECT_DIR`. No second copy.
- Cluster approval keyword: `APPROVE CLUSTERS ADO-{ID}`, with `SKIP CLUSTER ADO-{ID} {N}`, to avoid the
  `icea-approve` routing of `APPROVE ADO-{ID}`.
- PARTIAL rows at APPROVE DESIGN: the hard block is amended to allow rows acknowledged by name with
  `PROCEED`; recorded in the design of record.
- Cluster approval binds to the branch head commit SHA, not a diff hash.
- `context-guard.cjs` does budget arithmetic only and does not parse prompt text, so approval capture
  is a new dedicated hook, `approval-capture.cjs`.
- Bash calls are gated in v1, not only Write and Edit — Bash (`node -e`) is how the WCF run wrote its
  approvals.
- Per-wave independent judges are a separate work item.
- `init` requiring `--skill` is out of this iteration; the required `--skill` on `check-gate` is the fix.
- Implementation order follows the phases above: hooks before `artifact-gate.cjs`, because the evidence
  shows hooks stop the WCF failure and the wrapper does not.

---

## Follow-up work

v1 enforces the gates. The follow-ups below carry out priorities 2 and 3 from "What this changes".
They are numbered F2 and F3 after those priorities, to keep them distinct from v1's Phases 0–3. Each
is a separate work item, entered only after v1's rerun (Phase 3), so it is planned against real
measurements rather than the first run alone.

### F2 — Reduce document re-reads and revision cost (priority 2)

**Goal:** keep the content of large migration documents out of the main session. The main session
holds paths, gate states and short summaries; subagents and scripts hold the content.

| Item | Change | Evidence |
|---|---|---|
| Bash appends for the migration log | Every `[FINDING]`, `[DECISION]`, `[LESSON]` and similar entry is appended with `cat >> … << 'EOF'`, as Step E already does for cluster fragments; the same for `lessons.md`. No Read or Edit of the log in the main session | WCF run: 9 Edits (~3K tokens) and 3 full Reads of `migration-log.md` |
| Revision subagent for design-document feedback | On developer feedback, the main session passes the feedback and the document path to a subagent that reads, revises and writes the document, and returns a short summary of what changed. Cascades across documents (`document-feedback.md`) are routed from those summaries | WCF run: `migration-feasibility.md` 4 Reads + 27 Edits (~20.5K tokens). Re-measure after v1 first (AC-10): most of these revisions traced to the skipped options gate |
| Design judge as a subagent | The design judge runs as a separate agent, as `judge.md` already requires, so the main session does not read the seven design documents to judge them | WCF run: `target-component-architecture.md` read 4 times (~11.2K tokens) |
| Summary-first reads | Extend the `manifest-read-guard.cjs` pattern to other large artifacts where a ledger summary can stand in for a full read | Existing precedent for the source-context manifest |
| Context diagnostic script | Commit the transcript analysis used in this review (per-file Read/Edit/Write counts and characters, main session only) as a reusable script | Used to establish the evidence above; needed to measure F2 |

**Exit:** on a rerun of the WCF migration, main-session characters attributable to design documents and
the migration log are measured with the diagnostic script and compared with the first run's figures.

### F3 — Remaining defects and judge independence (priority 3)

**Goal:** make the paths that v1 makes reachable for the first time correct, and bring judging in
line with `judge.md` and `design-quality.md`.

**Scripts and ledger**

| Item | Change |
|---|---|
| `artifact-gate.cjs` | Validates an artifact before its gate is written: file exists, at least `--min-bytes`, contains the sentinel. Prints self-contained error messages. Adds an `orphan` operation that replaces the Step 2.5 orphan-detection block (whose `gate_exit=$(…; echo $?)` capture never matches). Calls `setGate` through the library, so the shared ledger is unchanged. All artifact gates in SKILL.md move to it |
| `set-judge` | Verdict grammar `PASS\|REVISE\|BLOCK` per `judge.md`; covers `options_judge`, `design_judge` and cluster judges; records target, summary, `log_ref`, `finding_class` and, for plans, the plan hash; writes the gate and appends to root `judge_verdicts` in one merge-write. Fixes upgrade writing `payload.upgrade.judge_verdicts` while STATUS reads root `judge_verdicts`. A shared-ledger change: semver bump, drift-check, ADR |
| `check-gate` exit codes | Exit 1 currently means both REVISE and error (missing ledger, bad arguments). Errors get a distinct code (e.g. 7, matching `get`); REVISE stays 1 |
| `intake-verify.cjs` re-validation | Fail closed when `graph.json` is missing for rewrite and replatform; pass the integration inventory into re-validation; enforce `modules_mapped + modules_out_of_scope == modules_total`, counting modules rather than table rows |
| `coupling-boundary-validate.cjs` exit codes | Exit 1 currently means both "violations" and "bad arguments"; give them distinct codes |
| Strict `stage_gates` readers | Sweep `scripts/` for string comparisons against `'PASS'` and apply the tolerant reader from Fix 1 |
| Test fixtures | Every ledger fixture is produced by `checkpoint-ledger.cjs`; a test checks that each `--sentinel` in SKILL.md appears in its template |
| `init` requiring `--skill` | Hygiene; shared-ledger change |

**SKILL.md correctness**

| Item | Change |
|---|---|
| `committed_dag_path` ordering | Recorded after APPROVE DESIGN but before the DAG is re-derived. Add a `committed_dag_derived` gate after re-derivation; Step 3 checks it |
| Payload schema | Keep the flat keys the ledger actually stores (`cluster_{N}_test_plan_path`, …); delete the unused `checkpoint_payload_json` from subagent steps 6f and 8; correct Step 5a |
| Script paths | Replace bare `node scripts/…` with `$PLUGIN_DIR` paths in SKILL.md and in `migration-ledger-schema.md` |
| Completion gate | Record a `completion_gate` gate; write the assurance summary before `merge_gate` checks it as an artifact |
| Step 2 ordering | Move the intake precondition to the top of Step 2; remove the duplicate research-agent input block |
| Contradictions and stale text | Token-count thresholds vs the "do not count tokens" rule; the Step 0 header-completion timing; duplicate item numbering in Step 0; the misaligned row in the Step 2.5 table; missing `active-task.json` write in Step 5a; "(was Step N)" labels |
| Spec drift | `migration-ledger-schema.md` shows `source_context` as core; the code reads it from the payload. Update the spec |

**Judge independence** (requires `set-judge`)

| Item | Change |
|---|---|
| Per-wave independent judges | Flow per wave: plan round (subagents write plans to `docs/migrations/{ADO}/plans/`, gated by `cluster_{N}_plan_written`) → independent plan judge → generation round from the judged plan (hash checked) → independent implementation judge → merge gate. The subagent's own design check is no longer recorded as a judge verdict |
| Component-section slicing | The component-architecture template requires one `### {component-name}` section per component, so a script can give each planning subagent only its cluster's sections. Fails loudly if a cluster module has no matching section |
| Cost measurement | Record `C_plan / C_gen` and structural-finding rates (`finding_class`) on the first runs, against a threshold set before data collection, to decide whether the plan round stays |

**Exit:** each item has a test or a scripted run demonstrating it; the per-wave judge flow passes on a
rerun with every judge verdict recorded through `set-judge`.

### Later

| Item | Note |
|---|---|
| SKILL.md size reduction (priority 4) | Move templates to `references/templates/`, deterministic bash to scripts, and repeated step-boundary and safe-point blocks to one parameterized protocol file; move the cluster subagent instructions to their own reference file. Structure only — behavior stays in SKILL.md |
| Upgrade and replatform | Reuse the v1 hooks once proven on rewrite; separate work items |

---

## Dependencies

- Fix 1 and the `--skill` flag on `intake-verify.cjs check-gate` must land before `migration-gate.cjs`
  is enabled — otherwise the intake re-validation blocks every rewrite run that stores object-form gates,
  and the hook has no way to name the skill.
- The one-placeholder fix must land before the hooks are enabled, so the hooks and the skill read the
  same ledger.
- `design_judge` must be written before Phase 3's rerun; otherwise a run that follows the skill stops
  before APPROVE DESIGN (AC-11).
- `setup-init-bootstrap.cjs` must deploy the new hooks and their `settings.json` entries.
- The Phase 0 spike result determines whether AC-3 is enforced by hooks or by the merge path alone.

---

## Verification — AC-NF3 (WCF → .NET 10 API rerun)

**Status:** Pending — to be completed after Story 4 ships and the full hook suite is deployed.

**AC-NF3 requirement:** The WCF migration rerun completes with zero model-written self-approvals.
All gate events are triggered exclusively by developer prompts. Design revision count is recorded
and compared against the original WCF run (27 revisions, June 2026).

### Rerun record

| Field | Value |
|---|---|
| Rerun date | _pending_ |
| ADO | _pending_ |
| Hook suite version | v1 (Stories 1–4, ADO-9007, 2026-10-02) |
| D-1 result | Option A — PreToolUse fires in subagents; write-time enforcement active |

### Gate outcomes

| Gate | Triggered by | Hook blocked self-approval? | Notes |
|---|---|---|---|
| `intake_context` | Developer prompt | _pending_ | Row 1 re-validation at write time |
| `options_approved` | `APPROVE OPTIONS ADO-NNN X` | _pending_ | Row 1/2 gate |
| `design_approved` | `APPROVE DESIGN ADO-NNN` | _pending_ | Row 2 gate |
| `cluster_N_approved` | `APPROVE CLUSTERS ADO-NNN` | _pending_ | Row 3 gate |

### Zero-self-approval confirmation

_Pending_ — to be filled after rerun:
- Model-written `options_approved` attempts: **0**
- Model-written `design_approved` attempts: **0**
- Bash blocks by migration-gate.cjs Pattern B (--gate=): **0**
- Bash blocks by migration-gate.cjs Pattern C (.checkpoint.json + protected gate): **0**

### Design revision count comparison

| Run | Revision count | Judge passes | Notes |
|---|---|---|---|
| Original (June 2026) | 27 | _n/a_ | Pre-hook baseline |
| Rerun (pending) | _pending_ | _pending_ | Under full hook enforcement |
