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
judge/checkpoint substrate (AC-F9/F10) in Steps 5–7.

## Developer reply gates

```
Developer reply gates (3 total — all other steps auto-proceed):
  INTAKE CONFIRMED ADO-<ADO-ID>   — Step 3 gate (after intake review)
  APPROVE REPORT ADO-<ADO-ID>     — Step 4 gate (after gap/risk report)
  APPROVE DESIGN ADO-<ADO-ID>     — Step 4.5 gate (after decisions doc)
```

## Step 1 — Intake & classification (implemented — the highest-risk component)

> 📊 **STEP BOUNDARY — Step 1: Intake & classification**
> Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step1","ado":"{ADO_ID}"}`
> The checkpoint is flushed — resuming here is safe.

**Script preflight — verify all required plugin scripts exist before any execution:**
```bash
REQUIRED_SCRIPTS=(
  "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs"
  "$PLUGIN_DIR/scripts/upgrade-checkpoint.cjs"
  "$PLUGIN_DIR/scripts/migration-source-detect.cjs"
  "$PLUGIN_DIR/scripts/upgrade-classify.cjs"
  "$PLUGIN_DIR/scripts/intake-verify.cjs"
  "$PLUGIN_DIR/scripts/upgrade-tool-preflight.cjs"
  "$PLUGIN_DIR/scripts/upgrade-knowledge-cache.cjs"
  "$PLUGIN_DIR/scripts/research-cache.cjs"
  "$PLUGIN_DIR/scripts/upgrade-orchestrate.cjs"
)
for script in "${REQUIRED_SCRIPTS[@]}"; do
  [ -f "$script" ] || { echo "❌ MISSING SCRIPT: $script — re-install the plugin or run /setup-sync."; exit 1; }
done
echo "✅ All required scripts present."
```
If any script is missing: **STOP** — do not proceed. Run `/setup-sync` or reinstall the plugin.

```bash
# DECISION: checkpoint interface consolidation (AC-F15 — fully implemented)
# Options considered:
#   A) Leave all set-payload calls on checkpoint-ledger.cjs — rejected: two CLI paths to maintain.
#   B) Route init + set-gate + baseline-tag/hops through upgrade-checkpoint.cjs only (Story 4) —
#      was the partial Known Gap; left --key/--value calls on checkpoint-ledger.cjs.
#   C) Extend upgrade-checkpoint.cjs set-payload with --key=<k> --value=<v> and --payload-json=<json>
#      — chosen (AC-F15 follow-up, implemented in ADO-9012 continuation): fully consolidates all
#      upgrade-skill checkpoint writes through one CLI, eliminating direct checkpoint-ledger.cjs usage.
node scripts/upgrade-checkpoint.cjs init --ado={ADO_ID}
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
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_1_classified --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=stack --value={STACK}
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=from --value={FROM}
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=to --value={TO}
```

**Create upgrade-runbook.md** (documentation artifact — exempt from Write Gate):
```bash
mkdir -p "docs/migrations/{ADO_ID}" && \
cat > "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md" << 'RUNBOOKEOF'
# Upgrade Runbook — ADO-{ADO_ID}
Stack: {STACK} · From: {FROM} → To: {TO}
Date: {DATE}

---

## Step 1 — Tool Preflight

_Populated with install steps if a required tool is missing._

## Step 5 — Baseline and Execution Plan

_Populated with hop execution commands._

## Step 6 — Hop Execution

_Populated with per-hop commands._

## Step 7 — Residual Fixes

_Populated with fix actions._
RUNBOOKEOF
head -1 "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md" && echo "Runbook OK."
```
If exit non-zero: `Cannot write upgrade-runbook.md. Free space and re-invoke.` — STOP immediately.

**Tool preflight (hard BLOCK — not a gate).** Verify the stack-required CLI tool is present based on
`{STACK}` from classification:

| Stack token | Required tool | Check command |
|---|---|---|
| `dotnet*` | dotnet CLI | `command -v dotnet` |
| `nodejs*` / `javascript*` | node | `command -v node` |
| `java*` / `spring*` | mvn | `command -v mvn` |
| `python*` | python3 or python | `command -v python3 \|\| command -v python` |

On missing tool:
1. Append to runbook:
   ```bash
   printf '\n### Tool Preflight — BLOCKED\n\nRequired tool not found: {MISSING_TOOL}\nInstall steps: see references/tool-matrix.md.\nRe-invoke UPGRADE ADO-{ADO_ID} after installing.\n' \
     >> "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md"
   ```
