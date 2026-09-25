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

## Step 2 — Tool-availability preflight (implemented — AC-F2)

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

## Step 3 — Web-grounded gap/risk analysis (implemented — AC-F3)

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

**Initialize the migration log.** Before writing any `[INTEGRATION]` entries, create the log file
with its required header (per `migration-log-spec.md` § Initialization):

```
docs/migrations/{ADO}/migration-log.md
```

Create `docs/migrations/{ADO}/` if absent. This is a documentation artifact — not subject to
the Write Gate.

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

## Step 4 — Decision-grade Gap + Risk report (implemented — AC-F3)

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
Record the path: `upgrade-checkpoint.cjs set-payload --report-path=<path>`

**APPROVE REPORT gate.** Present this prompt and stop:

```
📊 GAP + RISK REPORT SAVED → docs/migrations/{ADO}/ADO-{ADO_ID}-gap-risk-report.md

The report is your value from this run — saved whether or not you proceed to execution.

  APPROVE REPORT ADO-{ID}  — continue to delta design documents (Step 4.5)
  NO                       — stop here; the report remains on disk for your review
```

Only `APPROVE REPORT ADO-{ID}` continues. Record the choice:
  `upgrade-checkpoint.cjs set-payload --proceed-after-report=<true|false>`
Write a `[DECISION]` migration log entry for this gate.

The report is the point where value is delivered. Everything below runs **only if the developer
chooses to proceed** (replies `APPROVE REPORT ADO-{ID}`) — and every step that touches the working
repo is authored here but executed by the developer (LLM authors + rehearses, human executes).

## Step 4.5 — Delta design documents + APPROVE DESIGN (new)

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

## Step 5 — Baseline tag + working branch (implemented — AC-F3 execution)

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

## Step 6 — Run the stack tool per hop (implemented — AC-F3 execution)

Walk the runbook one hop at a time. For each hop: run the deterministic tool for that hop, then make
**exactly one commit** (`commit_plan[i].commit_msg`). One commit per hop keeps history bisectable so
a later verify failure pins the exact hop. Never blend hops into one diff; never hand-author the bulk
transform.

## Step 7 — Residual remediation + verify vs baseline oracle (implemented — AC-F3 execution)

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

## Step 8 — Checkpoint + judge at every gate (implemented — AC-F9/F10, inline)

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
