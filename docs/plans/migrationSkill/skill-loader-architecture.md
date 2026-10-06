# Migration Skill — Size Reduction and Defect Resolution Plan

**Status:** In-Progress — design finalised, implementation not started
**Recorded:** 2026-10-01
**Origin:** Audit session (audit-tracker-2026-09-21.md) — operational concern raised after observing
`rewrite/SKILL.md` grew to 2,012 lines and Grep tooling began failing during development sessions.

---

## Problem Statement

### Symptom
`skills/rewrite/SKILL.md` is 2,012 lines and growing. Every audit fix adds content. The Grep tool
fails on it during development sessions. The file is 2.3x larger than `upgrade/SKILL.md` and 3.1x
larger than `replatform/SKILL.md`.

### Root cause — not just size
Size is the symptom. The root cause is that one file serves too many roles simultaneously:

1. **Step instructions** — what to do at each step
2. **Shared protocols** — conservative bias rule, migration log protocol, safe-point protocol
3. **Templates** — full document templates that the LLM uses when authoring design docs, cluster
   specs, etc.
4. **Error messages** — self-contained failure messages with inline templates and repair steps
5. **Validation logic** — orphan detection, gate guards, preflight checks

Every audit fix that improves correctness (adding templates to error messages, adding detection
blocks, making protocols explicit) adds lines. The more correct the file gets, the more expensive
every migration session becomes.

### Why naive step-splitting fails
Splitting SKILL.md into per-step files breaks the cross-step information contract:

- Step 2.5 needs `coupling_patterns` from Step 1.5 (checkpoint) and `committed_dag_path` from Step 2
- Step 3 needs the cluster spec from Step 2.5 outputs
- Shared protocols appear across all steps

A per-step file loaded in isolation loses this context. Cross-referencing requires the LLM to hold
multiple files in context simultaneously, which defeats the purpose.

### Why a new skill-loader + YAML spec is wrong
An earlier draft of this plan proposed a `skill-loader.cjs` script and YAML step-spec files.
This was rejected because:

- The skill already has a `references/` extraction pattern (posture.md, bal.md, erl.md,
  design-quality.md). A new loader + YAML spec is a second, heavier mechanism for the same job.
- YAML step specs introduce a parallel representation of the SKILL.md content. Two representations
  will drift; the spec format adds its own schema + validation tooling; extraction is a one-time
  agent run that must be reviewed manually.
- `requires_specs` (loading external spec files into packets) does the same work as the existing
  `references/` pattern, adding machinery to replicate what already works.
- Conditional templating in YAML (`{{if checkpoint.field}}`) requires a mini-templating engine in
  the loader. This is complexity without benefit: prose with LLM evaluation handles conditional
  branches correctly and is already how the skill works.

**Decision:** extend the existing `references/` pattern. Extract large, stable content out of
SKILL.md into `skills/rewrite/references/` files. The SKILL.md `Read` calls these files explicitly;
no new loader is needed.

### Current impact
| Problem | Effect |
|---|---|
| Grep fails during development | Audit/debug sessions require Read+offset/limit navigation |
| 20-25K tokens loaded per session/resume | Crowds out migration artifacts |
| Each audit fix adds content | Fixing correctness worsens the size problem |
| Blocking defects (see below) | Several critical bugs make migrations fail silently or halt incorrectly |

---

## Blocking Defects — Must Fix Before Any Extraction

These defects are in `rewrite/SKILL.md`, its scripts, or the shared ledger spec. They must be
resolved before extraction: the extraction reads the corrected SKILL.md as its source of truth.
If a defect is in a script (`intake-verify.cjs`, `checkpoint-ledger.cjs`), the script is the fix
target — the SKILL.md instruction that invokes it stays as-is.

### Fix 1 — intake-verify.cjs gate read always fails (BLOCKING)

**Location:** `scripts/intake-verify.cjs`