2. Print to chat: `⛔ Required tool not found: {MISSING_TOOL}. Install steps written to upgrade-runbook.md. Re-invoke after installing.`
3. **STOP** — do not proceed further.


## Step 2 — Tool-availability preflight (implemented — AC-F2)

> 📊 **STEP BOUNDARY — Step 2: Tool-availability preflight**
> The checkpoint is flushed — resuming here is safe.

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
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_2_tool_available --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=tool_available --value={TOOL_AVAILABLE}
```

## Step 3 — Web-grounded gap/risk analysis (implemented — AC-F3)

> 📊 **STEP BOUNDARY — Step 3: Web-grounded gap/risk analysis**
> Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step3","ado":"{ADO_ID}"}`
> The checkpoint is flushed — resuming here is safe.

Reached only after Step 1 classified `upgrade` and Step 2 found the tool `available`. Gather the
breaking-change / deprecation facts for the planned hops. The **LLM grounds; the cache engine tags +
stores** — the engine makes no network call (see `references/gap-risk-report.md`).

**Breaking-changes baseline — read before gap/risk analysis.** This step ensures known
breaking changes are never silently missed. Follow `$PLUGIN_DIR/skills/shared/breaking-changes-spec.md`
Section 2 for the full read-priority shell block. Summary:

```bash
DOC_NAME="{stack}-{from}-to-{target_version}.md"
TIER1=".claude/migration-knowledge/breaking-changes/${DOC_NAME}"
TIER2="$PLUGIN_DIR/.plugin-cache/breaking-changes/${DOC_NAME}"
FRESHNESS_DAYS=90
BC_DOC=""
# [run read-priority block from breaking-changes-spec.md Section 2]
# If BC_DOC is still empty after both tier checks: invoke agent per Section 3 of the spec.
```

When invoking the agent, collect detected packages first (use the stack-appropriate command):
```bash
# dotnet — write to temp file (Windows-safe, no /dev/stdin)
PKGS_TMP="$(mktemp).pkgs.txt"
PKGS_JSON_TMP="$(mktemp).pkgs.json"
dotnet list package 2>/dev/null | grep "^   >" | awk '{print $2}' > "$PKGS_TMP" 2>/dev/null || true
node -e "
  const fs=require('fs');
  try {
    const lines=fs.readFileSync('$PKGS_TMP','utf8').trim().split('\n').filter(Boolean);
    fs.writeFileSync('$PKGS_JSON_TMP',JSON.stringify(lines));
  } catch(e){ fs.writeFileSync('$PKGS_JSON_TMP','[]'); }
"
DETECTED_PACKAGES=$(node -e "process.stdout.write(require('fs').readFileSync('$PKGS_JSON_TMP','utf8'))")
```

After `BC_DOC` is set, read the document as the starting checklist:
```bash
Read $BC_DOC
```
Every HIGH item in the document is a candidate RED finding. Every MEDIUM item is a candidate
YELLOW finding. Every `status: UNKNOWN` package entry is surfaced with a
`⚠ Package changelog not verified` warning in the gap/risk report.

This step runs before web-grounded analysis — it is the mandatory baseline. The web-grounded
analysis below supplements and validates it, not the other way around.

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
grep -c "## Decisions summary" docs/migrations/{ADO}/migration-log.md && \
cat > docs/migrations/{ADO}/lessons.md << 'LESSONSEOF'
# Lessons — {AppName} Upgrade (ADO-{ID})
_Parallel index to `migration-log.md ## Lessons`. Every `[LESSON]` entry is simultaneously appended here._
_Read by the skill at Step 9 for TP generation — the full migration log is never read for this purpose._

