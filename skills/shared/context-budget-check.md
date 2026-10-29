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

---

## Entry-point check (session-budget mode)

Use at the **start** of a skill — before reading any documents — to warn when
the session context is already too loaded for the skill to complete safely.
Unlike the full invocation above, there is no document to measure; the signal
is the actual remaining context window percentage written by the `statusLine`
script to `{os.tmpdir()}/ctx-{session_id}.json`.

### Invocation

```
Read $PLUGIN_DIR/skills/shared/context-budget-check.md and run the entry-point check with:
  skill_name    = "{name of the skill being entered}"
  skip_keywords = [{keyword prefixes that imply a fresh/compact context}]
```

### Step 0 — Skip check?

If the triggering command starts with any string in `skip_keywords` → `BUDGET_SKIPPED`. Return immediately.

### Step 1 — Read remaining context percentage

```bash
CTX_REMAINING=$(node -e "
const fs = require('fs'), os = require('os'), path = require('path');
try {
  const tmp = os.tmpdir();
  const files = fs.readdirSync(tmp)
    .filter(f => f.startsWith('ctx-') && f.endsWith('.json'))
    .map(f => ({ f, m: fs.statSync(path.join(tmp,f)).mtimeMs }))
    .sort((a,b) => b.m - a.m);
  if (!files.length) { process.stdout.write('100'); return; }
  const d = JSON.parse(fs.readFileSync(path.join(tmp, files[0].f), 'utf8'));
  process.stdout.write(d.remaining_percentage != null ? String(Math.round(d.remaining_percentage)) : '100');
} catch(_) { process.stdout.write('100'); }
")
echo "CTX_REMAINING=${CTX_REMAINING}%"
```

If `CTX_REMAINING=100` (file missing, null, or post-`/compact`) → `BUDGET_OK`. Proceed silently — fresh context or already compacted.

### Step 2 — Classify and emit

| remaining % | Verdict | Action |
|---|---|---|
| ≥ 40 | `BUDGET_OK` | Proceed silently |
| 15–39 | `BUDGET_WARN` | Show warning, wait for reply |
| < 15 | `BUDGET_STOP` | Hard stop, wait for reply |

**On `BUDGET_OK`:** proceed immediately, no message.

**On `BUDGET_WARN`:**
```
⚠ CONTEXT BUDGET — {skill_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your context window is ~{100-CTX_REMAINING}% full from earlier in this session.
{skill_name} reads multiple documents and generates substantial output —
a loaded context risks truncated or incomplete results.

Options — reply with one:
  /compact  then re-enter the command
  CONTINUE  to proceed anyway (quality checks will flag any gaps)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
⛔ STOP — wait for developer reply.

**On `BUDGET_STOP`:**
```
⛔ CONTEXT BUDGET — {skill_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your context window is ~{100-CTX_REMAINING}% full.
Continuing will likely produce truncated or structurally incorrect output.

  Option A — /compact  (recommended)
  Then re-enter the command.

  Option B — New session
  Open a fresh Claude Code session and re-enter the command.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
⛔ STOP — no CONTINUE option at skill entry under BUDGET_STOP.

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
