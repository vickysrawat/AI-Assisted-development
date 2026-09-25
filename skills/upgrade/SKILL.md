---
name: upgrade
description: >
  In-place, same-stack version upgrade (current → higher supported version) — the LLM is an
  ORCHESTRATOR of a deterministic stack tool, never a generative author. Detects stack + version,
  rejects false-upgrades (routes them to the Rewrite skill), plans the multi-hop version path,
  produces a decision-grade Gap + Risk report, and (if the developer proceeds) drives the tool on
  an isolated branch off a baseline tag with one commit per hop, verifying against the baseline.
  Triggers on: "upgrade", "bump version", ".NET 6 to 8", "Angular 15 to 17", "Java 8 to 21".
---

# Skill: upgrade — in-place version upgrade orchestrator

_Skill version: 1.0 · Last changed: 2026-09-08 · Plugin compatibility: ≥3.20.0 · Consent: A_

> Part of the three-skill migration family (Upgrade · Rewrite · Replatform). Design of record:
> `docs/plans/migrationSkill/upgrade.md` + `docs/plans/migrationSkill/README.md` (shared substrate).
> ADO-9000 Story 1. Source-read consent per `$PLUGIN_DIR/skills/shared/source-file-consent.md`.

> ⚠ **Feature Gate**: this skill edits a working application in place. The Write Gate (CLAUDE.md §0)
> holds — no source/config is written until `APPROVE ADO-{ID}`; residual fixes are gated per file.

## Guiding principle

> **The LLM coordinates; the deterministic tool transforms.** In an in-place upgrade the model never
> hand-authors the bulk change to working code — it selects and drives the stack-native tool, grounds
> its gap/risk analysis in authoritative sources, and remediates only the residual the tool cannot
> handle, each fix gated and verified against the pre-upgrade baseline commit. The primary product is
> the **decision-grade report**; the code change is secondary and always reversible.

## Skill shape

- **Locality:** in-place (edits the source repo itself).
- **Oracle:** the project's own **pre-upgrade baseline commit/tag**.
- **Headline deliverable:** the **Gap + Risk report** — value even if the developer never proceeds.

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer**, weighing **[SA] Rafael Mendes**
(feasibility/classification) during Intake. The persona sets *what to scrutinise* — it never licenses
assumption; the codebase, authoritative sources, and the developer's answers are the only truth. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`. Never name the persona in output.

## Model routing

- Classification / gap-risk analysis / residual remediation: `${ICEA_MODEL:-claude-opus-4-8}`.
- LLM-as-judge on gates + source verification: `${CRITIC_MODEL:-claude-sonnet-4-6}`, escalating to
  `${CRITIC_MODEL_MAX:-claude-opus-4-8}` (max effort) for high-risk / B-series findings.

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md`.

## Resolve PLUGIN_DIR — before any step

```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

## Stage flow

```
Detect stack + current version        (shared detection substrate — raven)
  → Classify                          (reject false-upgrades → route to Rewrite)
  → Plan version path                 (multi-hop; where version-path/hosting OPTIONS exist → options-insight-spec.md)
  → Tool-availability preflight       (probe tool; missing → print install steps, pause)
  → Web-grounded Gap + Risk analysis  (cached, source-verified; INCLUDES integration verification)
  → Decision-grade REPORT             (feasibility spine; the gap/risk report IS Document 7)
  → Delta design documents            (NON-EMPTY deltas only, from gap/risk analysis) → APPROVE DESIGN
     feedback loop (document-feedback.md); infeasibility discovered here → route to Rewrite
  → [if proceed] baseline TAG + branch (oracle anchor; oracle = self-run baseline)
  → Run stack tool per hop            (one COMMIT per hop → bisectable)
  → LLM residual remediation          (each fix behind the Write Gate)
  → Verify vs baseline oracle
  → Post-upgrade recommendations      (ladder → Rewrite / Replatform)
  → migration log: follow migration-log-spec.md at each phase
```

