---
description: Generates a structured QA test plan from any approved plugin artifact — ICEA Tech Spec, upgrade ledger, rewrite cluster ledger, or replatform ledger. Maps acceptance criteria or behavioral contracts to concrete, executable test cases. Triggered by SAVE TEST, EXPAND TEST, and REFRESH TEST keyword commands.
argument-hint: "ADO-{ID} [--source icea|upgrade|rewrite|replatform] [--subagent]"
---

# /test-plan

> **Plugin path:** Read `.claude/plugin-path.txt` to get `PLUGIN_DIR`. If absent, use the Node.js resolver from `skills/shared/plugin-path-resolution.md §1a`.

<skill>test-plan</skill>

## Your task

Generate or refresh a structured QA test plan for the given ADO item.

---

### Step 1 — Parse arguments

Extract from invocation arguments:
- ADO ID — e.g. `ADO-1847`, `ADO #1847`, `1847`
- `--source {type}` — optional override: `icea`, `upgrade`, `rewrite`, `replatform`
- `--subagent` — headless/internal-caller mode (suppresses prompts and budget warnings)

If no ADO ID is provided, ask:
> "Provide the ADO ID for the test plan (e.g. `ADO-1847`)."

---

### Step 2 — Run the test-plan skill

Read `$PLUGIN_DIR/skills/test-plan/SKILL.md` and follow its instructions exactly,
passing through the resolved ADO ID, source flag, and subagent flag.

---

### Step 3 — Confirm

After writing the test plan, output the one-line confirmation from the skill:

```
✅ Test plan written: {path} ({N} TCs across {M} suites)
```