LESSONSEOF
head -1 docs/migrations/{ADO}/lessons.md
```

If the chain exits non-zero (directory creation failed, write failed, `head` returns wrong first line, `grep` count is 0, or `lessons.md` write failed): **stop immediately** — do not continue. Report the exact shell output.
Recovery is a separate, explicitly approved action — never automatic.
This is a documentation artifact — not subject to the Write Gate.

**Upgrade intake generation — 3-pass auto-generated intake (AC-F8, AC-F9, AC-F10, AC-F11, AC-F12, AC-F13, AC-NF1)**

The `docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md` is generated automatically by a
3-pass detection sequence. No hand-authoring required.

**Context budget check (AC-NF1).** Before starting Pass 1.
N = number of packages in the dependency manifest.
If N > 30 or the session feels slow / responses are truncated:
  1. Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step3-pass1","ado":"{ADO_ID}"}`
  2. Surface this and STOP:
     > Context may be near capacity for a {N}-package Pass 1 registry scan.
     > What is saved: Step 2 tool preflight complete (step_2_tool_available gate PASS).
     > Type `UPGRADE RESUME ADO-{ADO_ID}` in a new session — Pass 1 starts from package 0.
     > — or — run /compact in this session, then type `UPGRADE RESUME ADO-{ADO_ID}`.
If context is healthy: proceed.

**Create upgrade-intake.md** (migration artefact — exempt from the Write Gate):
```
Create docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md
Header: ADO-{ADO_ID} · stack: {stack} · {from_version} → {target_version} · Date: {date}
Status: GENERATING
12 section stubs:
  ## Section 0 — Baseline and target
  ## Section 1 — Upgrade path
  ## Section 2 — Version coupling
  ## Section 3 — Deprecated API removals
  ## Section 4 — Breaking behaviour changes
  ## Section 5 — Package compatibility
  ## Section 6 — SDK renames and merges
  ## Section 7 — Security advisories
  ## Section 8 — Build and tooling
  ## Section 9 — Test framework compatibility
  ## Section 10 — Configuration changes
  ## Section 11 — Platform constraints
```

**Pass 1 — Live registry query (AC-F12, AC-F13).** For each package i in the dependency manifest:

1. Write to checkpoint ledger BEFORE the query (AC-F13):
   ```bash
   node scripts/upgrade-checkpoint.cjs set-payload \
     --ado={ADO_ID} \
     --payload-json='{"intake_pass":1,"intake_progress_index":<i>}'
   ```
2. Query the package registry for compatibility with {target_version}.
3. Classify result as one of:
   - ✅ COMPATIBLE
   - ⛔ BLOCKER (no compatible version exists)
   - ⚠ MIGRATION REQUIRED (compatible version requires code changes)
   - ⚠ BEHAVIORAL CHANGE (compatible version has behavioural differences)
   - DEVELOPER REVIEW _(reason code — see below)_
4. Immediately append the result to Section 5 of upgrade-intake.md (AC-F12).

**DEVELOPER REVIEW reason codes (AC-F11):**
- `(registry timeout)` — query timed out; developer should check manually
- `(no compatible version found)` — registry responded but no version satisfies target constraint
- `(registry unavailable)` — all registry queries failing; Pass 1 continues; header notes count

If all Pass 1 registry calls fail, prepend to Section 5:
```
Registry unreachable — compatibility check skipped. All packages labeled
DEVELOPER REVIEW (registry unavailable). Passes 2 and 3 still run.
```

**UPGRADE RESUME resumability (AC-F13).** On UPGRADE RESUME, read `intake_pass` and
`intake_progress_index` from the checkpoint ledger. Skip packages with index <
`intake_progress_index`; resume from the next unprocessed package.

> ⚓ **Safe point SP-Pass1 — Pass 1 complete, before Pass 2**
> Checkpoint flushed: `intake_pass=1`, `intake_progress_index={N}` (all {N} packages queried).
> If the session feels slow, responses are truncated, or < 30K remaining:
>   1. Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step3-pass2","ado":"{ADO_ID}"}`
>   2. Surface this and STOP:
>      > Pass 1 complete — {N} packages queried, results written to Section 5 of upgrade-intake.md.
>      > Type `UPGRADE RESUME ADO-{ADO_ID}` in a new session — resumes at Pass 2 (knowledge cache mapping). No registry re-queries needed.
> If context is healthy: proceed to Pass 2.

**Pass 2 — Knowledge cache replacement mapping.** Read
`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/mappings/{stack}-upgrade.md` for the target hop.
Extract replacement mappings (SDK renames, namespace changes, merged packages). Write results to
Sections 6, 8, 10 as applicable.

```bash
node scripts/upgrade-checkpoint.cjs set-payload \
  --ado={ADO_ID} \
  --payload-json='{"intake_pass":2}'
```

If the per-stack knowledge file does not exist, write to affected sections:
`Not applicable — evidence: no per-stack knowledge file for {stack} (follow-up F-1 work).`