Tool-availability preflight (AC-F2) in Step 2; grounded gap/risk analysis + integration verification +
the decision-grade report (AC-F3) in Steps 3–4; delta design documents + APPROVE DESIGN before the
baseline tag; gated execution (commit-per-hop, residual remediation, verify) + the inline
judge/checkpoint substrate (AC-F9/F10) in Steps 5–8.

## Step 1 — Intake & classification (implemented — the highest-risk component)

> 📊 **STEP BOUNDARY — Step 1: Intake & classification**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

**Script preflight — verify all required plugin scripts exist before any execution:**
```bash
REQUIRED_SCRIPTS=(
  "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs"
  "$PLUGIN_DIR/scripts/upgrade-checkpoint.cjs"
  "$PLUGIN_DIR/scripts/migration-source-detect.cjs"
  "$PLUGIN_DIR/scripts/upgrade-classify.cjs"
  "$PLUGIN_DIR/scripts/resolve-migration-roots.cjs"
  "$PLUGIN_DIR/scripts/intake-verify.cjs"
  "$PLUGIN_DIR/scripts/upgrade-tool-preflight.cjs"
  "$PLUGIN_DIR/scripts/upgrade-knowledge-cache.cjs"
  "$PLUGIN_DIR/scripts/upgrade-orchestrate.cjs"
)
for script in "${REQUIRED_SCRIPTS[@]}"; do
  [ -f "$script" ] || { echo "❌ MISSING SCRIPT: $script — re-install the plugin or run /setup-sync."; exit 1; }
done
echo "✅ All required scripts present."
```
If any script is missing: **STOP** — do not proceed. Run `/setup-sync` or reinstall the plugin.

```bash
# Initialize checkpoint ledger — first action in Step 1, before any detection or classification
node scripts/checkpoint-ledger.cjs init --skill=upgrade --ado={ADO_ID}
```

**Friction reduction (once per session).** Before the first Bash call, run the offer per
`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/friction-reduction-spec.md` — check
whether `.claude/settings.local.json` already has the recommended patterns; if not, ask the
developer once. YES → merge patterns + confirm; NO → continue without writing.

1. **Detect** stack + current version with the shared detector (do NOT re-implement detection):
   ```bash
   node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=. --json
   ```
   Take `primary` (stack token) + its detected version.
2. **Confirm the target version** with the developer. Refuse a target at or below current.
3. **Classify** — feed stack/from/to into the deterministic classifier:
   ```bash
   node "$PLUGIN_DIR/scripts/upgrade-classify.cjs" --stack=<token> --from=<v> --to=<v> [--to-stack=<token>] --json
   ```
   Interpret the exit code (see `references/classification.md` for the full taxonomy):

   | Exit | classification | Action |
   |---|---|---|
   | 0 | `upgrade` | proceed — the JSON carries the multi-hop `hops[]` + selected `tool` |
   | 3 | `false-upgrade` | **STOP** — cross-runtime boundary; route to the Rewrite skill (no edits) |
   | 4 | `unsupported` | **STOP** — stack has no in-place upgrade path/tool; list supported stacks |
   | 5 | `invalid` | **STOP** — target ≤ current (downgrade/equal); ask for a valid target |

4. On `false-upgrade`, emit the routing message and stop — misrouting corrupts a working app:
   ```
   ⛔ Not an in-place upgrade — {from-stack}→{to-stack} crosses a runtime boundary
      ({reason}). This is an out-of-place rewrite. Route to the Rewrite skill:
        REWRITE ADO-{ID}
      No files were changed.
   ```

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=step_1_classified --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=stack --value={STACK}
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=from --value={FROM}
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=to --value={TO}
```

**Resolve migration roots** — run immediately after classification so `source.roots` is in the ledger before gap/risk analysis. For upgrade the source IS the CWD:
```bash
node "$PLUGIN_DIR/scripts/resolve-migration-roots.cjs" \
  --source-path=$(pwd) \
  --write-to=.claude/settings.local.json \
  --depth=3 --json
