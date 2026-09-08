---
description: Out-of-place generative migration — translate a source app into a NEW target-folder application in a different stack (e.g. Java→.NET, Express→Angular). Resolves posture from stack distance (port only for same-language+same-framework), presents target options across assurance × effort × TCO (or accepts a BYO design under the same scrutiny), decomposes in target space along a dependency DAG, and generates one cluster per git worktree with a design-quality gate, a per-cluster Behavioral Assurance Level (BAL), an Enterprise-Readiness Level (ERL), and a merge + completion two-gate model.
argument-hint: ADO-<id>  e.g.  ADO-1847   (run from INSIDE the new, empty TARGET folder)
---

## Model routing

This command uses the **generation tier** — `ICEA_MODEL` (default: `claude-opus-4-8`) for options,
design, and code generation; the **judge** on every gate uses the shared three-tier ladder
(`CRITIC_MODEL` → `CRITIC_MODEL_MAX` @ max effort → different-family panel).

To override: `{{ "env": {{ "ICEA_MODEL": "claude-opus-4-8" }} }}` in `.claude/settings.json`.
See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full specification.

---

# /rewrite — out-of-place generative migration

Translates a source application into a **new target-folder** application in a different stack. **Run
from inside the new, empty TARGET folder** — the source path is collected at intake and read-only.

```
mkdir my-new-app && cd my-new-app && /rewrite ADO-1847
```

---

## Step 1 — Run the rewrite skill

```
Read $PLUGIN_DIR/skills/rewrite/SKILL.md and execute it.
```

The skill runs: detect source → resolve **posture** (stack distance) → present **options**
(assurance × effort × TCO) or accept a **BYO design** (same scrutiny) → **target-space decompose** →
dependency DAG → generate **one cluster per worktree** with a **design-quality gate** → per-cluster
**BAL** + **ERL** → **merge gate** (provisional BAL ≠ D) → **completion gate** (final BAL; B-series
hard-block below floor). Every gate emits an independent judge verdict; state is written to the shared
migration ledger.

---

## Keyword handlers (any session)

`REWRITE ADO-{ID}` — run/resume the rewrite for that ADO ID ·
`REWRITE RESUME ADO-{ID}` — resume from the shared ledger checkpoint.

---

## Hard Rules

- NEVER offer `port` unless source and target share BOTH language and framework — else re-architecture.
- ALWAYS hold a BYO design to the same critic scrutiny as generated options.
- ALWAYS show the assurance ceiling (e.g. no runnable oracle → BAL C/D) BEFORE the developer commits.
- SOURCE is read-only; the target is a NEW folder; no generated code before `APPROVE ADO-{ID}`.
- NEVER merge a cluster at provisional BAL D; a B-series cluster below floor is a hard block at completion.
