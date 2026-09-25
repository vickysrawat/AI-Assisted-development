---
name: rewrite
description: >
  Out-of-place, generative code translation — source app → a NEW target-folder application in a
  different stack. The LLM is a generative AUTHOR (unlike Upgrade's orchestrator role). Resolves the
  migration posture from stack distance (port only for same-language+same-framework; any change forces
  re-architecture), presents target OPTIONS across assurance × effort × TCO (or accepts a BYO design
  held to the same scrutiny), decomposes the work in TARGET space along a dependency DAG (one inferred
  projection per option, committed from the target design), and generates
  one cluster per git worktree — each gated by design-quality, a per-cluster Behavioral Assurance Level
  (BAL) and an Enterprise-Readiness Level (ERL), behind a merge gate and a completion gate.
  Triggers on: "rewrite", "port to", "translate to", "Java to .NET", "Express to Angular".
---

# Skill: rewrite — out-of-place generative migration

_Skill version: 1.0 · Last changed: 2026-09-08 · Plugin compatibility: ≥3.20.0 · Consent: A_

> Part of the three-skill migration family (Upgrade · Rewrite · Replatform). Design of record:
> `docs/plans/migrationSkill/rewrite.md` (T1–T4) + `docs/plans/migrationSkill/README.md`.
> ADO-9000 Story 2. Uses the shared substrate: `skills/shared/migration-ledger-schema.md`,
> `skills/shared/judge.md`, `skills/shared/model-routing-spec.md`.

> ⚠ **Feature Gate** (CLAUDE.md §0): no generated code is written to the target until
> `APPROVE ADO-{ID}`. Source files are read-only; the target is a NEW folder.
>
> **Write Gate exemption — migration artifacts are fully exempt.**
> The Write Gate (CLAUDE.md §0) applies to target application source code only.
> Every migration artifact produced by this skill — migration log, migration tracker,
> options file, integration inventory, source context manifest, all 7 design documents,
> per-cluster assurance records, assurance summary, test plans, and all migration log
> entries — is written to disk immediately as it is produced, with no APPROVE gate.
> Never hold a migration artifact behind the Write Gate.

## Guiding principle

> **Greenfield with a defined intent.** The source is the intent oracle (runnable source / behavioral
> inventory), not a codebase to mutate. The LLM authors new target code, but every cluster's
> assurance is *measured* (BAL, weakest-link, mechanical denominators) and *gated* — never assumed.

## Skill shape

- **Locality:** out-of-place (a new target folder; source stays read-only).
- **LLM role:** generative author.
- **Oracle:** the running source / inventory-as-intent; per-cluster BAL is the assurance measure.

## Persona

Execute as **[SE] Elena Fischer — Senior Software Engineer**, weighing **[SA] Rafael Mendes**
(posture / options / architecture) at intake and **[QA] Sam Okonkwo** (BAL / test coverage) at the
gates. The persona sets *what to scrutinise* — never licenses assumption. See
`$PLUGIN_DIR/skills/shared/personas-spec.md`. Never name the persona in output.

## Model routing

- Generation (options, design, code): `${ICEA_MODEL:-claude-opus-4-8}`.
- Judge on every gate: the shared three-tier ladder — `${CRITIC_MODEL:-claude-sonnet-4-6}` →
  `${CRITIC_MODEL_MAX:-claude-opus-4-8}` (max effort) for high-risk / B-series → different-family
  panel for top-risk. See `$PLUGIN_DIR/skills/shared/judge.md` + `model-routing-spec.md`.

## Resolve PLUGIN_DIR — before any step

```
Read .claude/plugin-path.txt → PLUGIN_DIR
(if absent: §1a resolver from $PLUGIN_DIR/skills/shared/plugin-path-resolution.md)
```

## Stage flow

```
Initialize migration log + checkpoint ledger  (Step 0 — first, before any analysis)
Detect source stack                  (shared detector — migration-source-detect.cjs)
  → Resolve POSTURE                   (stack distance: port | re-architecture | rewrite-from-spec)
  → Integration verification          (integration-verification-spec.md — before options)
     + Oracle mode detection          (golden-master-spec.md Step 1 — feeds assurance ceiling)
  → Present OPTIONS (assurance × effort × TCO, INCLUDING a per-option target-space DAG projection)
     each option: clusters · wave schedule · effort · TCO · assurance ceiling (DAG basis: INFERRED)
     APPROVE OPTIONS → selected option's DAG committed (re-derived + promoted to `computed` at Step 2.5)
  → Author target design documents    (design-revision-spec.md → document-orchestrator.md)
     feedback loop available          (document-feedback.md · option-change-spec.md)
     APPROVE DESIGN
  → Resolve target execution profile  (strategies/{target}.md via strategy-resolve.cjs; STOP if missing)
  → for each WAVE (DAG-scheduled, parallel):
       spawn one SUBAGENT per cluster in the wave (isolated context + own git worktree)
       each cluster subagent: scaffold → generate → design-quality gate → BAL + ERL
       main session: orchestrate only — collects subagent verdicts, runs MERGE GATE per cluster
  → COMPLETION GATE (final BAL; B-series hard-block below floor)
  → every gate: shared LLM-as-judge verdict; checkpoint to the SHARED ledger
  → migration log: write entries immediately at each phase — never defer (see migration-log-spec.md for event formats)
```

## Context budget management

Migration is long-running. The main orchestrator session handles source analysis, options, and
design documents; cluster generation and BAL run in isolated subagents. **Before each major step,
apply the conservative bias rule — when in doubt, stop.**

### Token costs by stage

| Stage | Main-session cost | Subagent cost (isolated — does NOT count against main session) |
|---|---|---|
| Step 1 — Source analysis + posture | ~25–40K | — |
| Step 1.5 — Integration + oracle + intake | ~15–25K | — |
| Step 2 — Options analysis + options file | ~15–25K | — |
| Step 2.5 — Design docs (via document-orchestrator) | ~10–20K (orchestration + review loops) | ~8–15K per doc × 7 |
| Step 3 — Wave orchestration (per wave) | ~5–10K | ~30–60K per cluster (isolated) |
| Step 4 — BAL + ERL (inside cluster subagent) | — (runs in subagent) | ~10–20K per cluster |
| Step 5 — Completion gate + TP + Transferable Patterns | ~15–25K | — |

Main-session total (design phase complete): **~65–110K tokens.**
Main-session total (full migration, all orchestration): **~80–135K tokens.**

Cluster generation never inflates the main session — each cluster's 30–60K stays in its own subagent.

### Conservative bias rule (replaces estimation)

Do not attempt to count tokens. Apply these rules instead:

| Situation | Action |
|---|---|
| Starting Step 1 or 1.5 | Always safe to proceed — early stages |
| Starting Step 2 (options) | Proceed if Step 1.5 completed without issues |
| Starting Step 2.5 (7 design docs) | **Check:** has Step 2 produced a large options analysis (> 20K)? If the options + analysis was unexpectedly large (complex integration inventory, lengthy judge analysis), stop after Step 2 and resume in a new session for design docs. |
| Starting Step 3 (wave orchestration) | Step 3 spawns subagents — the main session cost is low (~5–10K per wave). Safe to proceed. |
| Starting Step 5 (completion gate) | Proceed — low cost (~15–25K). |
| **Any time the session feels slow, responses are truncated, or a previous step consumed much more than the estimate** | **STOP. Update tracker. Surface resume instruction.** Do not continue on a degraded session. |

### On context stop

When the conservative bias rule says stop:
1. Update `migration-tracker.md` — mark the current phase 🔄, set "Next action" to the next stage with exact command
2. Write any pending migration log entries
3. Surface the tracker path and say:

   > Context is approaching the limit for this session. All artifacts created so far are committed.
   > Start a new session and type `REWRITE RESUME {ADO}` — Claude will read `migration-tracker.md`
   > to orient without re-analysis.

4. STOP. Do not attempt to squeeze the next stage into the remaining tokens.

---

## Step 0 — Initialize artifacts (FIRST action — no exception)

> 📊 **STEP BOUNDARY — Step 0: Initialize artifacts**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

<!-- Checkpoint already flushed in this step. -->

Run this step **before any analysis, any Bash call, and any user-facing output** (other than
the friction-reduction offer, which is a question, not an artifact write). These are
documentation artifacts — **not subject to the Write Gate** — write them immediately.

**0. Script preflight — verify all required plugin scripts exist before any execution:**
```bash
REQUIRED_SCRIPTS=(
  "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs"
  "$PLUGIN_DIR/scripts/resolve-migration-roots.cjs"
  "$PLUGIN_DIR/scripts/migration-source-detect.cjs"
  "$PLUGIN_DIR/scripts/rewrite-decompose.cjs"
  "$PLUGIN_DIR/scripts/intake-verify.cjs"
  "$PLUGIN_DIR/scripts/graph-derive-documents.cjs"
  "$PLUGIN_DIR/scripts/strategy-resolve.cjs"
  "$PLUGIN_DIR/scripts/rewrite-bal.cjs"
)
for script in "${REQUIRED_SCRIPTS[@]}"; do
  [ -f "$script" ] || { echo "❌ MISSING SCRIPT: $script — re-install the plugin or run /setup-sync."; exit 1; }
done
echo "✅ All required scripts present."
```
If any script is missing: **STOP** — do not proceed. Run `/setup-sync` or reinstall the plugin.

**1. Create and verify the migration log** — write and verify in a single Bash chain (mechanically inseparable):

```bash
mkdir -p docs/migrations/{ADO} && \
cat > docs/migrations/{ADO}/migration-log.md << 'LOGEOF'
# Migration Log — {AppName} Rewrite (ADO-{ID})
Living document. Updated at every decision point. Never truncated — the full history is the asset.
Source: {full/source/path} ({source stack} {source version}) · Target: {target stack + versions} · {architecture pattern} · {hosting} · Skill: Rewrite
Started: {date} · ADO: {ADO ID}

Session continuation: share this file alongside the design documents and integration inventory.
Future migrations of similar apps: read the ## Lessons section.

---

## Phase 1: Source Analysis

## Phase 2: Options

## Phase 3: Target Design

## Phase 4: Generation

## Phase 5: Verification

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

If the chain exits non-zero (directory creation failed, write failed, `head` returns wrong first
line, or `grep` count is 0): **stop immediately** — do not proceed to tracker or checkpoint
creation. Report the exact shell output to the developer.
Recovery is a separate, explicitly approved action — never automatic:
```bash
# Recovery only — do not run automatically:
mkdir -p docs/migrations/{ADO}
# Then re-attempt the write + verify chain above.
```

Phase headings, Decisions summary, Risks accepted, and Lessons sections are pre-populated empty so events and rows can be appended as the migration progresses — never pre-fill them with placeholder data.

⚠ **Header values are not yet known at Step 0.** Write the file immediately with literal `TBD` in the Source and Target lines. After Step 1 completes (source-detect output available) and after the developer answers the keep-vs-redesign and hosting questions at Step 2, **update the header in-place** with the real values before writing the first `[FINDING]` entry. The log must exist from Step 0; the header is completed at Step 1.

**2. Initialize the checkpoint ledger (script interop only).**
```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" init --skill=rewrite --ado={ADO}
```
This creates `.claude/migration/{ADO}.checkpoint.json` — a **git-ignored, machine-readable** file
used exclusively for inter-script state sharing (`intake-verify.cjs`, `rewrite-bal.cjs`,
`checkpoint-ledger.cjs`). It is the **primary resume record** — machine-written and script-validated.
Do not describe it as a tracker. The `migration-tracker.md` (next) is the human-readable display artifact.

**3. Resolve migration roots** — discover all dependency repositories the migration should include.
Must run AFTER `checkpoint-ledger init` so set-source can merge into the existing ledger without auto-creating a parallel envelope. Writes `migrationRoots` to the SOURCE app's settings (not the target CWD):
```bash
node "$PLUGIN_DIR/scripts/resolve-migration-roots.cjs" \
  --source-path=<source-application-path-provided-by-developer> \
  --write-to=<source-application-path-provided-by-developer>/.claude/settings.local.json \
  --depth=3 --json
```
- Exit 0 → migrationRoots recorded in the source app's `.claude/settings.local.json` → continue.
- Exit 5 → plugin not integrated in source: present this prompt to the developer:
  ```
  ⚠ No plugin configuration found at {source_path}/.claude/settings.local.json.
     Are there dependency repositories the migration should include beyond {source_path}?
     Provide comma-separated absolute paths, or NONE to proceed with source root only:
     > ___
  ```
  On NONE: log a `[FINDING]` entry to `migration-log.md`: "Scope limited to source root only — dependencies may be missed."
  On paths provided: validate each exists (`test -d`), then manually write the developer-provided paths to `settings.local.json`.migrationRoots (alongside `sourcePath`) and continue.
- Exit 6 → STOP: report the missing directory path and which settings file configured it. Developer must fix before proceeding.

After exit 0 (or manual path entry on exit 5), record migrationRoots in the ledger:
```bash
SOURCE_SETTINGS=<source-application-path-provided-by-developer>/.claude/settings.local.json
MIGRATION_ROOTS=$(node -e "const fs=require('fs');try{const s=JSON.parse(fs.readFileSync(process.env.SOURCE_SETTINGS||'$SOURCE_SETTINGS','utf8'));process.stdout.write(JSON.stringify(s.migrationRoots||[]))}catch(e){process.stdout.write('[]')}")
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-source --skill=rewrite --ado={ADO} --roots-json="$MIGRATION_ROOTS"
```

**4. Create the migration tracker.**
Write `docs/migrations/{ADO}/migration-tracker.md` immediately — this is the human-readable,
committed resume point. Use this template (fill in what is known; mark the rest `⬜ Not started`):

```markdown
# Migration Tracker — {AppName} Rewrite ({ADO})

_Last updated: {date} · Phase: 0 — Initialize · Step: 0_

> **Resume instruction:** open this file + `migration-log.md` + `{ADO}-options.md` (once created)
> in VS Code, then type `REWRITE RESUME {ADO}` in Claude Code.
> Claude reads this file to orient — no re-analysis needed.

---

## Phase and step status

| Phase | Step | Status | Artifact(s) |
|---|---|---|---|
| 0 — Initialize | Log + tracker + ledger | 🔄 In progress | migration-log.md · migration-tracker.md |
| 1 — Source analysis | Stack detect + posture | ⬜ Not started | — |
| 1.5 — Integration + oracle | Inventory + manifest + intake gate | ⬜ Not started | integration-inventory.md · source-context-manifest.md |
| 2 — Options | Options file + APPROVE OPTIONS | ⬜ Not started | {ADO}-options.md |
| 2.5 — Target design | 7 design docs + APPROVE DESIGN | ⬜ Not started | target-*.md · migration-feasibility.md |
| 3 — Generation | Per-cluster code + design-quality gate | ⬜ Not started | target/ worktrees |
| 4 — BAL + ERL | Per-cluster assurance | ⬜ Not started | {ADO}-cluster-{N}-assurance.md |
| 5 — Gates | Merge gate + completion gate + TP | ⬜ Not started | {ADO}-assurance-summary.md |
| 5a — Test plans | Per-cluster + combined | ⬜ Not started | {ADO}-rewrite.test-plan.md |

---

## Committed artifacts

| Artifact | Path | Status |
|---|---|---|
| Migration log | docs/migrations/{ADO}/migration-log.md | ✅ Created |
| Migration tracker | docs/migrations/{ADO}/migration-tracker.md | ✅ Created |

---

## Open blockers

None yet.

---

## Next action

Run Step 1 — detect the source stack:
`node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=<source> --json`
```

**4. Verify the migration tracker and checkpoint ledger exist.**
(The migration log was verified by its write+chain exit code above — no additional check needed.)
```bash
test -f docs/migrations/{ADO}/migration-tracker.md && echo "tracker OK" || echo "tracker MISSING — STOP"
```
If the checkpoint ledger init (Step 3 above) produced a non-zero exit, that was already a stop
condition. If the tracker is missing: **stop and report** — do not proceed to Step 1.

---

## Step 1 — Intake & posture (implemented — AC-F4)

> 📊 **STEP BOUNDARY — Step 1: Intake & posture**
> Write `.claude/active-task.json`: `{"skill":"rewrite","step":"step1","ado":"{ADO}"}`
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

**Context check.** Expected cost for Step 1: ~25–40K tokens (see budget table above). Apply the conservative bias rule — if the previous step consumed significantly more than expected, stop and compact before continuing.

**Friction reduction (once per session).** Before the first Bash call, run the offer per
`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/friction-reduction-spec.md` — check
whether `.claude/settings.local.json` already has the recommended patterns; if not, ask the
developer once. YES → merge patterns + confirm; NO → continue without writing.

1. **Detect** the source stack (do NOT re-implement detection):
   ```bash
   node "$PLUGIN_DIR/scripts/migration-source-detect.cjs" --roots=<source> --json
   ```
2. **Resolve posture** from stack distance — see `references/posture.md`:
   ```bash
   node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" posture \
     --source-lang=<l> --source-fw=<fw> --target-lang=<l> --target-fw=<fw> [--oracle=none] --json
   ```
   | posture | when | consequence |
   |---|---|---|
   | `port` | same language **and** same framework | structure-preserving translation viable |
   | `re-architecture` | any language or framework change | port refused; ask keep-vs-redesign (architecture + platform) |
   | `rewrite-from-spec` | no runnable source oracle | intent comes from the inventory/spec (BAL ceiling applies) |

**Update migration-tracker.md** — mark Phase 1 ✅, update "Next action" to "Run Step 1.5 integration verification", add source-context-manifest.md and integration-inventory.md to the Committed artifacts table (as ⬜ pending).

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=rewrite --ado={ADO_ID} --gate=step_1_intake_complete --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=source_stack --value={SOURCE_STACK}
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=posture --value={POSTURE}
```

---

## Step 1.5 — Integration verification + oracle mode detection (new)

> 📊 **STEP BOUNDARY — Step 1.5: Integration verification + oracle mode detection**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

<!-- Checkpoint already flushed in this step. -->

**Context check.** Expected cost for Step 1.5: ~15–25K tokens (depends on integration count). Stop and surface tracker if < 40K remaining.

Run before options are presented. Produces two outputs that feed the options presentation.

**1. Integration verification** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/integration-verification-spec.md`:
- Tier 1: client-side (config, WSDL, proxy classes, assembly references)
- Tier 2: server-side via `additionalDirectories` if the service source is available
- Produces the **Integration Inventory** — documentation artifact, not subject to the Write Gate. Write immediately to `docs/migrations/{ADO}/integration-inventory.md`.
- Classification per service: data-access-only | business-logic | mixed | unknown
- Options derived per service: inline as project | NuGet package | keep external
- Pre-append guard — run before writing any log entries:
  ```bash
  test -f docs/migrations/{ADO}/migration-log.md && echo "log OK" || echo "log ABSENT — STOP: return to Step 0"
  ```
  If absent: halt Step 1.5, report to the developer. Do not create the file here — recovery belongs in Step 0.
- Write `[INTEGRATION]` migration log entries per `migration-log-spec.md` (log initialized at Step 0)

**PARTIAL rows during options:** advisory — highlighted and flagged in the options table but
not a hard block at `APPROVE OPTIONS`. PARTIAL rows become a **hard block at `APPROVE DESIGN`** —
`target-security-architecture.md` and `target-integration-architecture.md` cannot be accurately
authored with unverified auth schemes. The developer must resolve them before the design gate closes.

**2. Oracle mode selection** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/golden-master-spec.md` § Developer presentation:
- STOP and run the oracle mode developer presentation — present all four modes with their
  assurance-ceiling consequences, ask explicitly whether a dev/test URL is available, and wait
  for the developer's response before recording.
- Record the developer's explicit choice (never the auto-detected recommendation alone) in
  `decision_log.golden_master` and write an `[OPTION]` migration log entry for the mode decision.
- The oracle mode determines the **assurance ceiling** shown per option at Step 2:
  no oracle or deferred → BAL caps at C/D; this is stated up front, not as a surprise at the gate.

**3. Source-context intake gate** — per `$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/source-context-intake-spec.md`.
Before options, read the source's own documented knowledge AND source code, then author the
**Source Context Manifest** (`docs/migrations/{ADO}/source-context-manifest.md`, from
`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/source-context-manifest-template.md`): source context
files (CLAUDE.md, architecture docs, settings), every `migrationRoots` entry, the cross-cutting
concern scan (impl, not declaration), and **full source coverage** — every `graph.json` module marked
`mapped`/`out-of-scope`, behavior-bearing units cited to a **source** `file#line`. Then verify:
```bash
node "$PLUGIN_DIR/scripts/intake-verify.cjs" verify --manifest=docs/migrations/{ADO}/source-context-manifest.md \
  --settings=<source-application-path-provided-by-developer>/.claude/settings.local.json \
  --skill=rewrite --inventory=docs/migrations/{ADO}/integration-inventory.md --json
```
Exit 0 → record the gate in the checkpoint ledger immediately:
```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-gate \
  --skill=rewrite --ado={ADO} --gate=intake_context --verdict=PASS
```
Then record full source_context including summary. Use the `modules_total`, `modules_mapped`,
`modules_out_of_scope` values from the `--json` output above. Set `coverage_verdict` to `"full"`
if `modules_out_of_scope == 0`, otherwise `"partial"`:
```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-payload \
  --skill=rewrite --ado={ADO} \
  --payload-json='{"source_context":{"manifest_path":"docs/migrations/{ADO}/source-context-manifest.md","verified":true,"roots_expected":[{ROOTS_ARRAY}],"modules_total":{N},"modules_mapped":{M},"modules_out_of_scope":{K},"verified_at":"{DATE}","summary":{"coverage_verdict":"{full|partial}","modules_total":{N},"modules_mapped":{M},"modules_out_of_scope":{K},"partial_row_count":0}}}'
```
The `manifest-read-guard.cjs` hook arms after this write — subsequent Read calls to the manifest
are blocked and redirected to `source_context.summary` in the ledger.
Exit 2/3/4/5/6/7/8/9 → **STOP** and resolve (missing/empty manifest · uncovered root · dangling citation ·
PARTIAL with reachable source · unwired dependency · unaccounted module · behavior cited to a doc ·
cross-cutting scan missing/empty/uncited).
Exit 2 check `--json` reason field: `manifest-missing` = file absent, start fresh from the manifest template; `manifest-empty` = file exists but is empty, run `git log -- docs/migrations/{ADO}/source-context-manifest.md` before deciding to re-author from scratch.
A judge pass confirms `unwired_candidates[]` and that the cross-cutting scan found real concerns.

Record all three outputs in the checkpoint before proceeding to Step 2.
**Update migration-tracker.md** — mark Phase 1.5 ✅, add source-context-manifest.md and integration-inventory.md to Committed artifacts, update "Next action" to "Run Step 2 options analysis".

---

## Step 2 — Options (assurance × effort × TCO, including DAG per option) (updated)

> 📊 **STEP BOUNDARY — Step 2: Options**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

**Write the options file to disk before presenting to the developer.** The options file is a required
artifact — write it immediately after completing the options analysis, before showing the options table
in chat. Path: `docs/migrations/{ADO}/{ADO}-options.md`. This is a documentation artifact —
not subject to the Write Gate. Structure:

**Context check.** Expected cost for Step 2 options analysis: ~15–25K tokens. Stop and surface tracker if < 40K remaining before options analysis begins.

```markdown
# Rewrite Options — {AppName} ({ADO})

_Generated: {date} · Skill: rewrite · Status: Awaiting APPROVE OPTIONS_

---

## Source

| Item | Value |
|---|---|
| Stack | {detected stack — framework, versions, DI, ORM} |
| Auth | {auth scheme} |
| Integrations | {WCF count and disposition summary · REST · SQL} |
| Files | {count} |
| Modules | {count} |
| Posture | `{posture}` |
| Oracle mode | `{oracle mode}` — {one-line explanation of why} |
| Assurance ceiling | {BAL level} for all options ({oracle mode basis}) |

---

## Option {A} — {name} *({tagline})*

| Attribute | Value | Basis |
|---|---|---|
| Target stack | {description} | estimate:target-projection |
| Posture | {posture} | computed |
| Clusters | {N} ({cluster names}) | estimate:target-projection |
| Wave schedule | {N} waves — {wave breakdown} | estimate:target-projection |
| Effort | {Low-medium / Medium / High} | estimate:source-analysis |
| Onboarding cost | {description} | estimate:team-profile |
| Recurring run-cost | {description} | estimate:hosting |
| Assurance ceiling | {BAL level} ({oracle mode}) | computed |
| UI migration | {source pattern → target pattern} | estimate:source-analysis |
| WCF handling | {approach} | estimate:source-analysis |

**DAG basis:** INFERRED — {why INFERRED, not computed — target app does not exist yet}

**Summary:** {2–4 sentences covering structural fit, key trade-offs, and one sentence on the highest-risk
element for this option — no generic marketing language}

---

{repeat Option block for each option — minimum 2, maximum 3}

---

## Comparison Summary

| | {Option A name} | {Option B name} | {Option C name if present} |
|---|---|---|---|
| Clusters | {N} | {N} | {N} |
| Waves | {N} | {N} | {N} |
| Effort | {level} | {level} | {level} |
| Assurance ceiling | {BAL} | {BAL} | {BAL} |
| Deployment units | {N} | {N} | {N} |
| {key differentiator row} | {value} | {value} | {value} |
| {key differentiator row} | {value} | {value} | {value} |
| {key differentiator row} | {value} | {value} | {value} |

---

## Judge Analysis

_Judge: [SA] Rafael Mendes — posture, options, architecture._
_Triggered: {automatically on close-call OR on developer "why?" request}_

{Verbatim judge output — every finding, every per-option verdict, every recommendation with
reasoning. Never summarised. Includes: source findings that the options table does not capture,
per-option verdict with RECOMMENDED / Conditional / Not recommended, a recommendation scorecard
table weighted by the application's actual characteristics.}

---

## Pre-design questions (answer with APPROVE OPTIONS)

{Numbered list of architecture and hosting questions that must be answered before design documents
can be authored. Minimum: keep-vs-redesign architecture posture + hosting model. Add any
integration-specific questions surfaced by PARTIAL rows.}

---

## PARTIAL integration rows (advisory now; hard-block at APPROVE DESIGN)

| Service | Status | Required before design gate |
|---|---|---|
| {name} | PARTIAL | {what must be resolved} |

---

{Judge verdict gate — include in the options document based on the verdict the judge returned:}

{If judge_verdict is PASS:}
> ✅ **Judge verdict (options_judge): PASS** — [one-line summary from the `## Judge Analysis` section above]

{If judge_verdict is REVISE:}
> ⛔ **JUDGE VERDICT: REVISE — acknowledgement required before `APPROVE OPTIONS`.**
> The judge identified findings (see `## Judge Analysis` above) that should be addressed before
> committing to a target option. You may override if you have reviewed the findings and accept the risk.
>
> To proceed, type exactly:
> `I ACKNOWLEDGE THE JUDGE VERDICT: options_judge — [one sentence stating what you accept]`
>
> On receipt: record `set-gate --gate=options_judge_acknowledged --verdict=ACKNOWLEDGED`,
> then display the APPROVE OPTIONS or PROCEED prompt.
> Do NOT display `APPROVE OPTIONS` or `PROCEED` without this acknowledgement.

{If judge_verdict is BLOCK:}
> 🚫 **JUDGE VERDICT: BLOCK — `options_judge` is a hard block. Named approver required.**
> See `## Judge Analysis` above for the blocking finding.
>
> To proceed, type exactly:
> `APPROVER: [full name] REASON: [written justification]`
>
> On receipt: record `set-gate --gate=options_judge_block_override --verdict=BLOCK_OVERRIDE`
> with approver and reason in the payload, then display the APPROVE OPTIONS prompt.
> Do NOT display `APPROVE OPTIONS` without this override.

---

{If the PARTIAL integration rows table above is **empty** (zero PARTIAL rows):}
_To proceed: `APPROVE OPTIONS ADO-{ID} [A | B | C]` with answers to the pre-design questions above._

{If the PARTIAL integration rows table above contains **one or more rows**:}
> ⚠ **{N} PARTIAL integration row(s) remain — advisory now, hard block at APPROVE DESIGN.**
> Every PARTIAL row must be resolved to `VERIFIED` before `APPROVE DESIGN` closes.
> `target-integration-architecture.md` and `target-security-architecture.md` cannot be accurately
> authored with unverified contracts. Authoring them against unresolved rows will require a
> full revision cascade when the block fires at Step 2.5.
>
> Unresolved PARTIAL rows:
> {for each PARTIAL row: `- **{service name}**: {what must be resolved}`}
>
> **Reply with one of:**
> - `PROCEED ADO-{ID} [A|B|C]` — acknowledge the PARTIAL rows and commit to resolving them
>   before Step 2.5 design authoring begins. Records a `[DECISION]` migration log entry:
>   `PARTIAL rows acknowledged at Options — {N} rows outstanding: {service names}.`
> - `STOP` — return to Step 1.5 Integration Inventory to resolve PARTIAL rows first.
>
> Do NOT reply `APPROVE OPTIONS` when PARTIAL rows are present — use `PROCEED` or `STOP`.
```

**After APPROVE OPTIONS:** update the status line in `{ADO}-options.md` from
`Status: Awaiting APPROVE OPTIONS` to `Status: Option {X} selected — {date}`.
Then write the `[OPTION]` and `[DECISION]` (APPROVE OPTIONS) migration log entries per
`migration-log-spec.md` — the log entry is a brief pointer to the options file, not a duplicate.
**Update migration-tracker.md** — mark Phase 2 ✅, add {ADO}-options.md to Committed artifacts, record the selected option and oracle mode in the tracker, update "Next action" to "Run Step 2.5 target design documents".

Present 2–3 target options with pros/cons across **assurance ceiling × effort × TCO** (onboarding +
**web-grounded, dated** recurring run-cost) — see `references/options-and-tco.md`. The developer may
instead supply a **BYO design** (image / design doc); it is held to the **same critic scrutiny** as
generated options (`references/byo-design.md`) — never silently accepted.

**Intake gate precondition (fail-closed).** Before decomposing, confirm the intake gate is PASS —
`decompose` must not run on unread source:
```bash
node "$PLUGIN_DIR/scripts/intake-verify.cjs" check-gate --ado={ADO} \
  --settings=<source-application-path-provided-by-developer>/.claude/settings.local.json --json   # non-zero → STOP, finish Step 1.5
```

**Each option carries its OWN target-space DAG** — there is no target application yet, so the source
graph must NOT be decomposed identically for every option. For **each** candidate option, author an
**inferred target-space projection** of the source module graph — reshape it through *that option's*
posture + stack + keep-vs-redesign decisions (a `port` ⇒ ≈ source seams; a `re-architecture` ⇒
merge/split modules, add/remove layers) — then feed the projection to `decompose`. Different option ⇒
different projection ⇒ genuinely different DAG. The projection is **INFERRED** at this phase (no target
app exists); it becomes `computed` post-design (Step 2.5). Show per option:
- Cluster count and wave schedule (parallelizable vs sequential) — **basis: INFERRED (target-space projection)**
- Estimated effort derived from cluster structure
- Integration approach per service (from the Integration Inventory)
- Assurance ceiling (from oracle mode detected in Step 1.5)

**Present per `options-insight-spec.md`** (`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/options-insight-spec.md`):
- Every attribute carries a **basis** from the fixed vocabulary (`computed` | `web-grounded:{date}` |
  `published-spec` | `estimate:{source}` | `requires:{who}`) — never a confidence tier.
- Each decision-critical attribute (cluster count, effort, TCO, assurance ceiling) is paired with a
  **comparative insight** explaining the delta between options.
- Volatile facts (TCO pricing, framework/runtime capabilities) are **web-grounded** through the cache
  (VERIFIED/INFERRED, dated); suggest the web search before running it; offline → `refs/` INFERRED tier.
- **Triggered judge pass** on the option-selection synthesis when options are a close call or the
  developer asks "why?".
- `requires:` on compliance / security / NFR-floor routes to a named human before `APPROVE OPTIONS`.

```bash
# Per option: feed that option's target-space projection (inline nodes/edges, or a small per-option
# graph file). Differentiation lives in the INPUT graph — there is NO --option flag.
node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" decompose \
  --modules=<option's target modules> --edges=<option's target edges> --space=target --json
#   ...or: --graph=<option-{A|B|C}-target-graph.json> --space=target
# A `port` posture is the ONE case where the target ≈ source structure, so reusing the source graph
# (--graph=<source-graph.json>) is legitimate there and only there.
```

After `APPROVE OPTIONS`: the selected option's inferred DAG is the **committed** working baseline. At
Step 2.5, once `target-component-architecture.md` is authored, **re-derive** the committed target-space
DAG from the finalized component inventory (basis promoted from INFERRED → `computed`); that committed
DAG feeds Step 3 (code generation).

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=rewrite --ado={ADO_ID} --gate=options_approved --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=selected_option --value={SELECTED_OPTION}
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=committed_dag_path --value={COMMITTED_DAG_PATH}
```

## Step 2.5 — Target design documents (new)

> 📊 **STEP BOUNDARY — Step 2.5: Target design documents**
> Write `.claude/active-task.json`: `{"skill":"rewrite","step":"step2.5","ado":"{ADO}"}`
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

<!-- Checkpoint already flushed in this step. -->

**Context check.** Main-session orchestration cost for Step 2.5: ~10–20K (see budget table above). Per-document drafting runs in isolated subagents (~8–15K each × 7 docs = ~56–105K in subagents, not counted against the main session). The context guard requires 100K headroom before this step starts — if it blocked your reply, run /compact then `REWRITE RESUME ADO-{ID}`. This step cannot be split mid-document.

Runs after `APPROVE OPTIONS`, before any code generation. The selected option's **inferred** target-space
DAG (from Step 2) is the working baseline the component architecture document is authored against; the
committed DAG is re-derived from that document below (step 5).

**0. Spec preflight — verify all required specs exist before spawning any subagent:**
```bash
REQUIRED_SPECS=(
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/target-design-spec.md"
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/document-orchestrator.md"
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/golden-master-spec.md"
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/feasibility-spec.md"
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/design-revision-spec.md"
  "$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/integration-verification-spec.md"
)
for spec in "${REQUIRED_SPECS[@]}"; do
  [ -f "$spec" ] || { echo "❌ MISSING SPEC: $spec — fix the plugin installation before proceeding."; exit 1; }
done
echo "✅ All required specs present."
```
If any spec is missing: **STOP** — do not spawn subagents. Re-run `/setup-sync` or reinstall the plugin before retrying.

**1. Derive the document-authoring order:**
```bash
node "$PLUGIN_DIR/scripts/graph-derive-documents.cjs" \
  --spec="$PLUGIN_DIR/skills/shared/migration-knowledge/refs/specs/target-design-spec.md" --json
```
This graph orders which of the 7 design documents to author first (a *document* DAG, not the target
component DAG). Exit 1 (cycle) or exit 2 (parse error) → fix the template before proceeding.

**2. Author all 7 design documents** via `document-orchestrator.md` (wave-scheduled, parallel
subagents). Each agent receives only the context it needs — never the full source codebase. The
Integration Inventory is shared state passed to all agents.

All 7 documents are documentation artifacts — **not subject to the Write Gate** — write them to
`docs/migrations/{ADO}/` immediately as they are drafted:

| # | File | Content |
|---|---|---|
| 1 | `target-component-architecture.md` | Component inventory, layer structure, DI wiring, key patterns |
| 2 | `target-data-architecture.md` | Entity model, ORM/Dapper strategy, migrations, schema decisions |
| 3 | `target-security-architecture.md` | Auth scheme, claims, role model, policy definitions |
| 4 | `target-integration-architecture.md` | Per-service client strategy, PARTIAL resolutions |
| 5 | `target-infrastructure-architecture.md` | Hosting, IIS config, networking, identity |
| 6 | `target-deployment-architecture.md` | CI/CD pipeline, deployment units, environment config |
| 7 | `migration-feasibility.md` | Cluster effort table, risk register, BAL ceiling, recommended floor |

After `APPROVE DESIGN`, record the gate in the checkpoint ledger:
```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" set-gate \
  --skill=rewrite --ado={ADO} --gate=design_approved --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=committed_dag_path --value={COMMITTED_DAG_PATH}
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=design_doc_paths --value={DESIGN_DOC_PATHS}
```

**3. Developer reviews and the feedback loop runs** via `design-revision-spec.md`:
- Corrections → `document-feedback.md` (revision cascade)
- Option changes → `option-change-spec.md` (bounded | significant | fundamental)
- New information → routed through the appropriate verification spec first

**Judge verdict gate — run before displaying APPROVE DESIGN:**
```bash
node "$PLUGIN_DIR/scripts/checkpoint-ledger.cjs" check-gate \
  --skill=rewrite --ado={ADO} --gate=design_judge --json
```
- **Exit 0 (PASS):** display inline: `✅ Judge verdict (design_judge): PASS — [one-line summary from the judge's review of the design documents]` then proceed to APPROVE DESIGN.
- **Exit 1 (REVISE):** **DO NOT display APPROVE DESIGN.** Show the full judge output and require:
  `I ACKNOWLEDGE THE JUDGE VERDICT: design_judge — [one sentence stating what you accept]`
  On receipt: record `set-gate --gate=design_judge_acknowledged --verdict=ACKNOWLEDGED`; then display APPROVE DESIGN.
- **Exit 2 (BLOCK):** **DO NOT display APPROVE DESIGN.** Show the full judge output and require:
  `APPROVER: [full name] REASON: [written justification]`
  On receipt: record `set-gate --gate=design_judge_block_override --verdict=BLOCK_OVERRIDE`.
- **Exit 3 (no verdict):** the judge has not assessed the design documents. Show: `⚠ Judge has not run for gate design_judge — complete the judge pass before APPROVE DESIGN.` Do not display APPROVE DESIGN.

**4. APPROVE DESIGN** — all 7 documents must reach `Status: APPROVED` with no PARTIAL/UNVERIFIED
integration rows remaining. Records `payload.rewrite.gate_verdicts.design_approved = true`.

**5. Re-derive the committed target-space DAG.** Now that `target-component-architecture.md` is APPROVED,
project its finalized component inventory + dependencies into a target graph and re-run `decompose` to
produce the **authoritative** DAG that feeds Step 3 — the basis is now `computed` (no longer INFERRED):
```bash
node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" decompose \
  --modules=<target components> --edges=<target deps> --space=target --json
#   ...or --graph=<target-component-graph.json>
```
Record it in `payload.rewrite` as the committed DAG. If it differs materially from the Step-2 inferred
projection, note the delta in the migration log (the design refined the estimate — expected, not an error).

Write `[DECISION]` entries (per document + APPROVE DESIGN) and `[REVISION]` entries (per feedback
loop wave) per `migration-log-spec.md`.
**Update migration-tracker.md** — mark Phase 2.5 ✅, add all 7 design documents to Committed artifacts, update "Next action" to "Run Step 3 generation for cluster 1".

## Step 3 — Resolve execution profile, then generate per cluster + design-quality gate (was Step 4)

> 📊 **STEP BOUNDARY — Step 3: Resolve execution profile + generate per cluster**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

**First, resolve the target execution profile** — the stack-specific commands/paths that keep this
skill's logic stack-agnostic (`$PLUGIN_DIR/skills/shared/migration-knowledge/refs/strategies/README.md`).
Run at the start of the generation phase, once per target track:

```bash
node "$PLUGIN_DIR/scripts/strategy-resolve.cjs" --target=<target-token> --json
# two-track (full-stack): resolve BOTH the backend and the frontend token
```

| Exit | Meaning | Action |
|---|---|---|
| 0 | resolved (`STATUS: implemented`, full token contract present) | proceed; if `unverified:true`, log a `⚠ MATURITY` warning in the migration log — informational, no developer response required |
| 2 | malformed profile: required token missing, token body blank, or body contains an unsubstituted placeholder (`{BUILD}`, `{build}`) | **STOP** — open the profile at `profile_path`; JSON shows `missing_tokens`, `empty_tokens`, or `unfilled_placeholders` |
| 3 | `STATUS` not `implemented` (stub) | **STOP** — target not runnable |
| 4 | no profile file for the target token | **STOP** — never fall back to another stack's toolchain (same honest-refusal rule as an unmapped source) |

Use the resolved profile's tokens for every stack-specific command below — `SKELETON` + `LAYOUT` +
`RULES` + `STANDARDS_EXAMPLE` (scaffold), `BUILD` + `TEST_CLUSTER` + `BUILD_UNIT` + `PKG_ADD`
(per-cluster generation), and `TEST_ALL` + `COVERAGE` + `SERVE` + `E2E` + `CONFIG` + `FITNESS`
(verification, Step 4). Never hard-code `dotnet build` / `npm run build` from memory — read them from the
profile.

Exit 2 also fires for two body-level failures: (a) a token heading exists but its body is blank
(empty section), or (b) the body contains an unsubstituted template placeholder — `{UPPER_CASE}`,
`{lowercase}`, or `{MixedCase}` (any brace-enclosed identifier not preceded by `$`). JSON fields:
`empty_tokens: ["BUILD"]` or `unfilled_placeholders: { "BUILD": ["{BUILD}"] }`. Remediation: open
the profile at `profile_path`, complete or fill in each listed section, then re-run.

**DAG cluster spec generation — run before any worktree is created.**

This is the AUTHORITATIVE cluster schedule. Output is saved to disk; all cluster assignments,
wave ordering, and dependency order in this step come exclusively from this file. The LLM never
re-derives cluster specs from design documents — not on first run, not on resume, not after
session compaction.

```bash
node "$PLUGIN_DIR/scripts/rewrite-decompose.cjs" decompose \
  --graph=<committed_dag_path> --space=target --json \
  > docs/migrations/{ADO}/cluster-spec.json
echo "decompose exit: $?"
```

`<committed_dag_path>` = `payload.rewrite.committed_dag_path` from the checkpoint.
If absent, re-derive from `target-component-architecture.md` using the same inputs as Step 2.5.

| Exit | `acyclic` field | Action |
|---|---|---|
| 0 | `true` | `cluster-spec.json` is valid — use `worktree_plan` for wave schedule, `clusters` for module lists, `order` for build order. Proceed. |
| 11 | `false` | **ABORT** — `cluster-spec.json` is invalid (`acyclic: false`; `cycles` array names offending modules). Do not create any worktree or spawn any subagent. Tell the developer: _"DAG cycle detected among [{cycles}]. Fix the dependency in `target-component-architecture.md`, then re-run Step 2.5 to re-derive the DAG and get `APPROVE DESIGN` again."_ |
| 1 | — | **ABORT** — graph file is malformed or missing. Show stderr; instruct the developer to re-derive at Step 2.5. |

Record the spec path in the checkpoint:
```bash
node scripts/checkpoint-ledger.cjs set-payload \
  --skill=rewrite --ado={ADO_ID} \
  --key=cluster_spec_path \
  --value=docs/migrations/{ADO}/cluster-spec.json
```

**All cluster scheduling below reads ONLY from `cluster-spec.json`:**
- Wave schedule: `worktree_plan` array — wave 1 clusters first, wave 2 next, etc.
- Cluster list: `clusters` array — each cluster's `name` and `modules`
- Build order: `order` array — topological sort result

**Execution model: orchestrator + subagent per cluster.**
The main session is the **orchestrator only** — it does NOT generate code directly. Each cluster
runs in an independent subagent (Agent tool) with its own isolated context window and git worktree.

---

**Orchestrator — main session actions:**

**Orchestrator note:** when constructing the Agent tool prompt for each cluster, copy the 8 numbered steps from the "## Cluster subagent — instructions" section of this SKILL.md into the prompt after the line "Your instructions are the 8 numbered steps...". The subagent reads only its prompt — it does not have access to SKILL.md.
When copying the steps, replace the execution profile token placeholders with their actual resolved values: substitute `{TEST_CLUSTER}`, `{TEST_ALL}`, `{COVERAGE}`, `{SERVE}`, `{E2E}`, `{CONFIG}`, `{SKELETON}`, `{LAYOUT}`, `{RULES}`, `{STANDARDS_EXAMPLE}`, `{BUILD}`, `{PKG_ADD}` with the command strings returned by `strategy-resolve.cjs`. Also substitute `{ADO}`, `{N}`, `{name}`, `{PLUGIN_DIR}`, and `{oracle_mode}` with their actual values for this cluster.

**Step A — Spawn wave (use the Agent tool for each cluster in the wave in parallel).**

For each cluster in the current wave, invoke the Agent tool with this prompt:

```
You are a cluster generation subagent for the rewrite skill.
ADO: {ADO}
Cluster index: {N}
Cluster name: {name}
Worktree path: {repo-root}/.claude/worktrees/{ADO}-cluster-{N}  (already created by the orchestrator)
Plugin dir: {PLUGIN_DIR}  — use this as a literal path for all script invocations below (e.g. node "{PLUGIN_DIR}/scripts/rewrite-bal.cjs"). Do NOT use $PLUGIN_DIR as an env var.
Oracle mode: {oracle_mode}  — one of: self-run | provided-url | deferred-capture | skipped. Use this value directly in rewrite-bal.cjs --oracle flag. Do not re-detect.

Execution profile tokens (from strategy-resolve.cjs output — use these, do not hard-code):
  SKELETON={...} LAYOUT={...} RULES={...} STANDARDS_EXAMPLE={...}
  BUILD={...} TEST_CLUSTER={...} BUILD_UNIT={...} PKG_ADD={...}
  COVERAGE={...} SERVE={...} E2E={...} CONFIG={...}

Cluster spec (modules and edges from the committed target-space DAG):
{paste the cluster node + edge list from rewrite-decompose.cjs output}

Context files (read these at the start — use the paths below, read fresh from disk):
  - Component architecture: docs/migrations/{ADO}/target-component-architecture.md
  - Integration architecture: docs/migrations/{ADO}/target-integration-architecture.md
  - Security architecture: docs/migrations/{ADO}/target-security-architecture.md  (read only if this cluster handles auth)
  - Other design docs: read only if the cluster spec explicitly references them
  - Integration inventory: docs/migrations/{ADO}/integration-inventory.md
  - Design quality rubric: {PLUGIN_DIR}/skills/rewrite/references/design-quality.md
  - Judge spec: {PLUGIN_DIR}/skills/shared/judge.md
  - BAL spec: {PLUGIN_DIR}/skills/rewrite/references/bal.md
  - ERL spec: {PLUGIN_DIR}/skills/rewrite/references/erl.md

Your instructions are the 8 numbered steps listed in the ## Cluster subagent section that the orchestrator has copied below this line. Follow them in order.
Write your checkpoint payload to disk — do NOT return it as JSON text (avoids shell quoting failures and truncation):
```bash
mkdir -p ".claude/migration/{ADO}/clusters/{N}"
cat > ".claude/migration/{ADO}/clusters/{N}/cluster-{N}-payload.json" << 'PAYLOAD'
{ "cluster_{N}_verdict": "<PASS|REVISE|BLOCK>", "cluster_{N}_assurance_path": "<path>", "cluster_{N}_test_plan_path": "<path>", "cluster_{N}_bal_grade": "<A|B|C|D>" }
PAYLOAD
```
Return in your text response: `verdict`, `diff_summary` (one paragraph), `diff_path`, `assurance_path`, `test_plan_path`, `log_fragment_path`, `bal_grade`. These short fields are safe to return as text.
```

Create the worktree before spawning. Use a fixed path pattern so the orchestrator and subagent agree:
```bash
git worktree add {repo-root}/.claude/worktrees/{ADO}-cluster-{N} -b cluster-{ADO}-{N}
```
`{repo-root}` is the repository root (resolve with `git rev-parse --show-toplevel`).

Run all clusters in the same wave simultaneously (parallel Agent tool calls). Wait for all to
return before proceeding to the next wave.

**Step B — Collect verdicts.** Each subagent returns:
- `verdict`: PASS | REVISE | BLOCK
- `diff_summary`: one-paragraph summary of generated code
- `diff_path`: path to the full diff file written by the subagent
- `assurance_path`: `docs/migrations/{ADO}/{ADO}-cluster-{N}-assurance.md`
- `test_plan_path`: `docs/migrations/{ADO}/{ADO}-cluster-{N}-test-plan.md`
- `log_fragment_path`: `docs/migrations/{ADO}/cluster-{N}-log-fragment.md`
- `bal_grade`: the BAL grade (A | B | C | D) computed by rewrite-bal.cjs
- Checkpoint payload written to `.claude/migration/{ADO}/clusters/{N}/cluster-{N}-payload.json` by the subagent

**Step B2 — Update checkpoint sequentially.** After all subagents in the wave return (not during the wave), run the checkpoint update for each cluster in order using the file written by the subagent — never inject JSON through the shell:
```bash
node "{PLUGIN_DIR}/scripts/checkpoint-ledger.cjs" set-payload \
  --skill=rewrite --ado={ADO} \
  --payload-file=".claude/migration/{ADO}/clusters/{N}/cluster-{N}-payload.json"
```
Never run checkpoint updates from inside the cluster subagent — sequential updates in the orchestrator prevent concurrent JSON corruption.

**Step C — Present diffs for Write Gate approval.** For each PASS cluster, show the diff and prompt:
```
📁 WRITE PENDING — Cluster {N}: {name}
   Diff: {diff_path}
   Reply APPROVE ADO-{ADO} to write, or SKIP to discard.
```
The Write Gate lives in the orchestrator (main session), not in the subagent. Only on APPROVE does
the orchestrator commit the worktree files to the target folder.

**Step D — Handle REVISE / BLOCK.**
- REVISE: re-spawn the subagent with the findings appended to the prompt. Cap at 3 iterations. On
  iteration 4, **halt and require developer acknowledgement before any further re-spawn:**
  > ⛔ **Cluster {N} ({name}) — REVISE verdict after 3 iterations. Developer action required.**
  > Findings from latest iteration: [paste the subagent's current finding list verbatim]
  > To re-spawn iteration 4, type: `I ACKNOWLEDGE THE JUDGE VERDICT: cluster-{N} — [one sentence stating what you accept and why re-try is warranted]`
  > To skip this cluster, type: `SKIP CLUSTER {N}`
  > Do not re-spawn without a developer reply.
- BLOCK: **halt the wave immediately and require developer acknowledgement before closing the cluster:**
  > 🚫 **Cluster {N} ({name}) — BLOCK verdict. Wave halted.**
  > Blocking finding: [paste the subagent's blocking finding verbatim]
  > This cluster cannot proceed without an explicit override from a named approver.
  > To acknowledge and skip, type: `APPROVER: [full name] REASON: [written justification]`
  > To retry from scratch, type: `RETRY CLUSTER {N}`
  > Do not close the cluster without a developer reply.

**Step E — Append log fragments.** After all subagents in the wave return, append each cluster's
`cluster-{N}-log-fragment.md` to `migration-log.md` sequentially in cluster order, then delete
the fragment files. Never let subagents write directly to `migration-log.md` — concurrent writes
corrupt the file.

**Step F — Update tracker.** After the wave is complete and diffs are approved, update
`migration-tracker.md`: mark completed clusters ✅, update "Next action" to the next wave or Step 5.

---

**Cluster subagent — instructions (executes inside Agent tool invocation):**

1. **Read context files** listed in the prompt. Read paths only — do not receive file content from
   the orchestrator (too large). Read only the documents the cluster spec references directly.

2. **Design gate:** evaluate the cluster plan against SRMT — read `{PLUGIN_DIR}/skills/rewrite/references/design-quality.md` (path from prompt).
   Judge via `{PLUGIN_DIR}/skills/shared/judge.md` (path from prompt). REVISE → refine + re-judge; never generate
   against a failing design.

3. **Scaffold:** run `SKELETON` + `LAYOUT` + `RULES` + `STANDARDS_EXAMPLE` from the execution
   profile.

4. **Generate:** author all source files. Non-trivial choices carry a `// DECISION:` comment.
   Write files to the worktree path — they are in DRAFT state until the orchestrator receives
   APPROVE ADO-{ADO} from the developer.

5. **Implementation gate:** judge the generated diff against SRMT. REVISE → regenerate flagged units;
   BLOCK → set verdict=BLOCK and return immediately.

6. **BAL + ERL:** Using the execution profile tokens from this prompt:
   a. Run tests: `{TEST_CLUSTER}` (single cluster) or `{TEST_ALL}` (full suite); read coverage via `{COVERAGE}`
   b. If oracle mode is `self-run` or `provided-url`: start the app with `{SERVE}` and run `{E2E}`; stop the server after.
   c. Run: `node "{PLUGIN_DIR}/scripts/rewrite-bal.cjs" bal --cluster={name} --oracle={oracle_mode} --behaviors-total=<N> --behaviors-verified=<M> [--tests-total=<T> --tests-passing=<P>] --json`
   d. Write the assurance record to `docs/migrations/{ADO}/{ADO}-cluster-{N}-assurance.md` — include oracle mode, all BAL inputs, BAL grade, weakest-link dimension, ERL grade per domain.
   e. Invoke the test-plan skill: read `{PLUGIN_DIR}/skills/test-plan/SKILL.md` and execute with `--source rewrite --subagent`, ADO: `{ADO}`, Cluster index: `{N}`. Record the returned path as `test_plan_path`.
   f. Set `bal_grade` = the BAL grade from step c. Set `checkpoint_payload_json` = `{"clusters[{N}].assurancePath":"docs/migrations/{ADO}/{ADO}-cluster-{N}-assurance.md","clusters[{N}].testPlanPath":"{test_plan_path}","clusters[{N}].balGrade":"{bal_grade}"}`

7. **Write log fragment** to `docs/migrations/{ADO}/cluster-{N}-log-fragment.md` — do NOT write
   to `migration-log.md` directly. Include all `[DECISION]` and `[FINDING]` entries for this
   cluster. The orchestrator appends these to the main log after the wave.

8. **Return structured result** to the orchestrator: verdict, diff_path, assurance_path, test_plan_path, log_fragment_path, bal_grade, checkpoint_payload_json.

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=rewrite --ado={ADO_ID} --gate=step_3_wave_N_complete --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=wave_N_cluster_paths --value={WAVE_N_CLUSTER_PATHS}
```

## Step 4 — Per-cluster BAL + ERL — runs inside the cluster subagent

All BAL + ERL instructions are in cluster subagent step 6 (above). Step 4 is a reference anchor only.

**Summary of what the cluster subagent produces and returns:**
- Assurance record: `docs/migrations/{ADO}/{ADO}-cluster-{N}-assurance.md` (written by subagent — documentation artifact, not subject to Write Gate)
- Test plan: `docs/migrations/{ADO}/{ADO}-cluster-{N}-test-plan.md` (written by subagent)
- Log fragment: `docs/migrations/{ADO}/cluster-{N}-log-fragment.md` (appended to migration log by orchestrator in Step E)
- Structured return: verdict · diff_path · assurance_path · test_plan_path · log_fragment_path · bal_grade · checkpoint_payload_json

**Orchestrator responsibility after all waves complete:** write the combined assurance summary:
```
docs/migrations/{ADO}/{ADO}-assurance-summary.md
```
Include: all clusters, their BAL grade (from `bal_grade` in Step B return values), ERL grade per domain, and the final whole-target assurance (weakest-link across all clusters). Write this after Step 5 completion gate passes.

## Step 5 — Two-gate model (was Step 6)

> 📊 **STEP BOUNDARY — Step 5: Two-gate model**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

The `<provisional>` BAL grade comes from each cluster subagent's `bal_grade` return value (collected in Step B). Run the merge gate for each cluster using that value:
```bash
# Merge gate — per cluster; use bal_grade from Step B return value
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" merge-gate --bal=<bal_grade from subagent return> --json
# Completion gate — run once after all clusters pass merge gate
node "$PLUGIN_DIR/scripts/rewrite-bal.cjs" completion-gate --bal=<weakest bal_grade across all clusters> --floor=<A|B|C> --b-series=<true|false> --json
```

- **Merge gate:** a cluster at provisional BAL D cannot merge — raise assurance or re-scope.
- **Completion gate:** a **B-series** cluster below the assurance floor is **hard-blocked** (no silent
  pass; named approver + written reason required). Non-B-series below floor is a warn.

Every gate records an independent **judge** verdict (`$PLUGIN_DIR/skills/shared/judge.md`, risk-scaled)
and is persisted to the shared ledger via `scripts/checkpoint-ledger.cjs` (`set-gate` / `set-payload`).

**Populate Transferable Patterns (completion gate only).** When the completion gate passes,
review every `[LESSON]` entry in `docs/migrations/{ADO}/migration-log.md` and generate a
`TP-{N}` entry for each one in the `## Transferable Patterns` section. Strip all
application-specific detail (app names, internal hostnames, firm-specific package names,
internal paths, team names). State the pattern generically so it is usable by a future team
with no knowledge of this project. Write the TP entries to the migration log immediately —
this is a documentation artifact, not subject to the Write Gate. Then prompt the developer:
"Review the ## Transferable Patterns section — confirm each entry is accurate and portable,
and remove any residual project-specific detail before closing the migration."
**Update migration-tracker.md** — mark Phase 5 ✅, add {ADO}-assurance-summary.md to Committed artifacts, update "Next action" to "Run Step 5a: verify cluster test plan paths and assemble combined test plan".

```bash
# Flush checkpoint before next step
node scripts/checkpoint-ledger.cjs set-gate --skill=rewrite --ado={ADO_ID} --gate=merge_gate --verdict=PASS
node scripts/checkpoint-ledger.cjs set-payload --skill=rewrite --ado={ADO_ID} --key=assurance_summary_path --value={ASSURANCE_SUMMARY_PATH}
```

## Step 5a — Collect test plans and assemble combined document (orchestrator)

> 📊 **STEP BOUNDARY — Step 5a: Collect test plans + assemble combined document**
> The checkpoint is flushed — resuming here is safe.
> **Reply `CONTINUE` to proceed with this step.**
> Reply `COMPACT` if the context window is near capacity:
>   1. Run `/compact`
>   2. Resume with `REWRITE RESUME ADO-{ID}`
>      (The resume restarts at this step — the flush above ensures no rework.)
> _(Do not proceed past this prompt without a reply.)_

<!-- Checkpoint already flushed in this step. -->

Test plans are generated inside each cluster subagent (cluster subagent step 6) and returned as
`test_plan_path` in the subagent's structured result. The orchestrator does NOT re-invoke the
test-plan skill — it collects the paths already returned.

**Orchestrator actions:**
1. After all waves complete, verify each cluster's `test_plan_path` was returned and exists on disk.
   If a cluster subagent failed to produce a test plan, log a warning in `migration-log.md` and
   continue — the completion gate is not blocked by test plan failure.
2. Record each path in the checkpoint ledger (already done in Step B2 via `checkpoint_payload_json`).
3. Once all cluster test plans are present, the test-plan skill assembles the combined document
   automatically. Invoke it once in the main session to trigger assembly:
   ```
   Read {PLUGIN_DIR}/skills/test-plan/SKILL.md and execute with:
     --source rewrite --combine-only
     ADO: {ADO}
   ```
   This produces `docs/migrations/{ADO}/{ADO}-rewrite.test-plan.md`.
4. Record the combined path in the checkpoint:
   ```bash
   node "{PLUGIN_DIR}/scripts/checkpoint-ledger.cjs" set-payload \
     --skill=rewrite --ado={ADO} \
     --payload-json='{"combinedTestPlanPath":"docs/migrations/{ADO}/{ADO}-rewrite.test-plan.md"}'
   ```

**Update migration-tracker.md** — mark Phase 5a ✅, add `{ADO}-rewrite.test-plan.md` to Committed artifacts, update "Next action" to "Migration complete — commit all artifacts and close the ADO work item".

---

## Hard Rules

- NEVER present options before the **source-context intake gate** is PASS (`intake-verify.cjs`) — the
  Source Context Manifest must cover every root + every `graph.json` module (full accounting) with
  resolving citations; `decompose` calls `check-gate` and STOPs if it is not. No design on unread source.
- NEVER accept `PARTIAL`/`unknown` when the resolving source is reachable in a configured root
  (`migrationRoots`) — resolve it at intake (exit 5), never defer it.
- NEVER present options before the Integration Inventory is complete — PARTIAL rows are advisory
  during options but the oracle mode and integration approaches must be known.
- NEVER generate code before `APPROVE DESIGN` closes — all 7 design documents must be approved.
- ALWAYS resolve the target execution profile (`strategy-resolve.cjs`) at the start of generation and
  read every stack-specific command (build/test/serve/scaffold) from it — NEVER hard-code a toolchain
  from memory. STOP on exit 2/3/4 (malformed / stub / missing); WARN when `unverified:true`; NEVER fall
  back to another stack's profile. Two-track migrations resolve BOTH a backend and a frontend profile.
- NEVER re-detect the oracle mode at BAL time — it is determined at Step 1.5 and passed through.
- NEVER offer `port` unless source and target share BOTH language and framework — else re-architecture.
- ALWAYS hold a BYO design to the same critic scrutiny as generated options — never silently accept it.
- ALWAYS show the assurance ceiling (e.g. no-oracle → BAL C/D) BEFORE the developer commits — it
  is derived from the oracle mode detected at Step 1.5 and shown per option at Step 2.
- ALWAYS characterise the DAG (cluster count, wave schedule) per option candidate at Step 2 —
  never present options without their decomposition shape.
- The Step-2 per-option DAG is a **target-space projection** (basis INFERRED — no target app exists
  yet); NEVER decompose the source graph identically for every option. Only a `port` posture may reuse
  the source structure (target ≈ source); `re-architecture`/`rewrite-from-spec` require a reshaped
  projection. Differentiation lives in the **input graph** fed to `decompose` — there is NO `--option`
  flag. Pass `--space=target` so the emitted DAG records its space.
- NEVER schedule worktrees against a cyclic DAG — break the cycle first (decompose exits 11).
- BAL is **weakest-link** on **mechanical denominators** — NEVER average dimensions or grade by judgment.
- NEVER merge a cluster at provisional BAL D; NEVER let a B-series cluster below floor pass the
  completion gate silently — it is a hard block (named approver + written reason).
- SOURCE is read-only; the target is a NEW folder; no generated code to target before `APPROVE DESIGN`.
- ALWAYS record posture, options decision, integration inventory, and the DAG in the shared ledger.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` in the main orchestrator session — never a bare relative path. In cluster subagents, `$PLUGIN_DIR` is not set as an env var; use the literal path value passed in the subagent prompt (e.g. `node "{PLUGIN_DIR}/scripts/rewrite-bal.cjs"`).
- ALWAYS run Step 0 first — migration log + migration tracker + checkpoint ledger init happen before
  any analysis or output. The log must exist before any [INTEGRATION], [FINDING], or [OPTION] entries
  are appended.
- ALWAYS update `migration-tracker.md` at every step and gate transition — for human readability
  and audit trail. A stale tracker is a poor developer experience but does not misguide resume
  (resume is checkpoint-driven via `stage_gates` + `phase_history`).
- The checkpoint JSON (`.claude/migration/{ADO}.checkpoint.json`) is the **primary resume record**
  — machine-written by `checkpoint-ledger.cjs`, validated by `validate`. The tracker enriches the
  human render; it does not override the checkpoint. Never treat a stale tracker as a resume blocker.
- ALWAYS save per-cluster BAL + ERL results to `{ADO}-cluster-{N}-assurance.md` — the
  checkpoint JSON is machine-only and not human-reviewable.
- ALWAYS write the combined assurance summary to `{ADO}-assurance-summary.md` after the
  completion gate passes.
- ALWAYS present oracle mode options with assurance-ceiling consequences and wait for explicit
  developer choice before recording — NEVER auto-select or infer the mode from silence.
- Write migration log entries per `migration-log-spec.md` at each phase — never defer logging.