```
- Exit 0 → migrationRoots recorded in `.claude/settings.local.json` → continue.
- Exit 5 → plugin not integrated here (unexpected for upgrade — this implies `setup-init` was not run): present this prompt to the developer:
  ```
  ⚠ No plugin configuration found at .claude/settings.local.json.
     Are there dependency repositories the migration should include?
     Provide comma-separated absolute paths, or NONE to proceed with source root only:
     > ___
  ```
  On NONE: log a `[FINDING]` entry to `migration-log.md`: "Scope limited to source root only — dependencies may be missed."
  On paths provided: validate each exists (`test -d`), write paths to `.claude/settings.local.json`.migrationRoots and continue.
- Exit 6 → STOP: report the missing directory path and which settings file configured it. Developer must fix before proceeding.

After exit 0 (or manual path entry on exit 5), record migrationRoots in the ledger:
```bash
MIGRATION_ROOTS=$(node -e "const fs=require('fs');try{const s=JSON.parse(fs.readFileSync('.claude/settings.local.json','utf8'));process.stdout.write(JSON.stringify(s.migrationRoots||[]))}catch(e){process.stdout.write('[]')}")
node scripts/checkpoint-ledger.cjs set-source --skill=upgrade --ado={ADO_ID} --roots-json="$MIGRATION_ROOTS"
```

## Step 2 — Tool-availability preflight (implemented — AC-F2)

> 📊 **STEP BOUNDARY — Step 2: Tool-availability preflight**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Only reached when Step 1 classified `upgrade`. Probe the deterministic tool for the stack (read-only)
and act on the status — see `references/tool-matrix.md` for the matrix + per-OS install steps:

```bash
node "$PLUGIN_DIR/scripts/upgrade-tool-preflight.cjs" --stack=<token> --json
```

| Exit | status | Action |
|---|---|---|
| 0 | `available` | tool present at ≥ min version — proceed to gap/risk analysis |
| 2 | `outdated` | present but too old — print the upgrade steps; stop and wait for the developer to run them; re-run preflight to continue (no developer decision required — prerequisite only) |
| 3 | `needs-install` | not found — print the install + verify steps; stop and wait for the developer to run them; re-run preflight to continue (no developer decision required — prerequisite only) |
| 4 | `unknown-stack` | no tool for this stack — **STOP** (Upgrade cannot serve it) |

The skill only **prints** install/verify steps for the developer to run; it never installs anything
and never bundles a tool. Exits 2 and 3 are prerequisite waits, not decision gates — no developer
response or confirmation is needed; the skill continues automatically when the developer re-invokes.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=step_2_tool_available --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=tool_available --value={TOOL_AVAILABLE}
```

## Step 3 — Web-grounded gap/risk analysis (implemented — AC-F3)

> 📊 **STEP BOUNDARY — Step 3: Web-grounded gap/risk analysis**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Reached only after Step 1 classified `upgrade` and Step 2 found the tool `available`. Gather the
breaking-change / deprecation facts for the planned hops. The **LLM grounds; the cache engine tags +
stores** — the engine makes no network call (see `references/gap-risk-report.md`).

1. **Cache-first.** For each hop `{from,to}`, read the stable delta-KB before searching:
   ```bash
   node "$PLUGIN_DIR/scripts/upgrade-knowledge-cache.cjs" get --stack=<token> --from=<v> --to=<v> --json
   ```
   Exit `0` = hit (reuse — the facts are immutable once the version shipped); `7` = miss → ground it.
   For tool-capability facts use `--layer=volatile`; exit `6` = stale → re-ground.

**Integration verification (the integration dimension of the analysis)** — run
`integration-verification-spec.md` as part of this step. Most integrations pass through an in-place
upgrade unchanged; the ones that BREAK (a library with no target-version equivalent, a changed auth
scheme) are exactly what the gap/risk report must surface. Tier 2 via `additionalDirectories` where
the service source is available. The Integration Inventory feeds the report's integration rows and
`[INTEGRATION]` migration log entries. This is lighter than Rewrite/Replatform — it runs inside the
gap/risk analysis, not as a separate pre-options step.

**Initialize and verify the migration log** — write and verify in a single Bash chain:

