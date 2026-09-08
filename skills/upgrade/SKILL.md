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
  → Web-grounded Gap + Risk analysis  (cached, source-verified)                       ⏳ increment 3
  → Decision-grade REPORT             (feasibility spine; value even if it stops here) ⏳ increment 3
  → [if proceed] baseline TAG + branch                                                ⏳ increment 4
  → Run stack tool per hop            (one COMMIT per hop → bisectable)               ⏳ increment 4
  → LLM residual remediation          (each fix behind the Write Gate)               ⏳ increment 4
  → Verify vs baseline oracle                                                         ⏳ increment 4
  → Post-upgrade recommendations      (ladder → Rewrite / Replatform)                ⏳ increment 3
```

Tool-availability preflight (AC-F2) is implemented in Step 2 below.

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

## Hard Rules

- NEVER hand-author the bulk transform of working code — drive the deterministic tool.
- NEVER proceed past a `false-upgrade` classification — route to Rewrite; make no edits.
- NEVER offer a fallback for an `unsupported` stack — STOP and list supported stacks. No fabrication.
- NEVER edit source before a baseline tag exists (the oracle anchor) — increment 4 enforces this.
- ALWAYS one commit per version hop (bisectable); NEVER blend hops into one diff.
- ALWAYS gate every residual fix behind the Write Gate; NEVER merge until verification passes.
- ALWAYS invoke plugin scripts via the resolved `$PLUGIN_DIR` — never a bare relative path.
- ALWAYS state, in the report, which side of the tool-coverage line the project sits on (AC-F3).
