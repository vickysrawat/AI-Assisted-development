# Migration Family Audit — Findings Tracker

**Status: Open**
_Change to **In-Progress** when the first item below moves to In Progress. Change to **Implemented** when all items are Done._

_Second-pass technical review incorporated 2026-09-21. Items A12–A22, B5–B10, and Category C are from this review; A1–A11 and B1–B4 are from the original audit._

_Recorded 2026-09-21 from a cross-skill audit of the three-skill migration family (Upgrade · Rewrite ·
Replatform). Issues are grouped by category with severity. Each item needs its own ICEA
(`/icea-feature`) before any implementation work._

---

## Resume here — start here next session

**State:** Active audit session. 27 items Done / 4 Deferred. Working tree has uncommitted changes. Resume at user's chosen item — user controls order.

**Done this session (2026-09-22 → 2026-09-24):**
D1 ✅ · A1 ✅ · A2 ✅ · A3 ✅ (deferred) · A4 ✅ · A5 ✅ · A6 ✅ · A7 ✅ · A8 ✅ · A9 ✅ · A15 ✅ · A16 ✅ · A13 ✅ · A14 ✅ · A10 ✅ · A11 ✅ (deferred) · A12 ✅ · A17 ✅ · A18 ✅ · A19 ✅ · A20 ✅ (deferred/follow-up) · A21 ✅ · A22 ✅ (resolved-by-A17) · B5 ✅ · B3 ✅ · B4 ✅ · B9 ✅ · B1 ✅ (deferred/follow-up) · B2 ✅

**Session 2026-09-24 — items completed:**
- **B2** ✅ — `_project-deploy/hooks/manifest-read-guard.cjs` (new PreToolUse hook on `Read`; blocks when `source_context.summary.coverage_verdict` present; extra gate: `intake_context=PASS` + no summary → diagnostic); `.claude/hooks/manifest-read-guard.cjs` (deployed copy); `.claude/settings.json` wired; `migration-ledger-schema.md` `source_context.summary` sub-object added; `source-context-intake-spec.md` "The gate" section updated; all three SKILL.md Step 1.5 flush blocks expanded to write full `source_context` + `summary`. Replatform fix also corrects stale `--key=source_context --value=` to `--payload-json` form. No new test file (hook is wired-level enforcement; verified by ledger JSON inspection + grep checks).

**Session 2026-09-23 — items completed:**
- **A13** ✅ — `upgrade-checkpoint.cjs` allowlist for all 4 ops; 2 prose lines fixed in `upgrade/SKILL.md`
- **A14** ✅ — `checkpoint-ledger.cjs` allowlist for all 6 ops; prose fixed in `replatform/SKILL.md`
- **A10** ✅ — `intake-verify.cjs` split into `reason=manifest-missing` vs `reason=manifest-empty`; 3 SKILL.md handlers updated; 4 new test assertions
- **A11** ✅ (deferred) — log entry deduplication; deferred — acceptable at current scale
- **A12** ✅ — `scripts/resolve-migration-roots.cjs` (new, 3-level BFS, shared by all skills); `set-source` op added to `checkpoint-ledger.cjs`; roots-mismatch check in `intake-verify.cjs opCheckGate()`; all 3 SKILL.md Step 0/R1/Step 1+3 blocks updated; 33-assertion test suite added. Design: `migrationRoots` in source app's `settings.local.json`; `--write-to` uses source path for rewrite/replatform, CWD for upgrade; 3-level transitive BFS; exit 5 prompts developer when plugin not integrated in source.
- **A17** ✅ — removed `scanRoots()` from `intake-verify.cjs`; `opVerify()` now reads `migrationRoots` as single source of truth; `upgrade-checkpoint.cjs` A1 guard derives `--settings` from FILE path; rewrite/replatform `verify`+`check-gate` calls updated with `--settings`; spec files updated. Tests: 24 passed.
- **A18** ✅ — root coverage replaced with structured `## Migration roots` table parse (Option C: all roots, no substring fallback, no special-casing); manifest template updated. Tests: 29 passed.
- **A19** ✅ — glob citations prohibited (`reason: glob-citation`); one-line change closes the anti-hallucination bypass. Tests: 31 passed.
- **A21** ✅ — `checkpoint-ledger.cjs` `save()` now writes to a temp file then renames atomically; try/finally cleanup on failure. Tests: 14 passed.
- **A22** ✅ (resolved-by-A17) — core failure mode (`intake-verify.cjs` using `process.cwd()` as root) eliminated by A17's removal of `scanRoots()` and introduction of explicit `--settings` flag. Wrong-CWD scenarios now fail loudly (`roots-not-initialized`/`settings-unreadable`). No additional code changes needed.
- **A20** ✅ (deferred/follow-up) — module accounting word-search inflation; deferred — coincidence required to exploit, fix is ~2 SP structural change; batch with B-series manifest-format work.
- **B5** ✅ — context guard hook infrastructure: `_project-deploy/hooks/context-guard.cjs` (UserPromptSubmit, transcript-based token measurement), `.claude-plugin/context-budgets.json` (per-skill/per-step headroom + model windows), `skills/shared/context-budget-spec.md` (protocol). Rewrite SKILL.md: Step 1 context check fixed (25–40K, no 80K threshold); Step 2.5 clarified (10–20K main session + subagent cost). STEP BOUNDARYs updated to write `active-task.json`. Skill-agnostic — any skill participates by declaring needs and writing `active-task.json`.
- **B3** ✅ — spec-file preflight added to `rewrite/SKILL.md` Step 2.5 (step "0") before `graph-derive-documents.cjs`; checks 6 required spec files; bash-level enforcement. Connection to B1/B8 documented: B8's per-document spec routing will fix the token-amplification side of B3.
- **B4** ✅ — script existence preflight added to all three skills (upgrade: 9 scripts, rewrite: 8 scripts, replatform: 7 scripts) before the first checkpoint-ledger init call; bash-level enforcement across all 3 SKILL.md files.
- **B9** ✅ — `--payload-file=<path>` flag added to `checkpoint-ledger.cjs` set-payload op (reads JSON from file, no shell interpolation); cluster subagent SKILL.md updated to write `cluster-{N}-payload.json` to disk; orchestrator Step B2 updated to use `--payload-file`. Eliminates all 4 failure modes: shell quoting, arg-length limits, LLM truncation, LLM reformatting. 4 new test assertions (11 passed).
- **B1** ✅ (deferred/follow-up) — integration inventory unbounded in design-doc subagents. Full analysis: demand-model (file path) doesn't fix per-agent token load; prose instructions are bypassable; pre-computed slices + text injection is best achievable without enforcement; PreToolUse hook needed for full enforcement. Requires ICEA. Connection to B8: per-document spec routing in B8's contract schema is the right home for this.