```bash
mkdir -p docs/migrations/{ADO} && \
cat > docs/migrations/{ADO}/migration-log.md << 'LOGEOF'
# Migration Log — {AppName} Upgrade (ADO-{ID})
Living document. Updated at every decision point. Never truncated — the full history is the asset.
Source: {full/source/path} ({source stack} {source version}) · Target: {target version} · Skill: Upgrade
Started: {date} · ADO: {ADO ID}

---

## Decisions summary

| Decision | Chosen | Alternatives rejected | Date |
|---|---|---|---|

## Risks accepted

| Risk | Level | Accepted because | Compensating control |
|---|---|---|---|

---

## Lessons

---

## Transferable Patterns

LOGEOF
head -1 docs/migrations/{ADO}/migration-log.md && \
grep -c "## Decisions summary" docs/migrations/{ADO}/migration-log.md
```

If the chain exits non-zero: **stop immediately** — do not continue. Report the exact shell output.
Recovery is a separate, explicitly approved action — never automatic.
This is a documentation artifact — not subject to the Write Gate.

**Source-context intake gate** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md`.
Author the **Source Context Manifest** (`docs/migrations/{ADO}/source-context-manifest.md`) from the
source's own docs + code, then verify. The upgrade profile is lighter (cross-cutting scan = delta only;
Tier-2 only for integrations that break) BUT **source coverage is full accounting** — every `graph.json`
module gets a `mapped`/`out-of-scope` disposition, so "unchanged" is asserted, never assumed by omission:
```bash
node "$PLUGIN_DIR/scripts/intake-verify.cjs" verify --manifest=docs/migrations/{ADO}/source-context-manifest.md \
  --skill=upgrade --json
```
Exit 0 → record `stage_gates.intake_context=PASS` + `core.source_context`. Exit 2–9 → **STOP** and
resolve. The gap/risk report (Step 4) cannot be gated PASS until this is done — see Step 8.
Exit 2 carries a `reason` field in `--json` output: `manifest-missing` = file does not exist — author from the manifest template and re-run; `manifest-empty` = file was created but is empty — run `git log -- docs/migrations/{ADO}/source-context-manifest.md` to check for a recoverable draft before re-authoring from scratch.

**Hard stop — do not advance to Step 4 until intake is confirmed.** Present this prompt and wait:

```
🛑 INTAKE GATE — reply INTAKE CONFIRMED ADO-{ID} to continue to the gap/risk analysis,
   or resolve the errors above and re-run intake-verify.cjs verify.
```

Only `INTAKE CONFIRMED ADO-{ID}` continues. Do not generate gap/risk prose, do not advance
to Step 4, until this reply is received and `stage_gates.intake_context=PASS` is durable
in the ledger.

2. **Ground on miss/stale.** Use WebSearch to find the change from an **authoritative** source
   (official migration guide / release notes / deprecation list). Never source a breaking-change
   claim from model memory.
3. **Verify + cache each fact.** Store it so the tag is set deterministically from the source host:
   ```bash
   node "$PLUGIN_DIR/scripts/upgrade-knowledge-cache.cjs" put --stack=<token> --from=<v> --to=<v> \
     --fact="<claim>" --source="<url>" --source-date=<YYYY-MM-DD> --json
   ```
   `tier: VERIFIED` (authoritative host) or `INFERRED` (anything else — confidence auto-lowered).
   A stable fact is immutable: an identical re-put is idempotent; a differing claim under the same id
   returns `immutable-conflict` (exit 8) for you to resolve, never silently overwrite.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=intake_context --verdict=PASS
```
Then record full source_context including summary. Use `modules_total`, `modules_mapped`,
`modules_out_of_scope` from the `intake-verify.cjs verify --json` output above.
Set `coverage_verdict` to `"full"` if `modules_out_of_scope == 0`, otherwise `"partial"`:
```bash
node scripts/checkpoint-ledger.cjs set-payload \
  --skill=upgrade --ado={ADO_ID} \
  --payload-json='{"source_context":{"manifest_path":"docs/migrations/{ADO_ID}/source-context-manifest.md","verified":true,"roots_expected":[{ROOTS_ARRAY}],"modules_total":{N},"modules_mapped":{M},"modules_out_of_scope":{K},"verified_at":"{DATE}","summary":{"coverage_verdict":"{full|partial}","modules_total":{N},"modules_mapped":{M},"modules_out_of_scope":{K},"partial_row_count":0}}}'
```
The `manifest-read-guard.cjs` hook arms after this write — subsequent Read calls to the manifest
are blocked and redirected to `source_context.summary` in the ledger.

