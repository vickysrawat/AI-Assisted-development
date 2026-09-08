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
  → Classify                          (reject false-upgrades → route to Rewrite)     ← implemented
  → Plan version path                 (multi-hop; LTS ladder / one major at a time)  ← implemented
  → Tool-availability preflight       (probe tool; missing → print install steps, pause) ← implemented
  → Web-grounded Gap + Risk analysis  (cached, source-verified)                       ← implemented
  → Decision-grade REPORT             (feasibility spine; value even if it stops here) ← implemented
  → [if proceed] baseline TAG + branch                                                ← implemented
  → Run stack tool per hop            (one COMMIT per hop → bisectable)               ← implemented
  → LLM residual remediation          (each fix behind the Write Gate)               ← implemented
  → Verify vs baseline oracle                                                         ← implemented
  → Post-upgrade recommendations      (ladder → Rewrite / Replatform)                ← implemented
```

Tool-availability preflight (AC-F2) is implemented in Step 2; grounded gap/risk analysis + the
decision-grade report (AC-F3) in Steps 3–4; gated execution (baseline tag + branch, commit-per-hop,
residual remediation, verify) + the inline judge/checkpoint substrate (AC-F9/F10) in Steps 5–8.

## Step 1 — Intake & classification (implemented — the highest-risk component)

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
| 2 | `outdated` | present but too old — show the printed upgrade steps, **pause**, re-run preflight |
| 3 | `needs-install` | not found — show the printed install + verify steps, **pause**, re-run after install |
| 4 | `unknown-stack` | no tool for this stack — **STOP** (Upgrade cannot serve it) |

The skill only **prints** install/verify steps for the developer to run; it never installs anything
and never bundles a tool. Tool absence is a graceful pause, not a failure.

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

The report is the point where value is delivered. Everything below runs **only if the developer
chooses to proceed** — and every step that touches the working repo is authored here but executed by
the developer (LLM authors + rehearses, human executes).

## Step 5 — Baseline tag + working branch (implemented — AC-F3 execution)

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

The ledger is a single-writer, **merge-write** contract (never clobbers fields it does not own), so
the run is resumable and safe to hand off. As of Story 2 the judge and checkpoint are the **shared
substrate** (`skills/shared/judge.md`, `skills/shared/migration-ledger-schema.md`);
`upgrade-checkpoint.cjs` is a thin adapter over `scripts/checkpoint-ledger.cjs` that owns the
`payload.upgrade` namespace. (The local `references/judge-inline.md` / `checkpoint-inline.md` are now
redirects to the shared docs.)

## Hard Rules

- NEVER hand-author the bulk transform of working code — drive the deterministic tool.
- NEVER proceed past a `false-upgrade` classification — route to Rewrite; make no edits.
- NEVER offer a fallback for an `unsupported` stack — STOP and list supported stacks. No fabrication.
- NEVER edit source before a baseline tag exists (the oracle anchor) — increment 4 enforces this.
- ALWAYS one commit per version hop (bisectable); NEVER blend hops into one diff.
- ALWAYS gate every residual fix behind the Write Gate; NEVER merge until verification passes.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` — never a bare relative path.
- ALWAYS ground breaking-change facts in an authoritative source; NEVER source them from model memory.
- ALWAYS tag each report claim VERIFIED (dated authoritative source) or INFERRED; NEVER fabricate a
  source to reach VERIFIED, and NEVER present an INFERRED claim as settled fact.
- ALWAYS state, in the report, which side of the tool-coverage line the project sits on (AC-F3).