**Also fixed (pre-existing regressions found during A12/A13/A14/A17/B9 work):**
- A1 guard `--file` passthrough fix in `upgrade-checkpoint.cjs`
- `intake-verify.cjs opCheckGate()` `source_context` namespace fix (`payload[skill]` first, root fallback)
- `tests/upgrade-checkpoint.test.cjs` — intake context setup; FILE restructured to `.claude/migration/` layout; settings fixture with `migrationRoots`; MANIFEST updated for A18
- `tests/intake-verify.test.cjs` — stale tests removed; A10/A17/A18/A19 assertions added
- `upgrade-checkpoint.cjs` A1 guard reads `source_context.graph_path` from ledger and passes `--graph` to check-gate — fixes test regression from `setup-init` creating `.claude/graph/graph.json` in the plugin dev dir (opVerify was picking up the plugin's own 8-module graph and failing module accounting)
- `tests/upgrade-checkpoint.test.cjs` — stores empty graph path in `source_context.graph_path` so test is self-contained regardless of plugin's graph state

**Open — A category:** ✅ All done (A20/A22 closed without code; A11/A3 deferred)

**Open — B category (4):** B6 · B7 · B8 (ICEA-level) · B10 (code change ~2 SP)

**Open — C category (5):** C1–C5

**Open — D category (1):** D2

**Follow-up (deferred, not urgent):** A20 · A11 · A3 · B1

**Test suites (all passing):**
- `node tests/intake-verify.test.cjs` → 31 passed · 0 failed
- `node tests/upgrade-checkpoint.test.cjs` → 14 passed · 0 failed
- `node tests/checkpoint-ledger.test.cjs` → 11 passed · 0 failed
- `node tests/resolve-migration-roots.test.cjs` → 33 passed · 0 failed
- **Total: 89 passed · 0 failed**

**Session methodology (carry forward):**
- Structured review per item: What / What-if / Tradeoffs / Options / Fix / Residual / Verify / Decide → then implement
- All scripts referenced in a fix are read in parallel during the analysis workflow — not after
- Workflow tool used for analysis (parallel reads + adversarial review); implementation done inline after approval
- Post-implementation adversarial review workflow run for P0 items (A12 caught 10 issues including init/set-source ordering bug and relative path resolution bug)

**Process:** User names each item. Load this file, confirm state, then run the analysis workflow for the named item. All referenced scripts are read in parallel with SKILL.md sections during the analysis phase — not after.

**Governing design principle:** State validation precedes state use, and failure is silent-repair-proof. Any durable state (ledger, tracker, manifest, checkpoint) must pass a deterministic, shared validator before being read or acted on at a resume/advance boundary. Validation failure halts the workflow without mutation. Recovery/reconstruction is always a separate, explicitly approved action — never an automatic side effect of validation.

**Sub-principles:**
- No automatic silent repair. Every recovery path requires explicit human action.
- Exact file paths and byte/parse details, not generic language.
- A literal next command the developer can copy-paste, per scenario.
- Distinguish "start fresh" from "recover" — different risk profiles, must not be conflated.
- JSON output mode should carry the same fields machine-readable.

**First action next session:** Load this file, confirm state (27 Done / 4 Deferred / 10 Open), then ask user which item to proceed with. Open items: B6 · B7 · B8 · B10 · C1 · C2 · C3 · C4 · C5 · D2.

---

## Summary

| Category | Count | Severity |
|---|---|---|
| A: Silent Failures | 22 | 8 P0 · 12 P1 · 2 P2 |
| B: Long-Context Risks | 10 | 2 P0 · 8 P1 |
| C: Migration Family Inconsistencies | 5 | 5 P1 |
| D: Template Sync Gaps | 2 | 2 P2 |
| **Total** | **39** | **10 P0 · 25 P1 · 4 P2** |

---

## A — Silent Failures

### A1 — Intake gate bypass (upgrade only)
**Severity:** P0  
**Status:** Done — 2026-09-22. Both options applied. Option 1: guard added to `upgrade-checkpoint.cjs` `set-gate` handler — `report=PASS` calls `intake-verify.cjs check-gate` before any ledger write; blocks and exits non-zero on failure. Option 2: hard-stop block inserted in `skills/upgrade/SKILL.md` Step 3 after exit-code instructions — `INTAKE CONFIRMED ADO-{ID}` required before Step 4. Resolved together with A15.  
**Skill:** upgrade/SKILL.md  
**What fails:** The intake verification check (`intake-verify.cjs check-gate`) fires at Step 8 (report gate), not at Step 3 output. A developer who manually calls `set-gate --gate=report --verdict=PASS` skips the check entirely — the source is never confirmed read before the report is produced.  
**Fix:** Add a hard-block at the end of Step 3 output that runs `intake-verify.cjs check-gate` and refuses to display the "ready for Step 4" message if the exit is non-zero. The check at Step 8 becomes a belt-and-suspenders confirmation, not the first gate.  
**First action:** `/icea-feature` for a hardening story scoped to upgrade/SKILL.md Step 3. Est: ~2 SP.

---

### A2 — Checkpoint JSON corruption not surfaced at resume (all skills)
**Severity:** P0  
**Status:** Done — 2026-09-22. Five changes applied:
(1) `migration-ledger-schema.md` Resume block replaced with four-branch validate→orient→continue gate (missing/corrupt/incomplete/ok — each with named warning, literal command, CONFIRMED/RESTART gate).
(2) `checkpoint-ledger.cjs` validate command added — exits 2=missing, 3=corrupt, 4=incomplete, 0=ok; JSON output with status/message/next/missing_fields. All four scenarios verified.
(3+4) Per-step context budget check (📊 STEP BOUNDARY) + checkpoint-flush (`set-gate`/`set-payload`) inserted at every step boundary in all three SKILL.md files — 10 steps (upgrade), 8 steps (rewrite), 7 steps (replatform). Replatform init call added as first action in Step R1. Developer must reply CONTINUE or COMPACT before each step.
(5) `migration-ledger-schema.md` Status Step 1.2 updated to call validate before parsing checkpoint.  
**Skill:** all (checkpoint-ledger.cjs:43-46, migration-ledger-schema.md §Resume)  
**What fails:** When the checkpoint JSON is missing or corrupt at resume time, the skill silently falls back to `migration-tracker.md` and continues. Downstream scripts that require the checkpoint JSON then fail inside a subagent — the error surfaces late and is indistinguishable from a logic failure.  
**Fix:** At the start of every resume flow, emit a clear warning if the checkpoint JSON is absent ("Checkpoint JSON missing — recreating from tracker. Run `checkpoint-ledger.cjs init` before any script call.") and gate script invocations until `init` has been confirmed.  
**First action:** Add a preflight check in each skill's resume entry point. Est: ~2 SP.

---

### A3 — Concurrent checkpoint writes under multi-session access (rewrite)
**Severity:** P0  
**Status:** Deferred — 2026-09-22. Single-developer / single-session constraint holds: one developer, one session, one migration at a time. File-lock mechanism not warranted at current scale. Revisit if multi-developer concurrent access becomes a requirement.  
**Skill:** rewrite/SKILL.md Step 3  
**What fails:** The single-writer assumption is documented but not enforced. If a developer opens a second session and calls `checkpoint-ledger.cjs set-payload` while cluster subagents are running, the JSON file is silently corrupted. No file lock or transaction exists.  
**Fix:** Add an advisory lock (e.g., `.claude/migration/<ado>.lock`) that checkpoint-ledger.cjs creates on write and releases after; any concurrent writer that finds the lock waits or fails loudly. On Windows, a lock-file approach via `fs.openSync` with `wx` flag achieves exclusive creation.  
**First action:** `/icea-feature` for concurrency-safe checkpoint writes in checkpoint-ledger.cjs. Est: ~3 SP.

---

### A4 — Tracker update is advisory, not gated (all skills)
**Severity:** P1  
**Status:** Done — 2026-09-22. Option C applied (root-cause fix, not a symptom patch). Scope corrected: A4 is Rewrite-only — Upgrade and Replatform have no migration-tracker.md. Three changes:
(1) `migration-ledger-schema.md` Status Step 1 — inverted primacy: checkpoint JSON is now primary resume oracle (machine-written, script-validated); tracker is supplementary display artifact. Old "tracker is primary" language removed.
(2) `rewrite/SKILL.md` line 220 — checkpoint described as "primary resume record — machine-written and script-validated"; tracker described as "human-readable display artifact".
(3) `rewrite/SKILL.md` lines 951–954 — ALWAYS/NEVER rules inverted: tracker update is now "for human readability and audit trail"; checkpoint is the primary resume record. "Stale tracker points the wrong way" warning removed (no longer true). Stale tracker is now a UX issue, not a resume correctness issue.  
**Skill:** upgrade/SKILL.md:117, rewrite/SKILL.md:294,354,465,576,696,775,804  
**What fails:** Every phase says "Update migration-tracker.md — mark Phase X ✅" but the skill never reads the tracker to verify the update happened before advancing. A skipped update means resume is disoriented — the "Next action" field is stale.  
**Fix:** At the start of each phase, read the tracker's "Next action" field and compare it to the expected phase. If they don't match, warn the developer and offer to show the current tracker state before continuing.  
**First action:** Small hardening pass across all three SKILL.md files. Est: ~1 SP.

---

### A5 — Migration log init not verified before first append (all skills)
**Severity:** P1  
**Status:** Done — 2026-09-22. Revised approach: replaced prose "write then verify" (Option A) with a single Bash heredoc chain where write + `head -1` + `grep -c "## Decisions summary"` are mechanically inseparable — chain exits non-zero if directory creation, write, first-line check, or section-heading check fails. Applied to all three skills: rewrite Step 0, upgrade Step 3, replatform Step R1. Added pre-append guards (`test -f ... || echo "log ABSENT — STOP"`) at first append site in each skill. Replaced rewrite's aspirational "Verify all three exist" prose with a deterministic tracker-only bash check (log already covered by chain). Compounding defect noted: migration-log-spec.md does not exist — to be addressed in C5.  
**Skill:** rewrite/SKILL.md Step 0 and Step 1.5  
**What fails:** Step 0 creates the migration log. Step 1.5 appends to it. There is no check that Step 0's write succeeded before Step 1.5 runs. A permissions failure on Step 0 causes Step 1.5 to silently fail to append — the developer sees entries in chat but not on disk.  
**Fix:** After Step 0 writes the log, immediately verify the file exists and has the expected header via a read-back check. Block Step 1.5 if the file is absent.  
**First action:** Add a post-write verification to Step 0 in each SKILL.md. Est: ~1 SP.

---

### A6 — PARTIAL integration rows: advisory at Options, hard-block at Design (rewrite)
**Severity:** P1  
**Status:** Done — 2026-09-22. Explicit choice gate added to the APPROVE OPTIONS template in `skills/rewrite/SKILL.md`. When PARTIAL rows = 0: normal `APPROVE OPTIONS ADO-{ID} [A|B|C]` flow unchanged. When PARTIAL rows > 0: warning block shows count + per-service list + consequence (hard block at APPROVE DESIGN) + explicit choice — `PROCEED ADO-{ID} [A|B|C]` (acknowledges rows, commits to resolve before Step 2.5, records `[DECISION]` log entry) or `STOP` (return to Step 1.5). `APPROVE OPTIONS` is blocked when PARTIAL rows are present — developer must make a conscious choice.  
**Skill:** rewrite/SKILL.md:449-561  
**What fails:** PARTIAL rows are "advisory" at `APPROVE OPTIONS` but become a hard block at the Step 2.5 design gate. The developer is not warned at approval time that unresolved PARTIAL rows will block the next gate.  
**Fix:** At the `APPROVE OPTIONS` display, add a visible warning: "⚠ N PARTIAL integration rows remain — these are advisory now but are a hard block at the design gate. Resolve them before Step 2.5." Optionally block `APPROVE OPTIONS` when PARTIAL rows exceed a threshold.  
**First action:** Edit rewrite/SKILL.md Step 2 options display. Est: <1 SP.

---

### A7 — DAG cycle check not re-validated at cluster spawn (rewrite)
**Severity:** P1  
**Status:** Done — 2026-09-22 (revised). Initial fix replaced with proper fix after reading `rewrite-decompose.cjs` in full. The script already outputs `worktree_plan` + `clusters` + `order` — the complete cluster schedule. Fix: `decompose` output is now piped to `docs/migrations/{ADO}/cluster-spec.json` before any worktree creation. Exit 11 (cycle, `acyclic: false`) aborts with the `cycles` array named. Exit 0 → `cluster-spec.json` is authoritative; Step 3 reads wave schedule, cluster list, and build order exclusively from this file — never from markdown, never from LLM re-interpretation. Closes all four failure scenarios: manual markdown edit, LLM re-reads markdown, session compaction re-derivation, direct JSON edit. `cluster_spec_path` recorded in checkpoint payload. Correction to tracker: `--check-only` flag does not exist; `acyclic` field + exit 11 are the correct detection mechanism.  
**Skill:** rewrite/SKILL.md:833, Step 3:651  
**What fails:** The DAG is validated at Step 2.5. By Step 3, if a design doc was manually edited and introduced a cycle, the spawned subagents hit the cyclic dependency live with no meaningful error.  
**Fix:** Re-run `rewrite-decompose.cjs decompose --check-only` at the start of Step 3 before any worktree is created. If it exits 11 (cycle), abort with instructions.  
**First action:** Add a single preflight call at the top of the Step 3 cluster-spawn block. Est: <1 SP.

---

### A8 — Strategy tokens not re-validated inside subagents (rewrite)
**Severity:** P1  
**Status:** Done — 2026-09-22. Option C applied (script-level + SKILL.md note, plus all three residuals closed). Key finding: `strategy-resolve.cjs` never read token bodies — only checked heading existence. Two new functions added: `tokenBody()` (extracts `## TOKEN` section body by splitting on `\n##`), and a body-validation loop before exit 0. Exit 2 now fires for three body-level failures: (1) required token heading missing (existing), (2) token body is blank/whitespace-only (`empty_tokens` in JSON), (3) token body contains an unsubstituted placeholder — uppercase, lowercase, or mixed-case, excluding shell `${VAR}` expansions via negative lookbehind (`(?<!\$)\{[A-Za-z][A-Za-z0-9_]*\}`) — (`unfilled_placeholders` in JSON). SKILL.md exit-2 table row updated to describe all three sub-cases. Remediation note added after the token-usage guidance block.  
**Skill:** scripts/strategy-resolve.cjs · rewrite/SKILL.md Step 3

---

### A9 — Judge verdicts recorded but not required (rewrite, replatform)
**Severity:** P1  
**Status:** Done — 2026-09-23. Option 2 applied (check-gate subcommand + SKILL.md prose gates + PASS preamble). Key finding: `judge_verdicts[]` in coreEnvelope is an empty placeholder never written by the ledger — actual verdicts go into `stage_gates[gate]`. Seven changes applied:
(1) `checkpoint-ledger.cjs` — new `check-gate` command: exits 0=PASS, 1=REVISE, 2=BLOCK, 3=no verdict/unrecognised. Never writes. JSON output with `status`, `verdict`, `message` fields.
(2) `rewrite/SKILL.md` — judge verdict gate added inside the options file template (before PARTIAL rows conditional): PASS preamble shown inline; REVISE requires `I ACKNOWLEDGE THE JUDGE VERDICT: options_judge — [sentence]` + `set-gate --gate=options_judge_acknowledged`; BLOCK requires `APPROVER: [name] REASON: [text]` + `set-gate --gate=options_judge_block_override`.
(3) `rewrite/SKILL.md` — judge verdict gate added before APPROVE DESIGN: same three-exit pattern, gate `design_judge`. Exit 3 = warn + block.
(4) `rewrite/SKILL.md` — Step D strengthened: REVISE iteration-4 requires explicit `I ACKNOWLEDGE THE JUDGE VERDICT: cluster-{N}` before re-spawn; BLOCK requires `APPROVER/REASON` before cluster close.
(5) `replatform/SKILL.md` — judge verdict gate before APPROVE OPTIONS: same pattern, gate `options_judge`; Exit 3 = proceed (judge not always triggered).
(6) `replatform/SKILL.md` — judge verdict gate before APPROVE DESIGN: gate `design_judge`; Exit 3 = block.
(7) `replatform/SKILL.md` — judge verdict gate before NFR assurance flush: gate `nfr_judge`; Exit 2 = regulated hard block requiring regulatory reference in REASON.  
**Skill:** scripts/checkpoint-ledger.cjs · rewrite/SKILL.md · replatform/SKILL.md

---

### A10 — Empty manifest returns ambiguous exit 2 (all skills)
**Severity:** P2  
**Status:** Done — 2026-09-23. Option B applied (split reason field, preserve exit code 2 for both). `intake-verify.cjs` lines 119-120 split into two sequential guards: file-missing emits `reason=manifest-missing`; file-empty emits `reason=manifest-empty`. Both still exit 2 — no exit-code shift. Human messages distinguish "start fresh from template" vs "check git history before re-authoring". Three SKILL.md exit-2 handler blocks updated with reason-field disambiguation. `tests/intake-verify.test.cjs` gains 4 new assertions (reason=manifest-missing, empty file, reason=manifest-empty distinct, whitespace-only). Stale accounting-mismatch check-gate test removed (A15 removed that check; test was testing intentionally-removed behavior).  
**Skill:** scripts/intake-verify.cjs:119-120

---

### A11 — Log entry duplication on subagent retry (all skills)
**Severity:** P2  
**Status:** Deferred — 2026-09-23. Single-developer / single-session constraint holds; retry-induced duplication is detectable by inspection and low-impact at current scale. Revisit if multi-developer concurrent access or high-retry-rate subagents become common.  
**Skill:** rewrite/SKILL.md Step D:685  
**What fails:** No deduplication check on migration log entries. A retried subagent appends the same `[DECISION]` or `[FINDING]` entry a second time. No error is raised; the log just has duplicates.  
**Fix:** Before appending a log fragment to `migration-log.md`, hash each entry's `[EVENT]` header and content and skip entries with hashes already present in the file.  
**First action:** Add dedup logic to the orchestrator's log-append step. Est: ~1 SP.

---

### A12 — source.roots not persisted by coreEnvelope()
**Severity:** P0  
**Status:** Done — 2026-09-23. Option C (hybrid) applied with significant architectural discussion. Key design decisions: (1) `migrationRoots` field written to the SOURCE app's `settings.local.json` by the new shared script; (2) 3-level BFS resolves transitive `additionalDirectories`; (3) for rewrite/replatform the developer provides the source path and the script reads from that path — if plugin not integrated in source, exit 5 prompts the developer; (4) for upgrade the source IS the CWD. Nine changes:
(1) `scripts/resolve-migration-roots.cjs` — new shared deterministic BFS script (3-level, exits 0/1/5/6, `--write-to` merge-writes only `migrationRoots`, allowlist-enforced, relative paths anchored to settings-file owner not CWD).
(2) `scripts/checkpoint-ledger.cjs` — new `set-source` op: merge-writes `roots` array into `cp.source.roots`.
(3) `scripts/intake-verify.cjs` opCheckGate() — roots-mismatch assertion comparing `ledger.source.roots` vs `migrationRoots` from settings; absent-tolerant; skips comparison if `migrationRoots` absent (no scanRoots fallback).
(4–6) All three SKILL.md Step 0/R1/Step 1 blocks — `resolve-migration-roots.cjs` call added (init first, resolve second); exit 5 prompt flow; `set-source` flush.
(7) `tests/resolve-migration-roots.test.cjs` — 33 assertions: BFS depth bounding, cycle prevention, exit 5/6, merge-write, relative path resolution, corrupt write-to.
Post-implementation adversarial review (workflow) found and fixed 10 additional issues including: init/set-source ordering bug in rewrite (P0), missing test file (P0), relative path CWD anchoring bug (P1), missing source-path existence check (P1), wrong --write-to path for rewrite/replatform (P1), scanRoots fallback semantics (P1), missing --skill guard on set-source (P2), corrupt write-to silent overwrite (P2).  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** skills/shared/migration-ledger-schema.md documents a source.roots array
(the list of roots analysed during intake), but the checkpoint-ledger.cjs coreEnvelope()
function only creates `{ stack, from, to }`. The multi-root provenance promised by the schema
is absent from every newly initialised ledger. Nothing errors — the ledger is valid JSON,
intake_context can still be marked PASS, and the missing roots are only discovered later
if somebody manually audits the ledger against the manifest.  
**Fix:** Make roots a first-class argument to coreEnvelope() and require all three skills
to pass the detector's root list when initialising the ledger. Add a validation assertion:
a multi-root intake cannot pass unless ledger.source.roots matches source_context.roots_expected.  
**First action:** One-line change to coreEnvelope() + callers in each skill's Step 0. Est: ~1 SP.

---

### A13 — upgrade-checkpoint.cjs silently ignores unknown CLI flags
**Severity:** P0  
**Status:** Done — 2026-09-23. Option A applied (allowlist + prose fix, all four operations). Per-operation allowlist added before the OP chain in `upgrade-checkpoint.cjs` (init/get/set-gate/set-payload — all four, not just set-payload). Prose fixed in `upgrade/SKILL.md` at lines 309 and 323: `--report-path` and `--proceed-after-report` replaced with correct `checkpoint-ledger.cjs --key=` forms. Also fixed as part of this work: A1 guard `--file` passthrough bug (guard was calling `intake-verify.cjs check-gate` without `--file`, looking at wrong ledger path); `intake-verify.cjs opCheckGate()` `source_context` namespace fix; `upgrade-checkpoint.test.cjs` updated with intake context setup.  
**Skill:** upgrade  
**Source:** Second-pass review  
**What fails:** upgrade/SKILL.md instructs the orchestrator to call
`upgrade-checkpoint.cjs set-payload --report-path=<path>` and
`--proceed-after-report=<true|false>`, but the adapter only recognises
`--baseline-tag` and `--hops`. Unknown flags are silently discarded; the command exits
successfully and writes the ledger as if the call succeeded. Resume logic then believes the
field was never set, or worse, proceeds using defaults. The same gap affects testPlanPath,
source-context metadata, design approval state, and any future field not wired through the
generic ledger CLI.  
**Fix:** Reject unknown arguments with a clear error message ("Unknown option: --report-path").
Better: remove the thin adapter's custom parsing and accept a validated JSON patch, or define
and enforce a schema for every supported Upgrade payload field.  
**First action:** Add an allowlist check to upgrade-checkpoint.cjs argument parsing. Est: ~1 SP.

---

### A14 — Replatform uses unsupported --namespace/--payload CLI flags
**Severity:** P0  
**Status:** Done — 2026-09-23. Option B applied (prose fix + script hardening). Two changes: (1) `skills/replatform/SKILL.md` lines 423-424 — removed inline prose command using `--namespace`/`--payload` (unsupported flags); replaced with note pointing to the flush block which already had the correct `--key=nfrReportPath` form. (2) `scripts/checkpoint-ledger.cjs` — per-operation allowlist added for all six operations (init/get/set-gate/set-payload/validate/check-gate), so `--namespace` and `--payload` now exit 1 with a named-flag error even when `--skill` is present. Flush blocks in all three SKILL.md files confirmed correct.  
**Skill:** replatform  
**Source:** Second-pass review  
**What fails:** skills/replatform/SKILL.md instructs:
`checkpoint-ledger.cjs set-payload --namespace=replatform --payload='{...}'`
The generic ledger CLI supports only --skill, --ado, --payload-json, --key, --value.
--namespace and --payload are not implemented. The documented command likely exits
successfully while applying an empty patch. The NFR report path and other replatform
payload fields are therefore never persisted.  
**Fix:** Change the skill command to the implemented contract:
`node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-payload --skill=replatform --ado={ADO} --payload-json='{"nfrReportPath":"..."}'`
Add an integration test asserting the field is readable from the ledger after the command runs.  
**First action:** Edit skills/replatform/SKILL.md at every set-payload call site. Est: <1 SP.

---

### A15 — check-gate is a weakened reimplementation of verify, not the same function
**Severity:** P0  
**Status:** Done — 2026-09-22. Resolved together with A1. `opCheckGate()` re-validation block replaced with `spawnSync` back to `opVerify()` via `__filename` — no parallel implementation exists. Also fixes A16 implicitly: uses `led.skill` (top-level, always set) not `sc.skill` (never stored).  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** check-gate validates only: ledger gate equals PASS, manifest exists, citation
count >= expected root count, graph module counts match stored counters, and cross-cutting
section is non-empty for Rewrite/Replatform. It does NOT re-run: root coverage correctness,
dangling citation validation, PARTIAL/unknown reachable integration rows, unwired dependencies,
per-module disposition completeness, behavior-bearing rows cited to source rather than
documentation, or every cross-cutting row being source-grounded. A manifest can pass once,
then be edited, source roots can change, or a citation can become invalid — check-gate may
still return success because it performs a different, weaker validation than verify.  
**Fix:** Make check-gate invoke the same verification function as verify using the stored
manifest path and skill/inventory paths. Do not maintain a reduced parallel implementation.  
**First action:** Refactor scripts/intake-verify.cjs so the shared verification logic is one
function called by both verify and check-gate modes. Est: ~2 SP.

---

### A16 — source_context.skill not stored in the ledger
**Severity:** P0  
**Status:** Done — 2026-09-22. Resolved implicitly by A15 fix: `opCheckGate()` now uses `led.skill` (top-level field, always set by `coreEnvelope()`) instead of `sc.skill`. Deep-scan branch activates correctly for rewrite/replatform without requiring `skill` to be stored in `source_context`.  
**Skill:** rewrite, replatform  
**Source:** Second-pass review  
**What fails:** check-gate branches on `sc.skill === 'rewrite' || sc.skill === 'replatform'`
to decide whether to apply deep cross-cutting checks, but ledger examples that record
source_context store only `{ manifest_path, verified: true }` without a skill field.
The deep-scan branch is therefore skipped silently during revalidation for Rewrite and
Replatform projects.  
**Fix:** Either persist skill in source_context when recording it, or derive it from the
ledger's top-level skill field, or require --skill to be passed explicitly to check-gate.
The third option is safest because the top-level skill means "last writer," not necessarily
the skill whose intake manifest is being checked.  
**First action:** Add skill to source_context recording in all three SKILL.md Step 1.5 calls.
Est: <1 SP.

---

### A17 — Missing configured additionalDirectories roots silently skipped
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** scanRoots() in scripts/intake-verify.cjs silently continues when a configured
additionalDirectories path does not exist: `if (!nd || !fs.existsSync(nd)) continue;`
A configured root that is deleted, unmounted, on an unavailable network share, or missing
due to a stale settings.local.json is omitted from the expected root set. The manifest
can then pass because the missing dependency is never included in the denominator.  
**Fix:** Distinguish configured roots from existing roots. Fail closed if any configured root
is missing unless the developer explicitly records it as out-of-scope with a written reason
and an assurance consequence note in the ledger.  
**First action:** Replace the silent continue with a distinct missing-root error in
intake-verify.cjs. Est: ~1 SP.

---

### A18 — Root coverage matching too permissive
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** Root coverage is satisfied if either the full root path or the last path
segment appears anywhere in the manifest text. A generic directory name such as src, app,
common, or services can satisfy coverage accidentally when a different root with the same
name is present in an unrelated section.  
**Fix:** Require a structured manifest row containing a normalised root identifier rather
than substring matching. For example, a ROOT_ID / ABSOLUTE_PATH / STATUS row pattern that
is parsed, not searched.  
**First action:** Add a structured root-coverage row spec to the manifest format and update
the verifier to parse it. Est: ~2 SP (schema + verifier).

---

### A19 — Glob citations bypass file and line validation
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** resolveCitation() in scripts/intake-verify.cjs treats any citation
containing '*' as unconditionally valid: `if (rel.includes('*')) return { ok: true, ... }`.
A manifest can cite `src/**/*.cs#L999999` and the citation is accepted without checking
whether the glob matches any file or whether line 999999 exists. Behavior-bearing evidence
can therefore be claimed without a concrete source location.  
**Fix:** Either prohibit globs in provenance citations entirely, or expand and validate them
(glob must match at least one file; when a line number is present, validate it exists).
For behavior-bearing rows, require concrete file#line citations only.  
**First action:** Remove the glob short-circuit return and add expansion + validation. Est: ~1 SP.

---

### A20 — Module accounting inflated by header and summary rows
**Severity:** P1  
**Status:** Deferred (follow-up) — 2026-09-23. Coincidence required to exploit (module name must appear in a header/summary row alongside "mapped"/"out-of-scope"). Fix is ~2 SP structural change to manifest schema + verifier parser. Batch with B-series manifest-format work (B9 cluster result schema).  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** The module accounting check uses tableRows() to count rows containing the
words "mapped" or "out-of-scope". This counts column headers, summary rows, explanatory
prose, and duplicated tables. The unaccounted check also accepts a module as covered if
its name appears in any row containing those words, without requiring it to be in a
dedicated module-identifier column.  
**Fix:** Use one parsed, named module-accounting table with a strict schema:
module_id | disposition | source_citations | rationale.
Reject duplicate module IDs, unknown module IDs, missing dispositions, and any row that
is not a genuine data row (identified by the module_id being present in the known module list).  
**First action:** Replace the tableRows() word-search with a structured table parser. Est: ~2 SP.

---

### A21 — Ledger writes not atomic or revision-guarded
**Severity:** P1  
**Status:** Open  
**Skill:** all skills (overlaps A3)  
**Source:** Second-pass review  
**What fails:** checkpoint-ledger.cjs save() calls fs.writeFileSync() directly with no
temporary file + rename, no file lock, no optimistic concurrency check, no revision field,
and no recovery from partial writes. A crash leaves invalid JSON. Two processes can read
the same ledger, update different fields, and the later write silently loses the earlier
update. The single-writer assumption is a documented convention, not an enforced invariant,
while Rewrite explicitly uses parallel subagents.  
**Fix:** Use read → validate revision → write temp → fsync → atomic rename. Add a revision
field to the ledger core. Reject stale writes (caller's revision !== file's revision).  
**First action:** Implement atomic write helper in checkpoint-ledger.cjs. Est: ~2 SP.
Note: supersedes A3 (concurrent write lock) — an atomic write + revision field provides
stronger protection than an advisory lock alone.

---

### A22 — Rewrite/Replatform working directory ambiguity
**Severity:** P1  
**Status:** Done (resolved-by-A17) — 2026-09-23. A17 removed `scanRoots()` which was the source of the CWD-as-root problem. `opVerify()` now reads from `migrationRoots` via explicit `--settings` flag; CWD is never used as a root. Wrong-CWD scenarios fail loudly (`roots-not-initialized`/`settings-unreadable`) rather than silently scanning the wrong tree. No additional code changes required.  
**Skill:** rewrite, replatform  
**Source:** Second-pass review  
**What fails:** Rewrite instructs "run from inside the new empty target folder" while
intake-verify.cjs scans process.cwd() plus configured additionalDirectories roots.
Replatform instructs "run from the target-app/infra folder" while detection uses the
source root. The source directory can be mistaken for the target, or the intake verifier
may scan the wrong tree.  
**Fix:** Intake scripts should require an explicit --source-root argument rather than
inferring it from process.cwd(). Fail if --source-root and the current directory are the
same non-empty folder (indicates the user is running from the wrong location).  
**First action:** Add --source-root as a required flag to intake-verify.cjs and update
each skill's Step 1.5 call. Est: ~1 SP.

---

## B — Long-Context Risks

### B1 — Integration inventory unbounded, embedded in all design-doc subagents (rewrite)
**Severity:** P0  
**Status:** Deferred (follow-up) — 2026-09-23. Detailed analysis completed; findings documented below.

**Analysis findings (2026-09-23):**
- Root cause: SKILL.md line 698-699 "The Integration Inventory is shared state passed to all agents" — full inventory injected into all 7 design-doc subagent prompts.
- Options evaluated:
  - **Option A (threshold + compact switch):** Does not fix the issue — still injects full inventory to integration-arch agent; threshold is arbitrary; compact summary generation itself loads full inventory into main session.
  - **Option B (demand model — pass file path, agents read on demand):** Does NOT reduce per-agent context. Agent still reads the full file from target folder to filter rows — same token count as injection. Only saves main session tokens.
  - **Option C (pre-computed slices + text injection):** Generate domain slices in main session once (Step 1.5). Inject only slice TEXT (not path) into each subagent. Agent has no reference to full inventory file → cannot load more without active searching. Best achievable without enforcement infrastructure. Still not 100% bypass-proof.
  - **Option D (PreToolUse hook):** Blocks Read tool calls to the full inventory path from non-integration subagents. Reliable enforcement but requires subagent context awareness in the hook — complex.
- **Key finding:** Any SKILL.md instruction to the LLM ("read only your slice") is prose advice, bypassable. The same failure mode as hardcoded token thresholds. Enforcement requires structural access control or hooks.
- **Correct fix:** Option C (text injection of pre-computed slices) as best SKILL.md-level fix; Option D (PreToolUse hook) for full enforcement. Requires ICEA: domain taxonomy definition, slice generation step in Step 1.5, per-doc subagent prompt restructure.
- **Connection to B3:** Spec files (target-design-spec.md ~594 lines, golden-master-spec.md ~576 lines) have the same multiplied-loading problem — each of 7 agents loads the same large spec files independently. B3's preflight (existence check) is necessary but doesn't address the token amplification. The bypassability finding from B1 applies to B3 too.
- **B5 mitigates:** Context guard now blocks Step 2.5 entry when remaining < 100K. Reduces the frequency of context exhaustion but doesn't fix the per-agent token amplification.  
**Skill:** rewrite/SKILL.md:534, Step 2.5  
**What happens:** The integration inventory is passed as shared state to every design-document subagent. For a project with 20+ services (500+ lines), three parallel design agents (component-arch, security-arch, integration-arch) each carry it → 40K+ tokens across three concurrent sessions before cluster generation even begins. This degrades the main session's remaining budget.  
**Fix:** At Step 2.5, measure the inventory line count. If it exceeds a threshold (e.g., 200 lines), partition it: pass only the relevant integration slice to each design-doc subagent based on ownership. Emit a warning in the orchestrator when the full inventory is large.  
**First action:** `/icea-feature` for inventory partitioning at Step 2.5. Est: ~3 SP.

---

### B2 — Source-context manifest read twice in main session (all skills)
**Severity:** P1  
**Status:** Done — 2026-09-24. Option A + D + mechanical enforcement applied. Six changes:
(1) `_project-deploy/hooks/manifest-read-guard.cjs` (new) + `.claude/hooks/manifest-read-guard.cjs` (deployed copy) — PreToolUse hook on `Read`; blocks when `source_context.summary.coverage_verdict` is present; extra gate: if `stage_gates.intake_context=PASS` but summary absent → block with diagnostic (write was skipped). Allows when ledger absent (authoring in progress) or summary absent + gate not PASS (REVISE loop).
(2) `.claude/settings.json` — new PreToolUse entry, matcher `"Read"`, wires the hook.
(3) `skills/shared/migration-ledger-schema.md` — `source_context.summary` sub-object added (additive, absent-tolerant): `coverage_verdict` · `modules_total` · `modules_mapped` · `modules_out_of_scope` · `partial_row_count`.
(4) `skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md` — "The gate" section updated: summary write requirement and hook behaviour documented.
(5) `skills/rewrite/SKILL.md` Step 1.5 flush block — expanded `set-payload` to include full `source_context` with `summary` sub-object (was sparse: manifest_path + verified only).
(6) `skills/upgrade/SKILL.md` Step 3 flush block + `skills/replatform/SKILL.md` Step R1 flush block — same expansion. Replatform also fixes stale `--key=source_context --value=` form to correct `--payload-json` form.
Residual: Step 1.5 first load (unavoidable — authoring requires it); `check-gate` subprocess disk reads (intentional, A15). `Bash cat` bypass not covered by the hook (realistic path is `Read` tool).  
**Skill:** scripts/intake-verify.cjs:119-200, rewrite/SKILL.md Step 1.5  
**What happens:** The full manifest is read by `intake-verify.cjs` (in the main session) and then read again by the LLM in Step 1.5 to author it. A large manifest (500–1,000 lines for a big codebase) enters main-session context twice.  
**Fix:** After Step 1.5 manifest authoring completes, cache the manifest summary (line count, PARTIAL row count, coverage verdict) in the checkpoint. Subsequent calls to intake-verify can read the cached summary instead of the full manifest where full content isn't needed.  
**First action:** Add a `source_context.summary` field to the checkpoint schema and write it at Step 1.5 completion. Est: ~2 SP.

---

### B3 — Spec files re-loaded per subagent, not verified to exist beforehand (rewrite)
**Severity:** P1  
**Status:** Done — 2026-09-23. Spec-file preflight block added to `rewrite/SKILL.md` Step 2.5 (as step "0") before any `graph-derive-documents.cjs` call. Checks all 6 required spec files (`target-design-spec.md`, `golden-master-spec.md`, `document-orchestrator.md`, `integration-verification-spec.md`, `feasibility-spec.md`, `data-architecture-spec.md`) via bash-level `test -f` — fails loudly if any are missing before any subagent is spawned. Connection to B1/B8 documented: B8's per-document spec routing (versioned cluster contract with per-doc spec table) is the correct fix for the token-amplification side of B3; this preflight closes only the missing-file detection gap.  
**Skill:** rewrite/SKILL.md Step 2.5, skills/shared/migration-knowledge/refs/specs/  
**What happens:** Each design-doc subagent reads overlapping spec files (`target-design-spec.md` at 594 lines, `golden-master-spec.md` at 576 lines, etc.) independently. Missing files fail inside a subagent rather than at orchestrator startup.  
**Fix:** At the start of Step 2.5, add a spec-file preflight that lists all required spec paths and verifies each exists before spawning any subagents. Fail loudly if any are missing.  
**First action:** Add a preflight block at the start of Step 2.5. Est: <1 SP.

---

### B4 — Plugin scripts not existence-checked before invocation (all skills)
**Severity:** P1  
**Status:** Open  
**Skill:** upgrade/SKILL.md, rewrite/SKILL.md, replatform/SKILL.md (every script call site)  
**What happens:** All 10+ script calls per skill use `node "$PLUGIN_DIR/scripts/..."` without a prior existence check. A missing or mispathed script surfaces as a raw Node error inside a subagent — indistinguishable from a logic failure in the orchestrator.  
**Fix:** Add a shared preflight block at the start of each skill's Step 0 that verifies all required scripts exist using `ls "$PLUGIN_DIR/scripts/<name>.cjs"`. Fail with a clear message if any are missing.  
**First action:** Extract the script list for each skill and add a preflight block. Est: ~1 SP.

---

### B5 — Rewrite context budget estimates contradict each other
**Severity:** P0  
**Status:** Open  
**Skill:** rewrite  
**Source:** Second-pass review  
**What happens:** skills/rewrite/SKILL.md contains multiple incompatible estimates: Step 1
says approximately 25–40K; Step 1 later says approximately 10–15K; Step 2.5 says
approximately 60–100K; the main-session total says 80–135K. The Step 2.5 safety rule
says stop if fewer than 80K tokens remain. The skill cannot reliably decide whether to
continue because different sections use different budgets, the model may have a smaller
window than the assumed totals, and the "session feels slow" heuristic is not deterministic.  
**Fix:** Replace subjective token estimates with deterministic, measurable budgets:
max source files loaded per call, max source bytes per phase, max manifest rows,
max log bytes loaded for resume, max design-doc bytes passed to each subagent,
max prompt bytes for each cluster. Do not rely on "remaining tokens" unless the runtime
exposes a trustworthy value.  
**First action:** Audit all budget references in rewrite/SKILL.md and replace with a single
consistent table in a new budgets section. Est: ~1 SP.

---

### B6 — Migration log grows without bound and is fully loaded on resume
**Severity:** P0  
**Status:** Open  
**Skill:** rewrite  
**Source:** Second-pass review  
**What happens:** Rewrite's migration log is explicitly documented as "Never truncated.
Living document." and the resume instruction loads migration-tracker.md + migration-log.md
+ the options file together. The log accumulates all findings, decisions, integration rows,
cluster fragments, lessons, transferable patterns, and full judge output. After many clusters
or retries, the next session must load a large historical document before it can act.
The resume artifact becomes the source of context exhaustion rather than a lightweight
resume anchor.  
**Fix:** Split durable state: migration-tracker.md (small, current state only);
migration-log/index.md (compact event index with dates and one-line summaries);
migration-log/events/*.md (append-only detailed events, one file per event);
migration-log/lessons.md (extracted lessons); migration-log/judgments/ (full judge output).
Resume loads only: tracker + current ledger + current gate artifact + the specific
failed/next cluster + a compact summary of prior decisions. The full history remains
available but is not automatically injected into the new session.  
**First action:** /icea-feature for migration log restructure. Est: ~5 SP.

---

### B7 — Step 2.5 is not safely resumable mid-document
**Severity:** P1  
**Status:** Open  
**Skill:** rewrite  
**Source:** Second-pass review  
**What happens:** The skill states "this step cannot be split mid-document" yet authors
seven design documents with review loops and parallel subagents. If context expires during
document 4 or 5, the tracker still shows "Step 2.5 in progress" but there is no per-document
durable state specifying: which document is complete, which revision wave is active, which
dependency documents are satisfied, which documents were judged PASS, or which document
must be resumed next. The step is an all-or-nothing context operation by design but in
practice runs in sessions that can expire.  
**Fix:** Persist a document-level ledger in the checkpoint:
`{ "design_documents": { "target-component-architecture": "APPROVED", "target-data-architecture": "DRAFT", ... }, "active_document": "...", "revision_wave": 2 }`
Each document should be independently resumable and independently gated.  
**First action:** /icea-feature for per-document Step 2.5 resumability. Est: ~3 SP.

---

### B8 — Full cluster instructions copied verbatim into every subagent prompt
**Severity:** P1  
**Status:** Open  
**Connection from B3 analysis (2026-09-23):** Each design-doc subagent also loads the same spec files independently (target-design-spec.md ~594 lines, golden-master-spec.md ~576 lines, document-orchestrator.md, etc.) — same structural token amplification as B1. The correct fix is per-document spec routing: each subagent receives only the spec(s) relevant to its document type (e.g., feasibility agent → feasibility-spec.md only; integration-arch agent → integration-verification-spec.md + target-design-spec.md). The versioned cluster execution contract proposed in B8 is the right home for this routing table. Fixing B3 (existence preflight) and B8 (contract schema) together closes both the missing-file detection gap and the amplification gap.  
**Skill:** rewrite  
**Source:** Second-pass review  
**What happens:** The Rewrite orchestrator copies eight numbered procedural steps from the
skill text plus: the cluster DAG, execution profile tokens, multiple design-doc file paths,
the full integration inventory, judge spec, BAL spec, and ERL spec into each cluster
subagent prompt. This creates large repeated prompts and increases the chance of stale
copied instructions, mismatched profile token substitutions, cluster-specific content being
drowned out by generic prose, and subagents reading more design material than needed for
their cluster.  
**Fix:** Replace copied prose with a compact, versioned execution contract (JSON):
`{ contract_version, ado, cluster, profile, required_inputs, allowed_outputs, gates }`.
The subagent reads the contract and the referenced files. Keep procedural instructions in
one shared file referenced by path, not embedded.  
**First action:** Design the cluster-contract schema and update rewrite/SKILL.md Step 3
subagent prompt template. Est: ~3 SP.

---

### B9 — Cluster results passed as JSON strings through shell
**Severity:** P1  
**Status:** Open  
**Skill:** rewrite  
**Source:** Second-pass review  
**What happens:** The Rewrite orchestrator expects each cluster subagent to return a
checkpoint_payload_json string that the orchestrator then injects into a shell command.
A malformed or oversized JSON string can cause shell quoting failures, truncated payloads,
invalid JSON, partial checkpoint updates, or lost paths and findings. The failure mode
is a parse error or silent truncation deep inside the checkpoint write, not an early
visible error.  
**Fix:** Have each cluster subagent write its result to a well-known file path:
`.claude/migration/{ADO}/clusters/{N}/result.json`. Validate the file against a JSON schema.
The orchestrator reads the file and writes only validated fields to the checkpoint ledger.  
**First action:** Define the cluster result schema and update Step 3 subagent instructions
and the orchestrator's result-collection block. Est: ~2 SP.

---

### B10 — Source scan truncation not surfaced as an assurance limitation
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What happens:** migration-source-detect.cjs caps at MAX_CONTENT_READS=5000,
MAX_FILE_BYTES=512KB, and MAX_DEPTH=6, but the output does not expose: files skipped
because of the file-count cap, files skipped because they exceed the size cap, directories
beyond depth 6, permission or read errors, or ignored extensions. A large source tree
can produce a plausible stack detection result and proceed, while the manifest later claims
full source coverage based on a module graph that was itself generated from incomplete
scanning.  
**Fix:** Emit scan_limits metadata in the detector output:
`{ files_seen, files_skipped_limit, files_skipped_size, directories_skipped_depth, read_errors, coverage_status: "COMPLETE" | "INCOMPLETE" }`.
An incomplete scan should cap the intake assurance level or block the options gate until
the developer explicitly accepts the coverage limitation with a written reason.  
**First action:** Add scan_limits tracking to migration-source-detect.cjs and update the
intake verifier to read and gate on coverage_status. Est: ~2 SP.

---

## C — Migration Family Inconsistencies

### C1 — Upgrade lacks durable Step 0 (no log/tracker/ledger before analysis)
**Severity:** P1  
**Status:** Open  
**Skill:** upgrade  
**Source:** Second-pass review  
**What fails:** Rewrite and Replatform both initialise the migration log, migration tracker,
and checkpoint ledger before any analysis. Upgrade initialises the migration log only during
Step 3, after detection, classification, tool preflight, and some analysis. If Upgrade stops
early — due to an unsupported classification, missing or outdated tool, long-context
interruption, or web-grounding failure — there may be no durable migration log or
human-readable resume point. Early stops are silent: nothing was durable enough to resume from.  
**Fix:** Give Upgrade the same first action as Rewrite and Replatform: initialise log,
tracker, and ledger before any analysis begins. Record detection result, classification
verdict, and preflight outcome into the log before proceeding to Step 2.  
**First action:** Add a Step 0 block to upgrade/SKILL.md that mirrors the Rewrite/Replatform
pattern. Est: ~1 SP.

---

### C2 — Resume behavior documented but not enforced centrally
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** The RESUME keyword handlers promise "picks up from the first unfinished
stage/gate" but checkpoint-ledger.cjs stores arbitrary gate names and verdicts with no
state-machine validation. There is no check that design_approved requires report or options
first; that Rewrite cannot enter generation before intake and design pass; that Replatform
cannot enter cutover before reconciliation; that Upgrade cannot verify before baseline/tag/hop
completion; or that a gate cannot regress without an explicit revision event.  
**Fix:** Put legal state transitions into deterministic code in checkpoint-ledger.cjs.
Each skill should register its gate sequence, and the ledger should refuse to record a
gate PASS if its preconditions are not met. The skill text should describe the state machine;
the code should enforce it.  
**First action:** /icea-feature for state-machine validation in checkpoint-ledger.cjs. Est: ~3 SP.

---

### C3 — Arbitrary gate names and verdicts accepted without validation
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** Both the shared ledger CLI and the Upgrade adapter accept arbitrary strings
as gate names and verdicts. A call like `set-gate --gate=anything --verdict=banana` is
persisted without error. The Upgrade adapter documents accepted values but does not
enforce them. Invalid state can therefore be recorded as successful, making ledger-based
resume unreliable.  
**Fix:** Validate gate names against per-skill registries and allowed verdict values.
Registries: upgrade (report, design_approved, residual, verify);
rewrite (intake_context, options_approved, design_approved, merge, completion);
replatform (intake_context, options_approved, design_approved, reconcile, assurance).
Allowed verdicts: PASS | REVISE | BLOCK | NOT_STARTED.
Reject anything outside those sets.  
**First action:** Add gate-name and verdict validation to checkpoint-ledger.cjs set-gate.
Est: ~1 SP.

---

### C4 — Test-plan generation failure is non-blocking across all three skills
**Severity:** P1  
**Status:** Open  
**Skill:** all skills  
**Source:** Second-pass review  
**What fails:** All three skills allow test-plan generation to fail, log a warning, and
continue. Completion can be reported without a generated test plan, a combined Rewrite
test plan, or traceability from assurance claims to test cases. The migration appears
complete while a key verification artefact is absent.  
**Fix:** Make the completion result explicit when the test plan is missing:
COMPLETION: PASS WITH TEST-PLAN GAP (not PASS). For B-series, regulated, financial,
healthcare, and production migrations, make test-plan presence a hard gate at the
completion step — a missing test plan blocks the completion verdict.  
**First action:** Update the completion-gate display in all three SKILL.md files.
Add a test-plan presence check before recording completion PASS. Est: ~1 SP.

---

### C5 — Migration log absent for Upgrade and Replatform
**Severity:** P1  
**Status:** Open  
**Skill:** upgrade, replatform  
**Source:** Added 2026-09-22 (session review)  
**What fails:** The migration log (`migration-log.md`) is the append-only audit trail for a migration — it records `[DECISION]`, `[INTEGRATION]`, `[FINDING]`, `[JUDGE]`, and `[LESSON]` entries throughout the skill run. Rewrite initialises and maintains it from Step 0. Upgrade and Replatform have no migration log: architectural decisions made during classification, tool preflight, gap/risk analysis, hop execution, IaC authoring, and reconciliation are never persisted to a durable record. Lessons learned from an upgrade or replatform run are lost when the session ends. There is no audit trail to review post-migration, feed into Dream, or reference for future migrations of the same stack.  
**Fix:** Add migration log initialisation as the first action of each skill (Upgrade Step 0 / Replatform Step R1 — which A2 already requires for the checkpoint ledger) and append structured log entries at each phase transition using the same entry format as Rewrite (`[DECISION]`, `[FINDING]`, `[LESSON]`, `[JUDGE]`). Mirror the Rewrite log spec (`migration-log-spec.md`) for both skills.  
**First action:** Read `migration-log-spec.md` to confirm the entry format, then add log init + per-phase append instructions to `upgrade/SKILL.md` and `replatform/SKILL.md`. Est: ~1 SP.

---

## D — Template Sync Gaps

### D1 — Four handlers missing from _project-deploy/CLAUDE.md
**Severity:** P2 (deployment gap)  
**Status:** Done — 2026-09-22. Option A applied: four rows inserted after the MIGRATE retirement row in `_project-deploy/CLAUDE.md` §0a (lines 122–125). Verified with grep. Residual: template drift mechanism open — Option B (release-gate diff check) tracked separately.  
**What's missing:** `METRICS RELEASE-{N}`, `METRICS RELEASE-{N} SPRINT-{S}`, `METRICS RELEASE-{N} VS RELEASE-{M}`, and `LESSONS RELEASE-{N}` are in the main CLAUDE.md but absent from the deploy template. Projects bootstrapped from the template cannot use these commands without manual sync.  
**Fix:** Add the four handlers to the §0a table in `_project-deploy/CLAUDE.md` with the same descriptions as in the main file.  
**First action:** Edit `_project-deploy/CLAUDE.md` §0a directly — no ICEA needed (doc change only). Est: <30 min.

---

### D2 — APPROVE CONFIG handler exists in template but not in main CLAUDE.md
**Severity:** P2 (variance)  
**Status:** Open  
**What's missing:** `APPROVE CONFIG` (lighter approval path for config files, no ADO required) is in the deploy template but undocumented in the main CLAUDE.md. This creates a deployment variance: template projects have a capability the plugin dev project doesn't document.  
**Fix:** Decide which is canonical — if `APPROVE CONFIG` is intentional for deployed projects, document it in the main CLAUDE.md with a note that it applies to target projects only. If it's stale, remove it from the template.  
**First action:** Review the `APPROVE CONFIG` handler logic in the template and make the keep/remove call. Est: <30 min.

---

## Recommended Fix Order

Second-pass review priority (highest-value first), then remaining original-audit items.

| # | Item(s) | Description | Effort |
|---|---|---|---|
| 1 | A13 + A14 | ✅ Done 2026-09-23 | < 1 SP |
| 2 | A15 + A16 | ✅ Done 2026-09-22 | ~ 2 SP |
| 3 | A17 | ✅ Done 2026-09-23 — migrationRoots as single source of truth; removed scanRoots() | ~ 1 SP |
| 4 | A12 + C2 + C3 + A21 | A12 ✅ Done 2026-09-23 · A21 ✅ Done 2026-09-23 · C2/C3 remain | ~ 3 SP |
| 5 | A21 | ✅ Done 2026-09-23 — atomic temp→rename in save(); try/finally cleanup | ~ 2 SP |
| 6 | B6 | Indexed log summaries — split unbounded log into index+events+lessons+judgments; resume loads compact summary only | ~ 5 SP |
| 7 | B7 | Per-document Step 2.5 resumability — document-level ledger; each design doc independently gated and resumable | ~ 3 SP |
| 8 | B10 | Expose scan truncation — emit scan_limits metadata; incomplete scan caps assurance or blocks options gate | ~ 2 SP |
| 9 | A18 | ✅ Done 2026-09-23 — ## Migration roots structured table (Option C: all roots, no substring fallback) | ~ 2 SP |
| 10 | A19 | ✅ Done 2026-09-23 — glob citations prohibited (reason=glob-citation) | ~ 1 SP |
| 11 | A20 | ✅ Deferred 2026-09-23 — batch with B9/B8 manifest-format work | ~ 2 SP |
| 12 | A22 | ✅ Done 2026-09-23 (resolved-by-A17) | < 1 SP |
| 13 | B5 | ✅ Done 2026-09-23 — context guard hook + per-skill declared headroom (context-budgets.json) | ~ 1 SP |
| 14 | B8 | Versioned cluster execution contract — replace copied prose with compact JSON contract + shared instructions file. Also: per-document spec routing (from B3 analysis) | ~ 3 SP |
| 15 | B9 | ✅ Done 2026-09-23 — --payload-file flag on checkpoint-ledger.cjs; cluster subagent writes payload file | ~ 2 SP |
| 16 | C1 | Upgrade durable Step 0 — initialise log, tracker, and ledger before any detection or analysis | ~ 1 SP |
| 17 | C4 | Test-plan hard gate for B-series/regulated — explicit PASS WITH TEST-PLAN GAP; hard block for regulated migrations | ~ 1 SP |
| 18 | A6 | PARTIAL rows warning at Options gate | < 1 SP |
| 19 | A7 | DAG cycle re-check at cluster spawn | < 1 SP |
| 20 | A8 | Strategy token validation after resolve | < 1 SP |
| 21 | B3 | ✅ Done 2026-09-23 — spec-file preflight at Step 2.5 (bash, 6 specs checked) | < 1 SP |
| 22 | B4 | ✅ Done 2026-09-23 — script existence preflight for all 3 skills (bash) | ~ 1 SP |
| 23 | A4 | Tracker update warning before phase advance | ~ 1 SP |
| 24 | A5 | Migration log init write-back verification | ~ 1 SP |
| 25 | A10 | ✅ Done 2026-09-23 (reason field split, exit code unchanged) | < 1 SP |
| 26 | A11 | ✅ Deferred 2026-09-23 | ~ 1 SP |
| 27 | B2 | ✅ Done 2026-09-24 — manifest-read-guard hook + source_context.summary (all 3 skills + schema + spec) | ~ 2 SP |
| 28 | A2 | Resume preflight for missing checkpoint JSON (partly covered by #4) | ~ 1 SP |
| 29 | A1 | Intake gate hard-block at Step 3 — upgrade (partly covered by #1–2) | ~ 1 SP |
| 30 | B1 | Integration inventory partitioning for Step 2.5 subagents | ~ 3 SP |
| 31 | A9 | Judge verdict acknowledgement gate | ~ 3 SP |
| 32 | A3 | Concurrent checkpoint write lock (superseded by #4–5; keep as belt-and-suspenders) | ~ 1 SP |
| 33 | D1 | 4 missing template handlers in _project-deploy/CLAUDE.md | < 30 min |
| 34 | D2 | APPROVE CONFIG variance between main and template | < 30 min |