## Step 4 — Decision-grade Gap + Risk report (implemented — AC-F3)

> 📊 **STEP BOUNDARY — Step 4: Decision-grade Gap + Risk report**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Assemble the report per the schema in `references/gap-risk-report.md`. It is the **headline
deliverable** — emit it whether or not the developer proceeds:

- State which side of the **tool-coverage line** the project sits on (strong vs weak tool).
- Classify every item on the feasibility spine (🟢/🟡/🔴/⛔) and show its **source tag** (VERIFIED +
  dated url · or INFERRED).
- Include the **dependency ledger** — a package with no target-compatible version is a hard ⛔ BLOCKER.
- List what's possible / blocked / manual, then the **post-upgrade ladder** (→ Rewrite / Replatform).
- Even a RED/BLOCKER verdict yields a decision-grade report (graceful degradation) — never a bare fail.

**The gap/risk report IS Document 7 (feasibility).** Per `feasibility-spec.md`, this spec governs the
report's format directly — no separate `migration-feasibility.md` is produced for upgrade.

**Save to disk.** After emitting the report in chat, write the full content to:

```
docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md
```

Documentation artifact — not subject to the Write Gate. Create the directory if absent.
Record the path: `node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=report_path --value=<path>`

**APPROVE REPORT gate.** Present this prompt and stop:

```
📊 GAP + RISK REPORT SAVED → docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md

The report is your value from this run — saved whether or not you proceed to execution.

  APPROVE REPORT ADO-{ID}  — continue to delta design documents (Step 4.5)
  NO                       — stop here; the report remains on disk for your review
```

Only `APPROVE REPORT ADO-{ID}` continues. Record the choice:
  `node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=proceed_after_report --value=<true|false>`
Pre-append guard:
```bash
test -f docs/migrations/{ADO}/migration-log.md && echo "log OK" || echo "log ABSENT — STOP: return to Step 3 log init"
```
If absent: halt and report — do not create the file here.
Write a `[DECISION]` migration log entry for this gate.

The report is the point where value is delivered. Everything below runs **only if the developer
chooses to proceed** (replies `APPROVE REPORT ADO-{ID}`) — and every step that touches the working
repo is authored here but executed by the developer (LLM authors + rehearses, human executes).

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=report --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=report_path --value={REPORT_PATH}
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=proceed_after_report --value={PROCEED_AFTER_REPORT}
```

## Step 4.5 — Delta design documents + APPROVE DESIGN (new)

> 📊 **STEP BOUNDARY — Step 4.5: Delta design documents + APPROVE DESIGN**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Author the **non-empty delta documents only** — the gap/risk analysis identifies which dimensions the
upgrade actually changes; author delta documents solely for those (per `target-design-spec.md` delta
depth). A clean upgrade may produce only the gap/risk report + a component delta (middleware pipeline,
package replacements). Infrastructure/deployment deltas only if the upgrade includes a hosting change.

- **Derive the graph** from whatever documents are present: `graph-derive-documents.cjs`.
- **Feedback loop** via `design-revision-spec.md` on the gap/risk report + deltas (reduced document set).
- **Route-to-Rewrite escape hatch:** if the gap/risk review or the feedback loop reveals the upgrade is
  **infeasible in place** (accumulated RED/BLOCKER evidence), route to **Rewrite** — this is the
  discovered-late equivalent of the Step 1 false-upgrade catch. Per `option-change-spec.md` (upgrade
  posture-boundary note). Do NOT proceed to the baseline tag on an infeasible upgrade.
- **APPROVE DESIGN** — records `payload.upgrade.gate_verdicts.design_approved = true`. Required before
  the baseline tag. Write `[DECISION]` + `[REVISION]` migration log entries.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=design_approved --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=design_doc_path --value={DESIGN_DOC_PATH}
```