> ⚓ **Safe point SP-Pass2 — Pass 2 complete, before Pass 3**
> Checkpoint flushed: `intake_pass=2`.
> If the session feels slow, responses are truncated, or < 30K remaining:
>   1. Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step3-pass3","ado":"{ADO_ID}"}`
>   2. Surface this and STOP:
>      > Passes 1 and 2 complete — package compatibility and knowledge cache mapping done.
>      > Type `UPGRADE RESUME ADO-{ADO_ID}` in a new session — resumes at Pass 3 (codebase grep). No re-queries or re-mapping needed.
> If context is healthy: proceed to Pass 3.

**Pass 3 — Codebase grep.** For each behavioral change pattern in the per-stack knowledge file:
- Grep the codebase for the pattern.
- If found: append to Section 4 with file locations and required action.
- If not found: write `Not applicable — evidence: pattern not detected in codebase.`

Write findings to Sections 3, 4, 7 as applicable.

```bash
node scripts/upgrade-checkpoint.cjs set-payload \
  --ado={ADO_ID} \
  --payload-json='{"intake_pass":3}'
```

Every section (0–11) renders with findings or `Not applicable — evidence: <detection result or
knowledge file statement>`. No section is silently skipped (AC-F9).

**Summary banner (AC-F10).** After all 3 passes complete, count findings and prepend to upgrade-intake.md:
```
## Summary
⛔ N blockers · ⚠ N migration required · ⚠ N behavioral changes · ✅ N compatible · N sections not applicable
Status: READY FOR REVIEW
```

**Gate: INTAKE CONFIRMED (AC-F8).** Display:
```
📋 upgrade-intake.md generated — open in VS Code (Ctrl+Shift+V):
   docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md

   Summary: ⛔ N blockers · ⚠ N migration required · ⚠ N behavioral changes
            · ✅ N compatible · N sections not applicable

   Confirming means: baseline correct · statuses correct · not-applicable evidence holds.

   INTAKE CONFIRMED ADO-{ADO_ID}
```

The INTAKE CONFIRMED gate is hook-enforced (AC-F1). Skill stops until keyword received.

After INTAKE CONFIRMED, invoke:
```bash
node scripts/upgrade-checkpoint.cjs intake-verify --ado={ADO_ID}
```
Exit non-zero → report: "Intake not recorded — generate intake first (Pass 1–3 must complete)."
Only proceed to Step 4 once this exits 0.

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
# Flush checkpoint — intake confirmed and verified (intake_pass=3 in ledger)
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=intake_context --verdict=PASS
```

## Step 4 — Decision-grade Gap + Risk report (implemented — AC-F3)

> 📊 **STEP BOUNDARY — Step 4: Decision-grade Gap + Risk report**
> The checkpoint is flushed — resuming here is safe.

**Invoke the migration-research-agent before assembling the report.** Ground the source stack
lifecycle and CVE signals in cited external facts. Read `skills/shared/migration-research-spec.md`
Section 5 for the invocation pattern.

Construct the input (upgrade mode — use detected stack and version from Step 1 classification):
```json
{
  "migration_type": "upgrade",
  "plugin_dir": "$PLUGIN_DIR",
  "source_layers": [
    { "stack": "{current stack token}", "version": "{current version}", "cloud_hosted": "{provider or null}" }
  ],
  "target_layers": [
    { "stack": "{current stack token}", "version": "{target version}" }
  ]
}
```

**Research bundle cache — check before invoking, write immediately after.**
The agent invocation is expensive and must not repeat on context-exhaustion re-runs or resume.
The cache is machine-level (shared across all projects on this machine) and is never committed to any repo.

```bash
CACHE_KEY="{stack}-{from_version}-to-{stack}-{target_version}"
CACHE_BUNDLE="temp/cache-bundle-{ADO_ID}.json"
node "$PLUGIN_DIR/scripts/research-cache.cjs" lookup \
  --key="$CACHE_KEY" --extract-bundle-to="$CACHE_BUNDLE"
CACHE_EXIT=$?
# 0=fresh, 1=miss, 2=stale
if [ "$CACHE_EXIT" -eq 2 ]; then
  echo "⚠ Research cache is stale (30-90 days). Using cached data — consider refreshing."
