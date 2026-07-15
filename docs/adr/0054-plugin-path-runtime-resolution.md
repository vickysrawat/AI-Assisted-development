# 0054 — All plugin file references in SKILL.md and command files must use `$PLUGIN_DIR/skills/...`; relative paths (`../shared/`, bare `references/`) are forbidden
Status: Accepted · Date: 2026-07-15
Governs: all `skills/*/SKILL.md`, `skills/*/references/*.md`, `commands/*.md`,
`skills/shared/plugin-path-resolution.md`, `skills/shared/README.md`, `DEVELOPER-GUIDE.md`
Relates to: [[0046-dream-init-bootstrap-pattern]]

## Problem

Skills and command files contained ~150 path references that resolved incorrectly at runtime.
Three patterns were used:

| Pattern | Example | Runtime result |
|---|---|---|
| `../shared/X` in SKILL.md | `` `../shared/business-context-severity.md` `` | `../` from project root escapes the project tree entirely |
| `../../shared/X` in references/ files | `` `../../shared/fingerprint-spec.md` `` | same — resolves above project root |
| bare `references/X` | `` `references/checkers.md` `` | resolves to `<project_root>/references/` — doesn't exist |

When Claude executes a skill or command, the `Read` tool resolves all paths relative to
**CWD = the target project root**, not relative to the plugin cache directory where the
SKILL.md file lives. Every one of these patterns silently fails: Claude either gets an
empty result or halts with a file-not-found error when it needs the spec to proceed.

The `../shared/` pattern is conceptually correct relative to the skill file's location
(`skills/X/SKILL.md` → `skills/shared/Y.md`), but that conceptual correctness is
irrelevant at runtime. The `Read` tool does not execute from the skill file's directory.

## Decision

**All plugin file references in SKILL.md, references/ subdir files, and command markdown
files MUST use the `$PLUGIN_DIR/skills/...` prefix.**

The canonical forms:

```
# Shared spec
`$PLUGIN_DIR/skills/shared/business-context-severity.md`

# Own skill's references/ subdirectory
`$PLUGIN_DIR/skills/code-review/references/checkers.md`

# Another skill's file
`$PLUGIN_DIR/skills/icea-feature/references/icea-template.md`
```

`PLUGIN_DIR` is resolved once per skill execution by reading `.claude/plugin-path.txt`
(written by `setup-init`/`setup-sync`). If that file is absent, the §1a Node.js resolver
in `$PLUGIN_DIR/skills/shared/plugin-path-resolution.md` is the fallback. Every skill
that reads any plugin resource must resolve `PLUGIN_DIR` before its first such reference:

```
Read `.claude/plugin-path.txt` to get PLUGIN_DIR (if absent, use the Node.js resolver
from `skills/shared/plugin-path-resolution.md §1a`), then:
Read $PLUGIN_DIR/skills/shared/X.md
```

## Rejected alternatives

**A) Keep `../shared/` but change the Read tool's CWD to the skill file's directory.**
Rejected: the Read tool's CWD is the target project root by design. Changing it would
break every other tool call (git, bash, file writes) that legitimately targets project
files.

**B) Deploy a `skills/shared/` directory into target projects.**
Rejected: shared specs are large (~17 files, growing), change frequently, and are
plugin-internal implementation details. Target projects should not receive or manage them.

**C) Embed the content of shared specs inline in each SKILL.md.**
Rejected: duplication — any change to a shared spec would need to be propagated to every
skill that embeds it.

## Consequences

- All skills and commands use `$PLUGIN_DIR/skills/...` paths exclusively.
- New skills MUST add `PLUGIN_DIR` resolution before their first plugin file reference.
- The DEVELOPER-GUIDE.md skill authoring section is updated to show the correct pattern.
- `skills/shared/README.md` documents the correct convention.
- Verified clean by grep: no remaining `../shared/`, `../../shared/`, or bare `references/` patterns in runtime instruction files.