## Step 5 — Baseline tag + working branch (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 5: Baseline tag + working branch**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

The oracle is the **pre-upgrade baseline** — `self-run` almost by definition (the app builds and runs;
it is what you are upgrading). Golden master, if used as a secondary smoke, captures baseline behaviour
here (pre-move) and replays it after the upgrade (post-move) per `golden-master-spec.md` (Upgrade
binding row). If the app cannot be built/run locally, the oracle degrades — noted in the report.


Before ANY edit, plan the execution runbook. The orchestrator is a **pure planner** — it emits the
ordered git/tool commands; it never runs them:

```bash
node "$PLUGIN_DIR/scripts/upgrade-orchestrate.cjs" plan --stack=<token> --from=<v> --to=<v> \
  --hops=<v1,v2,...> --tool="<preflight tool>" --ado=<ID> --json
```

`steps[0]` is always the **baseline tag** (the oracle anchor) and `steps[1]` the isolated branch —
created before the first edit so verification always has a clean pre-upgrade reference. Record the
tag in the checkpoint: `upgrade-checkpoint.cjs set-payload --baseline-tag=<tag> --hops=<...>`.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=step_5_baseline_tagged --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=baseline_tag --value={BASELINE_TAG}
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=hops --value={HOPS}
```

## Step 6 — Run the stack tool per hop (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 6: Run the stack tool per hop**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Walk the runbook one hop at a time. For each hop: run the deterministic tool for that hop, then make
**exactly one commit** (`commit_plan[i].commit_msg`). One commit per hop keeps history bisectable so
a later verify failure pins the exact hop. Never blend hops into one diff; never hand-author the bulk
transform.

```bash
# Flush after each hop (replace N with 1-based hop index)
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=step_6_hop_N_complete --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=completed_hops --value=N
```

## Step 7 — Residual remediation + verify vs baseline oracle (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 7: Residual remediation + verify vs baseline oracle**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

The tool leaves a residual (~10–30%, stack-dependent). Remediate it with the LLM, but **each fix
passes the Write Gate** (`APPROVE ADO-{ID}`), and the baseline-oracle regression net catches drift.
Then evaluate verification per hop:

```bash
node "$PLUGIN_DIR/scripts/upgrade-orchestrate.cjs" verify --hops=<v1,v2> --hop-results=<pass|fail,...> --json
```

Exit `0` = verified (merge allowed); exit `9` = **blocked** — the first failing hop is pinned with
resolution options and **no merge is allowed** until verify passes. If a residual auto-stop ceiling is
hit, hand back to the developer with the residual list. Post-upgrade, offer the ladder
(→ Rewrite / Replatform) per `references/gap-risk-report.md`.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=verify --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=verify_report_path --value={VERIFY_REPORT_PATH}
```

## Step 8 — Checkpoint + judge at every gate (implemented — AC-F9/F10, inline)

> 📊 **STEP BOUNDARY — Step 8: Checkpoint + judge at every gate**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

Each gate (report · residual · verify) records a verdict from an **independent judge** (separate agent
+ separate model — see `$PLUGIN_DIR/skills/shared/judge.md`) and persists it to the resumable
migration ledger (`$PLUGIN_DIR/skills/shared/migration-ledger-schema.md`):

```bash
node "$PLUGIN_DIR/scripts/upgrade-checkpoint.cjs" init --ado=<ID> --stack=<token> --from=<v> --to=<v>
node "$PLUGIN_DIR/scripts/upgrade-checkpoint.cjs" set-gate --ado=<ID> --gate=<report|verify> --verdict=<PASS|REVISE|BLOCK>
```