**Bug:** Step 1.5 writes the `intake_context` gate using `--artifact-path`, `--sentinel`, and
`--min-bytes` flags. With those flags, `checkpoint-ledger.cjs` stores the gate as an object:
`{ verdict: "PASS", at, artifact_path, ... }` — this is intentional per the DECISION comment in
the ledger script. But `intake-verify.cjs` compares the stored value against the plain string
`'PASS'`:

```js
if ((led.stage_gates || {}).intake_context !== 'PASS')
```

An object is never `=== 'PASS'`, so the precondition check at Step 2 always returns exit 10 and
halts the migration. No migration that passes Step 1.5 can advance to Step 2.

**Fix:** adopt the tolerant reader pattern already in `checkpoint-ledger.cjs check-gate`:

```js
const g = (led.stage_gates || {}).intake_context;
const v = g && typeof g === 'object' ? String(g.verdict || '').toUpperCase() : String(g || '').toUpperCase();
if (v !== 'PASS')
```

---

### Fix 2 — Orphan-detection capture bug (BLOCKING)

**Location:** `skills/rewrite/SKILL.md` — Step 2.5 orphan-detection bash block

**Bug:** the exit-code capture pattern is wrong. The current block runs the check-gate command and
captures its exit code in the same line as the `echo $?`, but the variable assignment captures the
command output (empty), not the exit code. As written, `gate_exit` is always empty, so the orphan
condition `[ "$gate_exit" = "3" ]` never fires. Orphaned documents (file on disk, sentinel present,
gate not set) pass silently.

**Fix:** use process substitution to capture the exit code correctly:

```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" check-gate \
  --skill=rewrite --ado={ADO} --gate="$GATE" > /dev/null 2>&1
gate_exit=$?
```

The `$?` must be read immediately after the command, before any other command runs.

---

### Fix 3 — check-gate errors share exit code with "gate absent" (BLOCKING)

**Location:** `scripts/checkpoint-ledger.cjs` — `check-gate` operation

**Bug:** when `check-gate` encounters a real error (file I/O failure, corrupt JSON, missing
`--gate` argument), it exits with code 1 — the same code it uses for "gate not set." Callers
cannot distinguish "gate not set, proceed with default" from "ledger is unreadable, halt." The
SKILL.md orphan-detection block and the Step 2 precondition both silently treat I/O errors as
absent gates.

**Fix:** assign a distinct exit code to error conditions (e.g., exit 5 for unexpected errors).
Update all callers to check for exit 5 and halt with a diagnostic message rather than treating it
as an absent gate.

---

### Fix 4 — Judge gates are never written (BLOCKING — APPROVE DESIGN unreachable)

**Location:** `skills/rewrite/SKILL.md` — Steps 2 and 3 orchestrator instructions

**Bug:** `judge.md` specifies that the judge never writes anything and only returns a verdict; the
orchestrator records it. Neither SKILL.md nor judge.md instructs the orchestrator to write
`design_judge` or `options_judge` gates after the judge subagent returns. Without these gates,
`check-gate --gate=design_judge` always returns "absent," so the resume logic cannot distinguish
"not yet judged" from "judged and PASS." The APPROVE DESIGN flow is unreachable.

Additionally, SKILL.md records acknowledgements and overrides as `ACKNOWLEDGED` or `BLOCK_OVERRIDE`
verdicts. These are outside judge.md's verdict grammar (`PASS | REVISE | BLOCK`), so check-gate
reports them as "unknown."

**Fix (no script change required):**

1. After each judge pass, the orchestrator runs:
   ```bash
   node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-gate \
     --skill=rewrite --ado={ADO} --gate=design_judge --verdict={PASS|REVISE|BLOCK}
   ```
2. Record acknowledgements and overrides as separate PASS gates with a descriptive name:
   ```bash
   # Instead of ACKNOWLEDGED or BLOCK_OVERRIDE:
   set-gate --gate=design_judge_acknowledged --verdict=PASS
   ```
3. On resume, if `design_judge` is REVISE, check `design_judge_acknowledged` before prompting
   the developer again.