fi
# CACHE_BUNDLE now contains the research bundle on hit; empty/absent on miss — use it for gap/risk analysis below
# Store cache key in checkpoint so resume can locate the bundle without re-deriving
node "$PLUGIN_DIR/scripts/upgrade-checkpoint.cjs" set-payload \
  --ado={ADO_ID} --key=research_cache_key --value="$CACHE_KEY"
```

Then apply confidence rendering rules from Section 4 (authoritative source —
reproduced here for reference only; Section 4 governs):
- `confidence=high` → state as fact: `{value} [{source_url}, {retrieved_date}]`
- `confidence=medium` → `(industry benchmark as of {retrieved_date})`
- `confidence=low` → `WARNING: {claim} — unverified, check: {canonical_url or source_url}`
- `confidence=UNKNOWN` → `WARNING: {fact type} not found — check: {canonical_url}`

Assemble the report per the schema in `references/gap-risk-report.md`. It is the **headline
deliverable** — emit it whether or not the developer proceeds:

- State which side of the **tool-coverage line** the project sits on (strong vs weak tool).
- Classify every item on the feasibility spine (🟢/🟡/🔴/⛔) and show its **source tag** (VERIFIED +
  dated url · or INFERRED).
- Include the **dependency ledger** — a package with no target-compatible version is a hard ⛔ BLOCKER.
- List what's possible / blocked / manual, then the **post-upgrade ladder** (→ Rewrite / Replatform).
- Even a RED/BLOCKER verdict yields a decision-grade report (graceful degradation) — never a bare fail.

**PO framework — add these two sections to the gap+risk report (populate from agent bundle):**

**What happens if not resolved:**
- Source version EoL: `{source eol_status.status} as of {eol_status.date} [{source_url}, {retrieved_date}]`
  — or `WARNING: EoL date not found for {stack} {version} — check: {canonical_url}` if UNKNOWN
- CVE exposure: `{source cve_exposure.level} [{source_url}, {retrieved_date}]`
  — or `WARNING: CVE exposure not determined — check: {canonical_url}` if UNKNOWN
- If EoL is within 12 months: state the vendor support end date explicitly and the concrete
  consequence (security patch gap, no further official vulnerability fixes).

**Whether it can remain (residual risks that survive the upgrade even on success):**
These risks are NOT resolved by completing the upgrade — state each explicitly:
- Application-layer breaking changes not yet addressed: `[project-specific — requires your input]`
  (deprecated APIs removed in the target version, framework behaviour changes in the target)
- Team retraining gap: `[project-specific — requires your input]`
  (new patterns introduced in the target version the team is not yet familiar with)
- Downstream dependency compatibility: `[project-specific — requires your input]`
  (packages not yet compatible with the target version — cross-reference the dependency ledger above)
- Ecosystem signal at target version: `{target ecosystem_health.signal} [{source_url}, {retrieved_date}]`
  — or `WARNING: ecosystem signal not available for {stack} {target version} — check: {canonical_url}` if UNKNOWN

**The gap/risk report IS Document 7 (feasibility).** Per `feasibility-spec.md`, this spec governs the
report's format directly — no separate `migration-feasibility.md` is produced for upgrade.

**Save to disk.** After emitting the report in chat, write the full content to:

```
docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md
```

Documentation artifact — not subject to the Write Gate. Create the directory if absent.
Record the path: `node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=report_path --value=<path>`

**Write `[FINDING]` migration log entries — one per RED or YELLOW item in the report.** Do this immediately after the report is saved to disk, before presenting the APPROVE REPORT gate. Pre-append guard first:
```bash
test -f docs/migrations/{ADO}/migration-log.md && echo "log OK" || echo "log ABSENT — STOP: return to Step 3 log init"
```
For each finding, use evidence from the report's source citations as PROV references:
- RED/⛔ item → `[FINDING]` with `**Action taken:** Developer decision required — this item blocks safe upgrade until resolved.`
- YELLOW/🟡 item → `[FINDING]` with `**Action taken:** Flagged for cautious proceed — monitor during implementation.`

**Argue/revise cycle — write `[REVISION]` immediately when a finding is challenged.**
If the developer disputes a finding (challenges severity or validity) and the report is updated, write a `[REVISION]` entry at that moment — do NOT wait for APPROVE REPORT:
```markdown
### [REVISION] Gap-risk finding updated — {finding title} — {date}