**Intake gate precondition on the report gate (fail-closed — upgrade's chain point).** Because the
Gap+Risk report is LLM-authored (no downstream script like rewrite's `decompose` to hard-refuse),
the `report` gate is where intake is enforced: BEFORE recording `--gate=report --verdict=PASS`, run
`intake-verify.cjs check-gate --ado=<ID>` — if it exits non-zero, the report gate **cannot** be
recorded PASS. This makes the headline deliverable impossible to produce on unread source.

The ledger is a single-writer, **merge-write** contract (never clobbers fields it does not own), so
the run is resumable and safe to hand off. As of Story 2 the judge and checkpoint are the **shared
substrate** (`skills/shared/judge.md`, `skills/shared/migration-ledger-schema.md`);
`upgrade-checkpoint.cjs` is a thin adapter over `scripts/checkpoint-ledger.cjs` that owns the
`payload.upgrade` namespace. (The local `references/judge-inline.md` / `checkpoint-inline.md` are now
redirects to the shared docs.)

## Step 8a — Generate test plan (after verify passes)

> 📊 **STEP BOUNDARY — Step 8a: Generate test plan**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `UPGRADE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

After Step 7 verification passes (`upgrade-orchestrate.cjs verify` exits 0), invoke
the test-plan skill in subagent mode — no prompt, no budget warning:

```
Read $PLUGIN_DIR/skills/test-plan/SKILL.md and execute it with:
  --source upgrade --subagent
  ADO ID: {ADO_ID}
Record the returned test plan path in the ledger:
  payload.upgrade.testPlanPath = {path}
```

If the test-plan skill fails, log a warning in the migration log and continue — the
upgrade is not gated on test plan generation.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=upgrade --ado={ADO_ID} --gate=step_8a_test_plan --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=upgrade --ado={ADO_ID} --key=testPlanPath --value={TEST_PLAN_PATH}
```

---

## Hard Rules

- NEVER record the `report` gate PASS before the **source-context intake gate** is PASS — the report
  gate calls `intake-verify.cjs check-gate` (upgrade's fail-closed chain point, since the report is
  LLM-authored). The Source Context Manifest must fully account for every `graph.json` module.
- NEVER accept `PARTIAL`/`unknown` when the resolving source is reachable in a configured root —
  resolve it at intake (exit 5), never defer.
- NEVER hand-author the bulk transform of working code — drive the deterministic tool.
- NEVER proceed past a `false-upgrade` classification — route to Rewrite; make no edits.
- NEVER offer a fallback for an `unsupported` stack — STOP and list supported stacks. No fabrication.
- NEVER edit source before `APPROVE DESIGN` and a baseline tag exist (design gate + oracle anchor).
- If the gap/risk review or feedback loop reveals the upgrade is **infeasible in place**, route to
  **Rewrite** — the discovered-late equivalent of the false-upgrade catch. NEVER force an infeasible
  upgrade forward to the baseline tag.
- Author only NON-EMPTY delta documents — never produce "No change" filler that dilutes the report.
- Integration verification runs INSIDE the gap/risk analysis (Step 3) — not a separate pre-options step.
- ALWAYS one commit per version hop (bisectable); NEVER blend hops into one diff.
- ALWAYS gate every residual fix behind the Write Gate; NEVER merge until verification passes.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` — never a bare relative path.
- ALWAYS initialize `docs/migrations/{ADO}/migration-log.md` with its full header BEFORE writing
  the first event entry — the file must exist before any [INTEGRATION] entries are appended to it.
- ALWAYS save the full Gap + Risk report to `docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md`
  BEFORE presenting the APPROVE REPORT gate — chat output is not durable.
- ALWAYS present the explicit APPROVE REPORT gate; NEVER infer YES from silence.
- ALWAYS ground breaking-change facts in an authoritative source; NEVER source them from model memory.
- ALWAYS tag each report claim VERIFIED (dated authoritative source) or INFERRED; NEVER fabricate a
  source to reach VERIFIED, and NEVER present an INFERRED claim as settled fact.
- ALWAYS state, in the report, which side of the tool-coverage line the project sits on (AC-F3).
- The gap/risk report IS the feasibility document (Document 7) — no separate `migration-feasibility.md`.
- Write migration log entries per `migration-log-spec.md` at each phase.