---

### Fix 5 — Payload schema incompatibility (BLOCKING)

**Location:** `skills/rewrite/SKILL.md` — Step B2 writes vs Step 5a reads

**Bug:** confirmed from `checkpoint-ledger.cjs` source: `set-payload --key=X --value=Y` stores a
flat string key `{ "X": value }`. The notation `--key=clusters[0].assurancePath` stores a literal
string key `"clusters[0].assurancePath"`, NOT a nested object path.

Step B2 writes flat keys: `cluster_1_verdict`, `cluster_2_verdict`, ...
Step 5a reads nested: `clusters[0].assurancePath`, `clusters[1].assurancePath`, ...

These schemas are incompatible. Step 5a will always read `undefined`.

**Fix:** standardise on flat keys throughout. Step 5a must be rewritten to read
`cluster_1_assurance_path`, `cluster_2_assurance_path`, etc. The SKILL.md instructions for
Step B2 and Step 5a must use the same key names.

---

### Fix 6 — Bare relative script paths (correctness + maintainability)

**Location:** `skills/rewrite/SKILL.md` — multiple bash blocks; `skills/shared/migration-ledger-schema.md`

**Bug:** several bash blocks use bare relative paths like `node scripts/checkpoint-ledger.cjs`
instead of `node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs"`. Bare paths work only if the shell
cwd is the plugin root at execution time — which is not guaranteed during a migration session. When
the path fails, Node exits loudly with ENOENT. The real danger is LLM improvisation: the LLM may
search for an alternative path or skip the gate flush entirely, producing a silently incorrect
checkpoint state.

**Fix:** replace all bare script paths with `"$PLUGIN_DIR/scripts/..."` in both SKILL.md and the
ledger spec. The variable is set by the plugin at session start.

---

### Fix 7 — committed_dag_path resume window

**Location:** `skills/rewrite/SKILL.md` — Step 2 / Step 3 boundary

**Bug:** the `design_approved` gate is written before the DAG is re-derived at session resume. If
the session stops between `design_approved` being written and the DAG re-derivation completing,
Step 3 resumes with an inferred (not committed) DAG. The `committed_dag_path` field is populated
but may point to a stale or provisional value.

**Fix:** add a new gate `committed_dag_derived` that Step 3 checks on resume. The gate is written
immediately after the DAG re-derivation is committed to disk. Step 3's resume guard:

```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" check-gate \
  --skill=rewrite --ado={ADO} --gate=committed_dag_derived
# exit 3 = not yet derived — re-derive before proceeding
# exit 0 = derived — load from committed_dag_path and proceed
```

---

### Fix 8 — Fail-closed gate weaknesses (lower priority)

**Location:** `scripts/intake-verify.cjs` — coverage check

Three weaknesses in the "fail-closed" gate described in `migration-ledger-schema.md`:

1. **Missing graph.json passes silently.** When `graph.json` is absent, `modules` is empty, the
   coverage check (exit 7) has nothing to check, and verify passes with `modules_total: 0`. A
   missing denominator must be an error for rewrite and replatform.

2. **Re-validation is weaker than the original check.** `check-gate` re-runs verify without
   `--inventory`, so the PARTIAL-row check looks at the manifest instead of the integration
   inventory. This contradicts the script's own "no parallel weaker implementation" comment. The
   ledger does not store the inventory path, so it either needs to be recorded or passed through.

3. **Coverage invariant claimed but not enforced.** The schema says `check-gate` checks
   `modules_mapped + modules_out_of_scope == modules_total`, but no code does this. `modules_mapped`
   is also a count of every manifest row containing "mapped," not a distinct module count. The
   full/partial verdict and the recorded numbers can both be wrong.

**Fix direction:** (a) hard-fail when graph.json is missing; (b) record the inventory path in the
ledger at Step 1.5 and pass it to re-validation; (c) fix the coverage invariant check and the
`modules_mapped` count method.

