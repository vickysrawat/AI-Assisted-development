# Checkpoint File Schema
_Spec version: 1.0 · Last changed: 2026-07-06 · Applies to: code-review, security_

Shared by: `code-review`, `security`

Defines the checkpoint file that enables scan skills to resume after a
connection drop or context exhaustion. Each skill writes its own checkpoint
file; the schema is shared.

---

## File location

```
.claude/{skill-name}-checkpoint.json
```

Examples:
- `.claude/code-review-checkpoint.json`
- `.claude/security-checkpoint.json`

These files must be added to `.gitignore` — they are runtime state, not source.

---

## Schema (version 1.0)

```json
{
  "_schema": "1.0",
  "started": "YYYY-MM-DDTHH:MM:SSZ",
  "skill": "code-review | security",
  "scope": "--changed | --pr | --full | --ci | --area <name> | default",
  "files": [
    { "path": "src/Controllers/UserController.cs", "status": "pending" },
    { "path": "src/Services/AuthService.cs",       "status": "done" }
  ],
  "findings": [
    {
      "fingerprint": "FP-a1b2c3d4",
      "pass": 1,
      "file": "src/Services/AuthService.cs",
      "checker": "TAINTED_SQL",
      "severity": "High",
      "summary": "SQL injection via user input"
    }
  ],
  "passState": {
    "pass1": "done | in-progress | pending",
    "pass2": "done | in-progress | pending",
    "pass3": "done | in-progress | pending"
  }
}
```

---

## Field definitions

| Field | Type | Description |
|---|---|---|
| `_schema` | string | Schema version — always `"1.0"` |
| `started` | ISO datetime | When the scan started |
| `skill` | string | Which skill owns this checkpoint |
| `scope` | string | The scope flag that was resolved |
| `files` | array | Ordered list of files with scan status |
| `files[].path` | string | Relative path from project root |
| `files[].status` | string | `"pending"` or `"done"` |
| `findings` | array | Findings accumulated so far (all passes) |
| `findings[].pass` | number | Which pass produced this finding (1, 2, or 3) |
| `passState` | object | Progress of the three-pass architecture |

---

## Lifecycle

### On start

Before scanning any files, write the checkpoint with:
- All files listed with `status: "pending"`
- Empty `findings` array
- All passes set to `"pending"`

```bash
mkdir -p .claude
```

### During scan

After each file is scanned in Pass 1:
1. Update that file's status to `"done"`
2. Append any findings to the `findings` array
3. Write the checkpoint to disk

After Pass 1 completes, update `passState.pass1` to `"done"`.
After Pass 2 completes, update `passState.pass2` to `"done"`.

### On next run — detect and offer resume

```bash
cat .claude/{skill}-checkpoint.json 2>/dev/null || echo "NO_CHECKPOINT"
```

If checkpoint exists with pending files or incomplete passes:

```
Found an incomplete {skill name} from {started}.
  Files scanned : {done_count} / {total_count}
  Pass progress : Pass 1 {state} | Pass 2 {state} | Pass 3 {state}
  Findings so far: {finding_count}

Resume from where it stopped? (yes / no — 'no' starts a fresh scan)
```

- `yes`: skip done files, continue from first pending, merge findings
- `no`: delete checkpoint, start fresh

### On completion

Delete the checkpoint file. A missing checkpoint = clean state.

---

## Hard rules

- **Write after every file** — not just at the end. The whole point is surviving
  a mid-scan interruption.
- **Never commit checkpoint files** — they are ephemeral runtime state.
- **Each skill owns its own checkpoint** — do not share checkpoint files between
  skills. A code-review checkpoint and a security checkpoint can coexist.
- **Resume respects the three-pass architecture** — if Pass 1 was complete but
  Pass 2 was interrupted, resume from Pass 2 with all Pass 1 findings loaded.
