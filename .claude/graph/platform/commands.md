---
paths: commands
---
_Fingerprint: 39180cd5c74633db51884e3ffd24f55a4e90bff9 | Updated: 2026-07-13_

## Bounded context
37 command stub `.md` files. These are the source files deployed to `.claude/commands/` in target projects, making plugin commands visible in Claude Code (VS Code sidebar). Each stub references the corresponding skill.

## Key files
- `setup-init.md`, `setup-sync.md`, `setup-status.md` — setup commands
- `icea-feature.md`, `icea-implement.md` — ICEA workflow commands
- `code-review.md`, `security-review.md` — quality commands
- (37 total)

## Patterns
- Stub format: minimal YAML frontmatter + one-line description pointing to the skill
- Deployed by bootstrap `deployStubs()` step (skip-if-exists)
- Legacy stubs (dream-*.md) removed on setup-sync via LEGACY_STUB_FILES array

**Depended on by:** skills/shared (stubs reference skill instructions).
