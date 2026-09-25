# Spec: Migration Friction Reduction

_Shared by all migration-family skills (Upgrade · Rewrite · Replatform). Run at the start of
Step 1 / Step R1 — before any Bash commands are issued._

---

## Purpose

The migration workflow issues many node script calls, git reads, and verification commands on
the developer's behalf. By default, Claude Code prompts before each one. This step offers the
developer a one-time opt-in to reduce or eliminate those prompts by writing to
`.claude/settings.local.json` (gitignored — personal, never shared with the team).

Two modes are offered: **safe patterns** (recommended — common migration commands only,
destructive commands still prompt) or **auto mode** (all Bash commands — zero prompts but
destructive commands also run without asking).

---

## When to run

At the very start of Step 1 (before the first `Bash` tool call). Skip silently if:

- `.claude/settings.local.json` already contains `"Bash(*)"` in `allowedTools` (auto mode already
  active), OR
- `.claude/settings.local.json` already contains **all** the safe-patterns list in `allowedTools`, OR
- The developer already declined in this session (session flag — never re-prompt).

If the file exists but is missing some patterns, offer to add the missing ones.

---

## Developer prompt

```
🔧 REDUCE MIGRATION FRICTION (optional)

The migration workflow runs node scripts, git commands, and verification tools on your behalf.
By default Claude Code prompts before each one.

Choose a friction level for this project (written to .claude/settings.local.json — gitignored,
personal only, not shared with the team):

  1  SAFE PATTERNS (recommended)
     Auto-approve only the commands the migration workflow uses:
       node *, cd * && node *, git rev-parse*, git log*, git status*,
       git tag*, git checkout*, git branch*
     Destructive commands (rm, git reset --hard, git push --force) still prompt.

  2  AUTO MODE
     Add Bash(*) — all Bash commands run without prompting, including destructive ones.
     Use this if you want zero interruption during the migration.
     ⚠ Destructive commands (rm, git reset, git push --force) will NOT prompt — Claude
       Code's safe-action defaults still apply, but the permission layer is bypassed.

  NO  Skip — prompts remain; you can add patterns manually later.
```

---

## On choice 1 — Safe patterns

1. Read `.claude/settings.local.json` — treat as `{}` if the file does not exist.
2. Merge the safe-patterns list into `allowedTools`, preserving all existing entries. No duplicates.
3. Write the file. The developer's explicit choice is approval — no additional Write Gate prompt
   (personal tooling config, not feature source code).
4. Confirm and continue:
   ```
   ✅ Safe patterns added to .claude/settings.local.json — migration script runs will no
   longer prompt. Destructive commands still require approval. Continuing to Step 1…
   ```

## On choice 2 — Auto mode

1. Read `.claude/settings.local.json` — treat as `{}` if the file does not exist.
2. Add `"Bash(*)"` to `allowedTools` (if not already present). Remove any narrower `Bash(…)`
   patterns — `Bash(*)` subsumes them.
3. Write the file. The developer's explicit choice is approval.
4. Confirm and continue:
   ```
   ✅ Auto mode enabled in .claude/settings.local.json — all Bash commands will run without
   prompting for this project. To revert: remove "Bash(*)" from .claude/settings.local.json.
   Continuing to Step 1…
   ```

## On NO

Continue without writing. Set a session flag so this is not offered again this session.

---

## Safe patterns list

```json
[
  "Bash(node *)",
  "Bash(cd * && node *)",
  "Bash(git rev-parse*)",
  "Bash(git log*)",
  "Bash(git status*)",
  "Bash(git tag*)",
  "Bash(git checkout*)",
  "Bash(git branch*)"
]
```

---

## Resulting settings.local.json shapes

**Safe patterns:**
```json
{
  "allowedTools": [
    "Bash(node *)",
    "Bash(cd * && node *)",
    "Bash(git rev-parse*)",
    "Bash(git log*)",
    "Bash(git status*)",
    "Bash(git tag*)",
    "Bash(git checkout*)",
    "Bash(git branch*)"
  ]
}
```

**Auto mode:**
```json
{
  "allowedTools": [
    "Bash(*)"
  ]
}
```

Existing `allowedTools` entries are preserved (merge, never overwrite). For auto mode, narrower
`Bash(…)` patterns already in the file are removed — `Bash(*)` subsumes them.

---

## Hard rules

- NEVER write to `settings.json` (committed/shared) — only `settings.local.json` (gitignored).
- ALWAYS read the existing file before writing — merge, never overwrite.
- OFFER once per session — if the developer chose NO, do not re-prompt this session.
- For auto mode: ALWAYS show the ⚠ warning about destructive commands before writing.
- If either choice is made, confirm success before continuing to Step 1 content.