---

### Fix 9 — Spec and documentation cleanup (non-blocking)

Three items to correct in specs — code is fine, documentation is wrong:

1. **source_context location:** `migration-ledger-schema.md` shows `source_context` as a top-level
   core field. In practice, `intake-verify.cjs` reads from `payload[skill].source_context` first
   and falls back to the top-level. The skill writes it into the payload. Code is correct; the spec
   needs to document both locations and the precedence rule.

2. **judge_verdicts requirement:** `judge.md` says to record every verdict in `judge_verdicts` via
   `checkpoint-ledger.cjs`, but the script has no operation that writes that array — it only
   initialises it as empty. The gate holds the verdict; the migration log holds the full analysis;
   nothing is lost by retiring the field. The schema field stays (additive-only rule) but the
   requirement to populate it is removed. A `set-judge` operation is not worth adding — it would
   duplicate the gate with no new information.

3. **Coverage invariant claim:** remove the claim that `check-gate` validates
   `modules_mapped + modules_out_of_scope == modules_total` from `migration-ledger-schema.md`
   until Fix 8 is implemented.

---

## Design Decision — Cluster Judge Independence (Fix 10)

**Issue:** `judge.md` requires the judge to be a separate agent that never sees the author's
reasoning, warning that same-context self-review rubber-stamps the work. In Steps 2 and 5, cluster
subagents currently judge their own design and their own generated diff — in the same context, on
the same model. This violates the independence requirement.

Claude Code subagents cannot spawn further subagents, so a cluster subagent cannot call an
independent judge itself. Making these judges independent means the orchestrator runs them after
each subagent returns, adding main-session cost and changing the REVISE loop in Step 3.

**Options:**
- **A) Orchestrator-run judges (true independence):** after each cluster subagent returns, the
  orchestrator spawns a separate judge subagent with only the output (no author context). Cost:
  extra main-session agent call per cluster; REVISE loop adds another round-trip per rejected
  cluster. Benefit: genuine independence, matches the judge.md contract.

- **B) Accepted risk (self-judging):** the cluster subagent judges its own work. Record as an
  accepted risk in the migration log. Reviewers apply extra scrutiny to cluster output.

**Decision: B — accept self-judging as a known limitation for now.**

Rationale:
- The design and implementation judges are lower-stakes than the options judge (which judges a
  human-facing architectural decision). Cluster judges catch mechanical errors (missing files,
  wrong imports) more than architectural ones.
- The cost of option A is significant: every cluster becomes two agent calls, the REVISE loop in
  Step 3 changes, and the main-session context grows with each cluster judgment.
- Accepted risk is the correct posture when the cost of the fix exceeds the expected benefit given
  the failure mode. Self-judging cluster checks still catch most mechanical errors.
- **Condition to revisit:** if cluster quality issues (missed imports, structural errors that
  passed the self-judge) surface during production migrations, escalate to option A.

**Recording:** SKILL.md Step 3 must include an explicit accepted-risk entry in the migration log:
```
Accepted risk: cluster subagent judges its own output. Independent judgment not possible without
orchestrator-level agent spawning. Reviewers should apply extra scrutiny to cluster diffs.
```

---

## Six-Step Reduction Plan

These steps execute in order. Steps 1–3 are defect resolution. Steps 4–6 are size reduction.
No extraction happens before Step 1–3 are complete.

### Step 1 — Fix all blocking defects in scripts and SKILL.md

Target: Fixes 1–7 above (Fixes 8–9 can follow in a separate PR; Fix 10 is recorded as accepted
risk per the decision above).

Files changed:
- `scripts/intake-verify.cjs` — Fix 1 (gate read), Fix 8a (missing graph.json)
- `scripts/checkpoint-ledger.cjs` — Fix 3 (distinct exit code for errors)
- `skills/rewrite/SKILL.md` — Fix 2 (orphan capture), Fix 4 (judge gates), Fix 5 (payload schema),
  Fix 6 (bare paths), Fix 7 (committed_dag_derived gate)
