---
name: dream-rollback
description: >
  Reverses a specific Dream consolidation run using the audit trail in
  memory/dream-log.md. Use when a dream run promoted incorrect information,
  wrongly deleted an important memory, or made changes that need reversing.
  Triggers on: "rollback dream", "undo dream", "reverse dream run",
  "dream ran incorrectly", "restore memory", "undo last dream",
  or any request to revert Dream consolidation changes.
---

# Dream Rollback Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
Reads `memory/dream-log.md` to identify and reverse a specific dream run.
The rollback itself is logged as a new entry — making it auditable and itself reversible.

---

## Step 1 — Read the dream log

```bash
cat memory/dream-log.md 2>/dev/null || echo "NO_LOG"
```

If `NO_LOG` → output:
```
⚠ No dream-log.md found. Dream rollback requires an existing audit log.
Run /dream first to create one, then use rollback if needed.
```
And stop.

---

## Step 2 — List available runs

Parse `memory/dream-log.md` for run entries. Each run entry has:
- A run ID (date + sequence number, e.g. `DREAM-2026-05-30-1`)
- A date
- A summary of changes (ADD/UPDATE/DELETE counts)
- The specific operations performed

Display the last 10 runs in reverse chronological order:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dream Run History (last 10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [1] DREAM-2026-05-30-2   30 May 2026   3 ADD · 1 UPDATE · 0 DELETE
  [2] DREAM-2026-05-30-1   30 May 2026   0 ADD · 2 UPDATE · 1 DELETE
  [3] DREAM-2026-05-24-1   24 May 2026   5 ADD · 0 UPDATE · 0 DELETE
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Which run to roll back? (Enter number or run ID, or 'cancel')
```

Wait for developer input.

---

## Step 3 — Show changes in the selected run

Once the developer selects a run, display every operation from that run:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DREAM-2026-05-30-2 — Changes to reverse
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ADD  → CLAUDE.md
    Topic: "Always use EF Core for database access"
    Added: lines 47-49 in # Dream → promoted facts

  ADD  → memory/topic-dotnet.md
    Section: "Repository pattern conventions"

  UPDATE → CLAUDE.md
    Topic: "Branch naming convention"
    Before: "feature/ADO-[ID]-description"
    After:  "feat/ADO-[ID]-description"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reverse all 3 operations? (yes / partial / cancel)
  'partial' lets you choose which operations to reverse individually
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for developer input.

---

## Step 4 — Execute rollback

For each operation to reverse (based on developer selection):

**Reversing an ADD:**
- Remove the added content from the target file
- If an entire section was added, remove the section
- If lines were appended, remove those lines
- If a file was created by this run, delete it

**Reversing an UPDATE:**
- Restore the "Before" content in place of the "After" content
- Use the exact before-state recorded in the dream log

**Reversing a DELETE:**
- Restore the deleted content to its original location
- If a file was deleted, recreate it with the original content

After each operation, confirm to the developer:
```
  ✓ Reversed ADD: "Always use EF Core..." removed from CLAUDE.md
  ✓ Reversed UPDATE: Branch naming restored to "feature/ADO-[ID]-description"
  ✓ Reversed ADD: memory/topic-dotnet.md section removed
```

---

## Step 5 — Log the rollback

Append a rollback entry to `memory/dream-log.md`:

```markdown
---

## ROLLBACK — {date}

**Rolled back**: {run ID}
**Reason**: {developer's stated reason if provided, else "not stated"}
**Operations reversed**: {N}

### Operations

- ↩ ADD reversed: "{topic}" removed from {file}
- ↩ UPDATE reversed: "{topic}" in {file} — restored to before-state
- ↩ ADD reversed: {file} section removed

**Note**: This rollback can itself be rolled back by referencing this log entry.
```

---

## Step 6 — Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Rollback complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Run reversed : {run ID}
  Operations   : {N} reversed
  Log entry    : ROLLBACK-{date} appended to memory/dream-log.md

This rollback is itself auditable and reversible.
Run /dream-health to see the updated memory state.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Model routing

This skill is in the **infrastructure tier** — it uses `INFRA_MODEL`
(default: `claude-sonnet-4-6`).

memory revert — reads audit trail and reverses consolidation runs

To override for this project:
```json
{ "env": { "INFRA_MODEL": "claude-opus-4-6" } }
```

See `$PLUGIN_DIR/skills/shared/model-routing-spec.md` for the full routing specification.

## Persona
Acts with a **[DPE] DevOps/Platform Engineer** lens — state integrity, safe reversal, auditability;
always asks "what happens on partial failure, and is this reversible?" Lens only; never assume, never
attribute in output. See `$PLUGIN_DIR/skills/shared/personas-spec.md`.

---

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`$PLUGIN_DIR/skills/shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER rollback without explicit developer confirmation at Step 4
- NEVER delete a topic file if it contains content from multiple dream runs —
  only remove the sections added by the specific run being reversed
- NEVER modify dream-log.md entries — only append the rollback record
- NEVER roll back ledger files (`CodeReviews/`, `security/`, `dynamic-scan/`) — these
  track real defects across runs and are managed by their respective skills and `/fix`.
  Rolling back a ledger would hide known vulnerabilities. Use the skill's own re-scan
  to refresh it, or `/fix` to resolve individual findings
- NEVER roll back `.claude/architecture/` files — use `/update-arch` instead
- If a "Before" state is not recorded in the log for an UPDATE, warn the
  developer and skip that operation rather than guessing
- If the target file has changed since the dream run (different content than
  the "After" state), do not silently proceed. Show a diff between the log's
  "After" state and the current file content so the developer can see exactly
  what would be overwritten, then offer three options:
  ```
  ⚠️  {file} has been modified since this dream run.
  Changes since the run:
  - Line 14: "{after-state-line}" → "{current-line}"
  - Line 22: "{after-state-line}" → "{current-line}"
  Options:
    proceed  — overwrite with Before state (manual edits since the run will be lost)
    skip     — leave this file unchanged, continue with remaining operations
    cancel   — abort the entire rollback
  ```
  Wait for explicit choice before touching the file.
- Partial rollbacks are valid — the developer may choose to reverse only
  specific operations from a run