**Triggered by:** Developer challenged: {what was disputed}
**Evidence provided:** {developer's argument or counter-evidence}
**Documents revised:** ADO-{ADO_ID}-gap-risk-report.md
**Sections changed:** {which finding row changed}
**Change:** {original severity/classification} → {new severity/classification}
**Validation result:** PASS — developer-provided evidence accepted
```

**Run the judge on the gap/risk report** per `$PLUGIN_DIR/skills/shared/judge.md` before presenting APPROVE REPORT. Record verdict in checkpoint immediately after judge completes:
```bash
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} \
  --payload-json='{"judge_verdicts":[{"gate":"report","verdict":"{JUDGE_VERDICT}","model":"{MODEL_USED}","at":"{DATE}","summary":"{JUDGE_ONE_LINE_SUMMARY}"}]}'
```
If judge returns REVISE: apply corrections, re-run judge. If BLOCK: hard-stop — named approver required before APPROVE REPORT.

**APPROVE REPORT gate.** Present this prompt and stop:

```
📊 GAP + RISK REPORT SAVED → docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md

The report is your value from this run — saved whether or not you proceed to execution.

  APPROVE REPORT ADO-{ID}  — continue to delta design documents (Step 4.5)
  NO                       — stop here; the report remains on disk for your review
```

Only `APPROVE REPORT ADO-{ID}` continues. Record the choice:
  `node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=proceed_after_report --value=<true|false>`
Write a `[DECISION]` migration log entry for this gate (verbatim judge verdict in `**Judge analysis:**` field).

The report is the point where value is delivered. Everything below runs **only if the developer
chooses to proceed** (replies `APPROVE REPORT ADO-{ID}`) — and every step that touches the working
repo is authored here but executed by the developer (LLM authors + rehearses, human executes).

> Judge substrate (Step 4): record the verdict basis for each finding in the gap/risk report.
> Verdicts are recorded per-finding in the report; summary recorded in checkpoint. See `skills/shared/judge.md`.

```bash
# Flush checkpoint before next step
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=report --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=report_path --value={REPORT_PATH}
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=proceed_after_report --value={PROCEED_AFTER_REPORT}
```

## Step 4.5 — Decisions doc + APPROVE DESIGN (implemented — AC-F16)

> 📊 **STEP BOUNDARY — Step 4.5: Decisions doc + APPROVE DESIGN**
> The checkpoint is flushed — resuming here is safe.

Generate `docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-decisions.md` — one entry per RED or BLOCKER
item from the gap/risk report that requires a migration pattern decision.

If no RED or BLOCKER items exist, write a single line:
```
No architectural decisions required — all items are routine fixes.
```

**Format per entry (one block per RED/BLOCKER item):**
```markdown
## Decision: <item title from gap/risk report>

**Severity:** RED | BLOCKER
**Gap/Risk item:** <item ID or heading>

**Options considered:**
- A) <option> — rejected: <reason>
- B) <chosen option> — chosen: <reason>

**Decision:** <chosen option>
**Migration pattern:** <pattern name or brief description>
```

**Route-to-Rewrite escape hatch:** If the gap/risk review reveals the upgrade is **infeasible in place**
(accumulated RED/BLOCKER evidence with no viable migration pattern), route to **Rewrite**.
Do NOT proceed to the baseline tag on an infeasible upgrade.

**APPROVE DESIGN** — required before proceeding to baseline tag.

```bash
# Flush checkpoint before next step
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=design_approved --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=design_doc_path --value={DESIGN_DOC_PATH}
```

## Step 5 — Baseline tag + working branch (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 5: Baseline tag + working branch**
> Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step5","ado":"{ADO_ID}"}`
> The checkpoint is flushed — resuming here is safe.

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

**Append execution plan to upgrade-runbook.md** — write the ordered commands to disk before executing:
```bash
printf '\n## Step 5 — Baseline and Execution Plan\n\n' >> "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md"
# Append each planned command from upgrade-orchestrate.cjs output (git tag, git checkout -b, tool commands, git commit per hop)
```

```bash
# Flush checkpoint before next step
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_5_baseline_tagged --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --baseline-tag={BASELINE_TAG}
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --hops={HOPS}
```

## Step 6 — Run the stack tool per hop (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 6: Run the stack tool per hop**
> The checkpoint is flushed — resuming here is safe.

Walk the runbook one hop at a time. For each hop: run the deterministic tool for that hop, then make
**exactly one commit** (`commit_plan[i].commit_msg`). One commit per hop keeps history bisectable so
a later verify failure pins the exact hop. Never blend hops into one diff; never hand-author the bulk
transform.

