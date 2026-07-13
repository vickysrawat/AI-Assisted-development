# Interactive Scope Menu Specification
_Spec version: 1.0 · Last changed: 2026-07-06 · Applies to: code-review, security_

Shared by: `code-review`, `security`

When a scan skill is invoked without a scope flag, it MUST present an
interactive menu and wait for the developer to choose before proceeding.
Do not default silently. Do not proceed without a selection.

---

## The menu

Display this when no flag (`--changed`, `--pr`, `--full`, `--ci`, `--area`,
`--continue`) is detected in the invocation:

```
{skill_icon} {Skill Name} — select scan scope:

  1) Smart scan (recommended)
     Skip unchanged files — fastest for iterative work

  2) Changed files only (--changed)
     Staged + unstaged modified files

  3) PR diff (--pr)
     Files changed in this branch vs base

  4) Full scan (--full)
     All files, ignore cache — most thorough

  5) By area (--area)
     > backend | frontend | config | <module name>

  6) Resume (--continue)
     Pick up from last interrupted scan

Enter a number or type a flag (e.g. --full):
```

Where:
- `{skill_icon}` is the skill's icon (code-review uses a clipboard icon, security uses a shield icon)
- `{Skill Name}` is "Code Review" or "Security Review"

---

## Behaviour

1. **Wait for input.** Do not proceed until the developer replies.

2. **Parse the response:**
   - A number (1-6) → map to the corresponding flag
   - A flag string (`--full`, `--changed`, etc.) → use directly
   - `--area backend` / `--area frontend` / `--area config` / `--area <Name>` → use directly
   - Anything else → re-prompt once, then default to option 1 (smart scan) with a notice

3. **Skip the menu** when a flag was already provided in the invocation.
   Example: `/security-review --pr` → skip menu, use `--pr` directly.

4. **Option 6 availability:** Only show "Resume" if a checkpoint file exists.
   Check before displaying:
   ```bash
   test -f .claude/{skill}-checkpoint.json && echo "HAS_CHECKPOINT"
   ```
   If no checkpoint exists, show option 6 as greyed out:
   ```
   6) Resume (--continue)
      No interrupted scan found
   ```

---

## Mapping table

| Input | Resolved flag | Behaviour |
|---|---|---|
| `1` or `smart` | (none — default path) | Cache-aware scan of all changed/uncached files (no cap) |
| `2` or `--changed` | `--changed` | `git diff --name-only` + `git diff --name-only --cached` |
| `3` or `--pr` | `--pr` | Branch diff vs base |
| `4` or `--full` | `--full` | All files, ignore cache |
| `5` or `--area` | `--area` | Prompt for area name, then filter |
| `6` or `--continue` | `--continue` | Resume from checkpoint |

---

## Area sub-prompt

When the developer selects option 5, present a follow-up:

```
Select area:
  a) backend     — server-side source files (*.cs, *.java, *.py, *.go)
  b) frontend    — client-side files (*.ts, *.html, *.jsx, *.tsx)
  c) config      — configuration and IaC (*.json, *.yml, *.env, Dockerfile, *.tf)
  d) <module>    — enter a knowledge-graph module name

Enter a letter, or type a module name:
```

Note: the file extension filters for `backend` and `frontend` are determined by
the detected stack, not hardcoded. The examples shown are illustrative. The
actual filter uses the extensions present in the codebase.

---

## Hard rules

- **NEVER proceed without a selection** when no flag was provided.
- **NEVER default silently.** The developer must explicitly choose.
- **Both skills use the same menu.** Only the icon and skill name differ.
- **The menu is the ONLY place where options are listed.** Do not repeat the
  options list in the scope report that follows.