- `skills/shared/migration-ledger-schema.md` — Fix 6 (bare paths in examples), Fix 9 (spec cleanup)

Gate: PR review + all existing tests pass + new regression tests for each fix.

### Step 2 — Move document templates into references/

The inline templates used in Step 2.5 error messages (coupling-pattern-resolutions template,
document structure templates) are the largest single block of static content in SKILL.md. Move
them to:

```
skills/rewrite/references/templates/
  design-doc-component.md       # target-component-architecture.md structure
  design-doc-data.md
  design-doc-security.md
  design-doc-integration.md
  design-doc-infrastructure.md
  design-doc-deployment.md
  design-doc-feasibility.md
  coupling-resolutions.md       # the coupling-pattern-resolutions section template
```

SKILL.md Step 2.5 error messages reference the template by path instead of inlining it:

```
See the required structure at:
  skills/rewrite/references/templates/design-doc-component.md
Read that file, then re-author the document.
```

The LLM reads the template file when needed (on error recovery), not on every session load. Normal
sessions pay zero cost for templates they never invoke.

**Sentinel contract:** the sentinel string for each document type (e.g., `## Coupling pattern
resolutions`) has ONE home: `scripts/design-doc-gate.cjs` config. The script validates its config
against the template file at startup. CI runs the same check before release. No runtime Step 0
grep; no copies in SKILL.md.

### Step 3 — Extract design-doc-gate.cjs

Replace the inline bash validation block in Step 2.5 (currently ~80 lines per document, repeated
7 times) with a single script call:

```bash
node "$PLUGIN_DIR/scripts/design-doc-gate.cjs" \
  --skill=rewrite --ado={ADO} \
  --gate=design_doc_component_written \
  --file="docs/migrations/{ADO}/target-component-architecture.md"
```

The script handles:
- File existence check
- Sentinel validation (from its own config — single source of truth)
- Min-bytes check
- Gate write (on pass) via checkpoint-ledger.cjs set-gate
- Self-contained error messages (printed by the script; only enter LLM context on failure)

**Context gain:** error messages (~40 lines per document x 7 documents = ~280 lines) move out of
SKILL.md entirely. They only enter LLM context on failure, not on every session load.

**Scope:** this script replaces inline bash blocks. It does NOT replace the orphan-detection logic
(which runs before the subagent, not after); that stays in SKILL.md as a pre-flight check.

### Step 4 — Extract protocols.md

The shared protocols (conservative bias rule, migration log protocol, safe-point protocol,
checkpoint flush pattern) appear by reference in multiple steps. Move them to:

```
skills/rewrite/references/protocols.md
```

SKILL.md reads this file explicitly at two points:
1. **Session start (Step 0):** before any work begins, the LLM reads protocols.md in full. This
   ensures protocols are loaded when context pressure is lowest.
2. **Resume:** the resume guard at the top of each step re-reads protocols.md. This ensures a
   resumed session has the same protocol grounding as a fresh session.

**Important constraints:**
- The Read tool does not support `#anchor` notation. The file must be read in full, not
  section-by-section. Keep protocols.md concise (target: <150 lines total).
- Do NOT read protocols.md lazily (only when a safe-point fires). Safe-points fire under context
  pressure — the worst moment to load new content.

### Step 5 — Extract cluster-subagent.md (resolves B8)

Audit item B8: full cluster instructions are copied verbatim into every cluster subagent, even
though each subagent only executes one cluster. Move to:

```
skills/rewrite/references/cluster-subagent.md
```

SKILL.md instructs the orchestrator to pass only the relevant cluster section as context to each
subagent. The subagent receives:
- Its cluster definition (from the DAG)
- The cluster-subagent.md execution contract (how to author, validate, and log)
- The checkpoint write commands for its specific gates

It does NOT receive the full SKILL.md or other cluster definitions.

### Step 6 — Measure and decide on upgrade/replatform

