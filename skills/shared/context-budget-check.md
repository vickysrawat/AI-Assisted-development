# Shared Skill: context-budget-check

_Skill version: 1.0 · Last changed: 2026-07-23 · Consent: C_

## Purpose

Proactively warn developers when a large operation is about to run in a
context-heavy session. Prevents stub or structurally incorrect outputs by
surfacing the risk *before* the operation begins — while there is still time
to /compact or start fresh.

A non-bypassable PreToolUse Write hook (`context-budget-tech-write.cjs`) runs
alongside this skill check. Even if this skill guidance is skipped under
context pressure, the hook blocks the Write call at the OS level.

## When to use

Invoke at the start of any step that:
- Reads one or more large files (templates, architecture docs, large ICEAs)
- Generates a large structured output (Tech Spec, implementation, full report)
- Cannot easily recover from a partial or incorrect result without re-running

## Invocation

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and execute it with:
  operation_name    = "{name — shown in warning headers}"
  size_signal       = {integer — measurable proxy for session depth}
  size_label        = "{human-readable — e.g. 'ICEA: 423 lines'}"
  threshold_medium  = {integer — at or above this: warn and wait}
  threshold_high    = {integer — above this: hard stop and wait}
  recovery_command  = "{command to run after /compact or in new session}"
  skip_keywords     = [{list of keyword prefixes that imply a fresh session}]
  operation_needs   = [{list — what the operation will consume context for}]
  risks_if_continue = [{list — what may go wrong if context is exhausted}]
  saved_context     = "{what is safely on disk — shown in 'nothing is lost' message}"
```

All parameters are required. The calling skill must measure `size_signal`
before invoking — this skill does not perform measurements itself.

---

## Verdicts

This skill emits one verdict as its final output line:

| Verdict | Meaning | Calling skill action |
|---|---|---|
| `BUDGET_OK` | Low risk — proceed | Continue immediately |
| `BUDGET_SKIPPED` | Fresh path — check not needed | Continue immediately |
| `BUDGET_WARN` | Medium risk — warning shown | ⛔ Stop; wait for developer reply |
| `BUDGET_STOP` | High risk — hard stop | ⛔ Stop; wait for developer reply |

On `BUDGET_WARN` / `BUDGET_STOP`, the calling skill resumes when the developer
replies with one of the options shown in the message.

---

## Execution

### Step 0 — Fresh path check

If the triggering keyword (the command the developer typed to enter this step)
starts with any string in `skip_keywords`:
```
✅ CONTEXT CHECK SKIPPED — invoked via fresh-session path.
```
Verdict: `BUDGET_SKIPPED`. Return immediately — do not run Steps 1–2.

---

### Step 1 — Classify risk

| size_signal | Risk level | Verdict |
|---|---|---|
| < threshold_medium | 🟢 Low | `BUDGET_OK` |
| ≥ threshold_medium and ≤ threshold_high | 🟡 Medium | `BUDGET_WARN` |
| > threshold_high | 🔴 High | `BUDGET_STOP` |

---

### Step 2 — Emit message

**On `BUDGET_OK`:**
```
✅ CONTEXT BUDGET OK — {operation_name} ({size_label}) — proceeding.
```

**On `BUDGET_WARN`:**
```
⚠ CONTEXT BUDGET — {operation_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{size_label}. This session has accumulated context through earlier steps.

This operation still needs to:
  • {operation_needs[0]}
  • {operation_needs[1]}
  ...

If you continue now, the output may:
  • {risks_if_continue[0]}
  • {risks_if_continue[1]}
  ...

Your work is safe — {saved_context}

Options — reply with one:

  /compact  →  {recovery_command}
  Compresses earlier turns and regenerates here. Stays in this session.

  {recovery_command} CONTINUE
  Proceed anyway. Quality checks and the Write gate will flag any gaps.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
⛔ STOP — do not proceed until the developer replies.

**On `BUDGET_STOP`:**
```
⛔ CONTEXT BUDGET WARNING — {operation_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{size_label}. This session has consumed significant context through earlier steps.

This operation still needs to:
  • {operation_needs[0]}
  • {operation_needs[1]}
  ...

If you continue without compacting, the output is likely to:
  • {risks_if_continue[0]}
  • {risks_if_continue[1]}
  ...

Your work is safe — {saved_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Option A — /compact  (recommended — stay in this session)
  ──────────────────────────────────────────────────────────
  1. Run /compact in Claude Code
  2. Reply: {recovery_command}
  Compresses earlier turns. Operation reads everything it needs from disk.

  Option B — New session  (best output quality)
  ──────────────────────────────────────────────────────────
  {saved_context}
  Open a new Claude Code session and run: {recovery_command}
  Full context budget available — cleanest result.

  Option C — Continue anyway  (not recommended)
  ──────────────────────────────────────────────────────────
  Reply: {recovery_command} FORCE
  Writes a force flag to bypass the Write gate once.
  Expect a partial or structurally incorrect output.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
⛔ STOP — do not proceed until the developer replies with Option A, B, or C.

---

## Caller examples

**icea-feature Step 8 (Tech Spec generation):**
```
size_signal       = ICEA line count
threshold_medium  = 150
threshold_high    = 350
recovery_command  = "TECH ADO-{ADO_ID}"
skip_keywords     = ["TECH ADO-"]
```

**icea-implement (story implementation):**
```
size_signal       = ICEA AC count (from Tech Spec tracker)
threshold_medium  = 15
threshold_high    = 30
recovery_command  = "IMPLEMENT ADO-{ADO_ID} Story-{N}"
skip_keywords     = []
```

**code-review:**
```
size_signal       = changed file count (git diff --name-only | wc -l)
threshold_medium  = 20
threshold_high    = 50
recovery_command  = "/code-review"
skip_keywords     = ["--changed", "--pr"]
```
