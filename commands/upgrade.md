---
description: In-place, same-stack version upgrade (e.g. .NET 6→8, Angular 15→17, Java 8→21) where the LLM ORCHESTRATES a deterministic stack tool — it never hand-authors the bulk change to working code. Rejects false-upgrades (routes them to Rewrite), produces a decision-grade Gap + Risk report, and (if you proceed) drives the tool on an isolated branch off a baseline tag with one commit per hop, verified against the baseline.
argument-hint: ADO-<id>  e.g.  ADO-1847   (run from INSIDE the repo you want to upgrade)
---

## Model routing

This command uses the **generation tier** — `ICEA_MODEL` (default: `claude-opus-4-8`) for
classification, gap/risk analysis, and residual remediation; the **judge** on each gate uses
`CRITIC_MODEL` (default: `claude-sonnet-4-6`), escalating to `CRITIC_MODEL_MAX` (max effort) for
high-risk findings.

To override: `{{ "env": {{ "ICEA_MODEL": "claude-opus-4-8" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /upgrade — in-place version upgrade orchestrator

Upgrades an application **in place** to a higher version of the **same** stack. Run it from inside
the repository you want to upgrade — the source **is** the target; the oracle is the pre-upgrade
baseline commit.

```
cd my-app && /upgrade ADO-1847
```

The **headline deliverable is a decision-grade Gap + Risk report** — you get value even if you never
proceed to the code change.

---

## Step 1 — Run the upgrade skill

```
Read $PLUGIN_DIR/skills/upgrade/SKILL.md and execute it.
```

The skill runs: detect + classify (reject false-upgrades → route to Rewrite) → tool-availability
preflight → web-grounded, source-verified Gap + Risk report → **[if you proceed]** baseline tag +
branch → run the stack tool one commit per hop → gated residual remediation → verify vs the baseline
oracle → post-upgrade ladder (→ Rewrite / Replatform).

---

## Keyword handlers (any session)

`UPGRADE ADO-{ID}` — run/resume the upgrade for that ADO ID ·
`UPGRADE RESUME ADO-{ID}` — resume from the on-disk checkpoint.

---

## Hard Rules

- NEVER hand-author the bulk transform of working code — drive the deterministic tool.
- NEVER proceed past a `false-upgrade` classification — route to Rewrite; make no edits.
- NEVER edit source before the baseline tag exists (the oracle anchor); ALWAYS one commit per hop.
- ALWAYS gate every residual fix behind the Write Gate; NEVER merge until verification passes.
- ALWAYS ground breaking-change facts in an authoritative source, tagged VERIFIED/INFERRED — never model memory.