**Append per-hop commands to upgrade-runbook.md** before running each hop:
```bash
printf '\n### Step 6 — Hop %d: %s → %s\n\n' {HOP_N} {FROM_V} {TO_V} >> "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md"
# Append this hop's tool command and commit command
```

```bash
# Flush after each hop (replace N with 1-based hop index)
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_6_hop_N_complete --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=completed_hops --value=N
```

## Step 7 — Residual remediation + verify vs baseline oracle (implemented — AC-F3 execution)

> 📊 **STEP BOUNDARY — Step 7: Residual remediation + verify vs baseline oracle**
> The checkpoint is flushed — resuming here is safe.

The tool leaves a residual (~10–30%, stack-dependent). Remediate it with the LLM, but **each fix
passes the Write Gate** (`APPROVE ADO-{ID}`), and the baseline-oracle regression net catches drift.

**Migration log scoping — write entries only when required (AC-F20):**

| Entry | When required |
|---|---|
| `[FINDING]` | Fix was NOT anticipated by the intake (unexpected find) |
| `[DECISION]` | Non-obvious choice between two or more viable approaches |
| No entry | Routine fix anticipated by the intake (e.g. package version bumps, API renames in upgrade-decisions.md) — the Write Gate diff is the record |

**For each unanticipated fix — write `[FINDING]` BEFORE applying** (pre-append guard first: `test -f docs/migrations/{ADO}/migration-log.md`):
   ```markdown
   ### [FINDING] {error title — e.g. "Swashbuckle namespace compile error"}

   **Discovered:** {exact error message or symptom} — PROV: {build output / developer report}
   **Why it matters:** {what breaks without this fix}
   **Wrong approach to avoid:** {naive fix that would not work, if any}
   **Action taken:** Fix prepared — pending APPROVE ADO-{ID}
   ```

**For each non-obvious decision — write `[DECISION]` AFTER fix approved via Write Gate:**
   ```markdown
   ### [DECISION] Fix applied — {error title} — {date}

   **Approved:** Fix for {error} — APPROVE ADO-{ID}
   **Judge verdict:** N/A (residual fix — no formal judge gate for individual fixes)
   **Judge analysis:** N/A
   **Reasoning:** {why this approach was chosen over alternatives}
   **Alternatives rejected at this point:** {if any were considered}
   **Constraints that shaped this decision:** {e.g. API removed, no compatible replacement available}
   ```

3. **If the fix reveals a migration pattern worth capturing — write `[LESSON]` simultaneously to `migration-log.md` AND `lessons.md`** (same Bash chain, both must succeed):
   - Trigger: the fix addresses something the gap/risk report did NOT anticipate, OR the root cause was non-obvious.
   - If uncertain: write the lesson. It is easier to remove an unnecessary lesson than to reconstruct a lost one.
   - Pre-append guard for lessons.md: `test -f docs/migrations/{ADO}/lessons.md || { echo "lessons.md ABSENT — STOP"; exit 1; }`

4. **Append to upgrade-runbook.md** — after each fix is applied via Write Gate:
   ```bash
   printf '\n### Step 7 — Residual Fix: %s\n\n%s\n' "{ERROR_TITLE}" "{FIX_SUMMARY}" \
     >> "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md"
   ```

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
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=verify --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=verify_report_path --value={VERIFY_REPORT_PATH}
```

> Judge substrate (Step 7): per-hop verdicts recorded in upgrade-runbook.md as each hop completes.
> Summary of anticipated vs. unanticipated fixes recorded in migration-log.md ([RESIDUAL SUMMARY] below).
> Judge and checkpoint substrate: `skills/shared/judge.md` · `skills/shared/migration-ledger-schema.md` · `upgrade-checkpoint.cjs` adapter.

**Write [RESIDUAL SUMMARY] to `docs/migrations/{ADO}/migration-log.md`** after all hops complete and verify passes (AC-F21). Pre-append guard first:
```bash
test -f docs/migrations/{ADO}/migration-log.md && echo "log OK" || echo "log ABSENT — STOP"
```
```markdown
[RESIDUAL SUMMARY]
Date: {YYYY-MM-DD}
ADO: {ADO-ID}
Anticipated fixes: {N} (matched intake findings; no individual log entries required)
Unanticipated fixes: {N} (each has a [FINDING] entry above)
Non-obvious decisions: {N} (each has a [DECISION] entry above)
```
If migration-log.md write fails: print `Cannot write [RESIDUAL SUMMARY] to migration-log.md. Free space and append manually.` and continue.

## Step 8a — Generate test plan (after verify passes)

> 📊 **STEP BOUNDARY — Step 8a: Generate test plan**
> The checkpoint is flushed — resuming here is safe.

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
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_8a_test_plan --verdict=PASS
node scripts/upgrade-checkpoint.cjs set-payload --ado={ADO_ID} --key=testPlanPath --value={TEST_PLAN_PATH}
```

