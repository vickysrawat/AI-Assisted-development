# ICEA Feature Workflow

> Consolidated from MEMORY.md auto-capture entries (2026-07-23 to 2026-08-04).
> Dream run: 2026-08-25. Confidence: 0.90 (avg).

---

## PLUGIN_DIR Resolution — First Step Rule

All skills that reference `$PLUGIN_DIR` must resolve it as the VERY FIRST operational step (before Codebase Orientation or equivalent). Root cause of search-thrashing: PLUGIN_DIR appeared in early steps but was only resolved later.

Convention: add `## Resolve PLUGIN_DIR` immediately after frontmatter `---` in every skill. The section 1a node resolver is the fallback when `plugin-path.txt` is absent.

Since 2026-08-07, PLUGIN_DIR is resolved once per session via a UserPromptSubmit hook (`plugin-dir-context.cjs`) that reads `.claude/plugin-path.txt` and injects `PLUGIN_DIR: /path/to/plugin` into every message's context.

## Context Budget Enforcement — 3-Layer Design

Three non-overlapping layers prevent context exhaustion during Tech Spec generation:

1. **UserPromptSubmit hook** (`context-budget-icea-save.cjs`): injects early warning before Step 8. Covers SAVE ICEA, SAVE TECH, and REVISE keywords.
2. **Shared skill** (`context-budget-check.md`): mid-generation guidance with /compact and new-session options. Parameterized for reuse in icea-implement, code-review, etc.
3. **PreToolUse Write hook** (`context-budget-tech-write.cjs`): blocks the actual Write call if content has >15 unfilled `{...}` placeholders (Gate 1) or non-empty line count below threshold (Gate 2: 50 for tech specs, 30 for ICEA, 20 for arch docs). Runs at OS level, cannot be bypassed by skill instructions.

**Force escape:** write `temp/ADO-{ID}-tech-force.flag` sentinel; hook sees it, allows one write, deletes flag. Batch writers (architect, graph-sync) use time-bounded force flags (10 min TTL).

**Code block detection:** `countPlaceholders` tracks ``` fence state to prevent false positives from code examples.

## Step 8 Completeness Self-Check

After critic gate passes, model counts unfilled `{...}` placeholders:
- >15 = scaffold-only (do not write to temp, emit "CONTEXT EXHAUSTED" with `TECH ADO-{ID}` recovery)
- 6-15 = partial derivation (write to temp with CONTEXT NOTE warning)
- 0-5 = normal flow

## Critic Gates (ADR 0052, v3.9.0)

Two gates wired into icea-feature, plus the existing code gate:
- **Step 5 ICEA-draft gate** (`mode=icea`): after draft composed, before temp write. Bounded auto-revise loop (max 2).
- **Step 8 Tech-Spec gate** (`mode=tech`): after Tech Spec drafted from on-disk ICEA, before temp write. ICEA is already saved/immutable — ICEA faults route to `REVISE ADO-{ID}`.
- **icea-implement Step 4a** (`mode=code`): post-codegen, before disk write.

## EPIC Flow — Temp Staging

Step 8 generates ALL story specs + tracker draft to `temp/ADO-{ID}-Story-{N}-tech.md` + `temp/ADO-{ID}-tracker.md`. SAVE TECH performs one atomic move of all temp files to permanent. Developer reviews the complete package before committing.

**Hard Rule corrected:** "NEVER generate story specs before the epic-level spec DRAFT is complete and written to temp/ in Step 8" (not "before SAVE TECH").

## Cross-Session Recovery (section 0a)

PLAN/ICEA/TECH ADO-{ID} handlers must say "Invoke icea-feature skill — cross-session recovery entry at Step 5/8" (not just "Draft...cross-session recovery"). Without explicit skill invocation, the EPIC branch sizing check was never executed inline.

## Key Gotchas

- Changes to dev source SKILL.md do NOT auto-propagate to installed plugin cache — always patch BOTH paths
- Hook `context-budget-tech-write.cjs` must be in `_project-deploy/hooks/` and wired by bootstrap (it was missing from deployment initially)
- `2>/dev/null` silently swallowing bootstrap failure is a class of bug — never suppress errors in critical path calls