After Steps 1–5:
1. Measure SKILL.md line count and token count
2. Measure per-session context load for each step
3. Assess whether the size problem is resolved or still critical

If rewrite is resolved and upgrade/replatform are still within manageable bounds, stop here.
If upgrade/replatform have grown significantly, apply the same references/ extraction pattern
as a separate ADO.

---

## Updated Defect/Fix Index

| # | Location | Severity | Fix |
|---|---|---|---|
| Fix 1 | intake-verify.cjs | BLOCKING | Gate object vs string comparison |
| Fix 2 | SKILL.md Step 2.5 | BLOCKING | Orphan-detection exit code capture |
| Fix 3 | checkpoint-ledger.cjs | BLOCKING | Distinct exit code for errors vs absent gate |
| Fix 4 | SKILL.md Steps 2, 3 | BLOCKING | Orchestrator must write judge gates |
| Fix 5 | SKILL.md B2, Step 5a | BLOCKING | Flat payload key schema alignment |
| Fix 6 | SKILL.md + ledger spec | Correctness | $PLUGIN_DIR paths everywhere |
| Fix 7 | SKILL.md Step 2/3 boundary | Correctness | committed_dag_derived gate |
| Fix 8 | intake-verify.cjs | Lower priority | Fail-closed gate: graph.json + inventory + invariant |
| Fix 9 | migration-ledger-schema.md | Doc cleanup | source_context, judge_verdicts, coverage invariant |
| Fix 10 | SKILL.md Steps 2, 5 | Accepted risk | Cluster self-judging; recorded in migration log |

---

## Acceptance Criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | A migration that passes Step 1.5 can advance to Step 2 | Integration test against a fixture checkpoint |
| AC-2 | Orphaned documents are detected and surfaced to developer, not silently passed | Test: file on disk + sentinel + no gate |
| AC-3 | check-gate I/O errors produce exit 5, not exit 1; all callers halt on exit 5 | Unit test per caller |
| AC-4 | design_judge and options_judge gates are written after each judge pass | SKILL.md instruction review + checkpoint fixture |
| AC-5 | APPROVE DESIGN path is reachable with correct gates set | End-to-end test: write all required gates, run APPROVE DESIGN handler |
| AC-6 | Step 5a reads the same flat keys that Step B2 writes | Key audit: grep both steps for payload key names |
| AC-7 | All script references in SKILL.md and ledger spec use $PLUGIN_DIR | Grep: no bare `node scripts/` in either file |
| AC-8 | Resume at Step 3 checks committed_dag_derived before using committed_dag_path | SKILL.md instruction review + resume fixture |
| AC-9 | SKILL.md line count is below 1,200 lines after Steps 2–5 | Line count check |
| AC-10 | design-doc-gate.cjs config is the only location for each sentinel string | Grep: sentinel string appears in config only, not SKILL.md |
| AC-11 | Cluster subagents receive only their cluster context, not the full SKILL.md | Subagent invocation review in Step 3 |
| AC-12 | protocols.md is read at Step 0 and at resume, not lazily | SKILL.md Step 0 and resume guard review |

---

## Dependencies

- All blocking fixes (Fix 1–7) must be complete before any extraction step
- `design-doc-gate.cjs` (Step 3) must exist before Step 2.5 templates are moved (Step 2) —
  otherwise error messages reference the script before it is written
- B8 resolution (Step 5) should be coordinated with the audit B8 item — they share the same fix

## Entry Point

The blocking fixes (Step 1) are a prerequisite for any migration to succeed. Recommend raising
a separate ADO for the blocking fixes immediately, before the extraction ICEA.

Suggested work items:
- **ADO-XXXX** — "Migration skill: fix 5 blocking defects in rewrite/SKILL.md and scripts"
  (Step 1, Fixes 1–7)
- **ADO-YYYY** — "Migration skill: references/ extraction and size reduction"
  (Steps 2–5, separate ICEA after Step 1 ADO is closed)