## Step 9 — Completion gate + Lessons + Transferable Patterns

> 📊 **STEP BOUNDARY — Step 9: Completion gate + Lessons + Transferable Patterns**
> Write `.claude/active-task.json`: `{"skill":"upgrade","step":"step9","ado":"{ADO_ID}"}`
> The checkpoint is flushed — resuming here is safe.

Run automatically after Step 8a — no developer prompt required. This is a documentation step, not a gate.

**1. Artifact validation (AC-F19).** Verify each expected artifact exists on disk:
```bash
for artifact in \
  "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md" \
  "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md" \
  "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-decisions.md" \
  "docs/migrations/{ADO_ID}/ADO-{ADO_ID}-migration-log.md"; do
  [ -f "$artifact" ] && echo "✅ $artifact" || echo "⚠ Missing: $artifact. Check runbook for the step that was supposed to create it."
done
```
Print completion summary:
```
✅ Upgrade complete — ADO-{ADO_ID}
   Runbook    : docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-runbook.md
   Intake     : docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-intake.md
   Decisions  : docs/migrations/{ADO_ID}/ADO-{ADO_ID}-upgrade-decisions.md
   Log        : docs/migrations/{ADO_ID}/ADO-{ADO_ID}-migration-log.md
   Anticipated fixes   : {N from RESIDUAL SUMMARY}
   Unanticipated fixes : {N from RESIDUAL SUMMARY}
```

**2. Pre-append guards:**
```bash
test -f docs/migrations/{ADO}/migration-log.md && echo "log OK" || echo "log ABSENT — STOP"
test -f docs/migrations/{ADO}/lessons.md       && echo "lessons OK" || echo "lessons.md ABSENT — STOP"
```
If either file is absent: halt and report. Do not create them here — recovery belongs in Step 3.

**3. Generate Transferable Patterns from `lessons.md`.**
Read `docs/migrations/{ADO}/lessons.md`. For each `[LESSON]` entry found, generate one `TP-{N}` entry and append it to the `## Transferable Patterns` section of `docs/migrations/{ADO}/migration-log.md`. Strip all application-specific detail (app names, internal hostnames, package names specific to one firm, internal paths). State each pattern generically so it is usable by a future team with no knowledge of this project. Per `migration-log-spec.md` TP format:
```markdown
### TP-{N}: {Pattern title — generic, no app names}

**Applies to:** Stack: {stack token} · Migration type: upgrade
**When triggered by:** {condition stated generically}
**The pattern:** {2–4 sentences. Wrong approach first, then right approach, why it matters.}
**Source lesson:** [LESSON] {exact title from lessons.md}
```
If `lessons.md` is empty (no `[LESSON]` entries): write `_No lessons captured during this upgrade — add before closing._` to `## Transferable Patterns` as a reminder.

**4. Prompt developer to review.**
After writing all TP entries:
> ✅ **Upgrade complete.** Transferable Patterns written to `migration-log.md ## Transferable Patterns`.
> Review each TP entry — confirm it is accurate, portable, and free of project-specific detail.
> `docs/migrations/{ADO}/migration-log.md` — the full audit trail of this migration.

**5. Flush final checkpoint gate and clear active step:**
```bash
node scripts/upgrade-checkpoint.cjs set-gate --ado={ADO_ID} --gate=step_9_complete --verdict=PASS
```

> Write `.claude/active-task.json`: `{}` — clears the active step; hook exits 0 on next unrelated message.

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
- Write migration log entries per `migration-log-spec.md` — `[FINDING]` for unanticipated finds, `[DECISION]` for non-obvious decisions, `[RESIDUAL SUMMARY]` at end of Step 7; routine intake-matched fixes require no individual entry.
