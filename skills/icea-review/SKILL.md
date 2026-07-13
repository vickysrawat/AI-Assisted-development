---
name: icea-review
description: >
  Reviews a pull request or code diff against an approved ICEA document and
  produces a structured pass/fail compliance report. Use when a developer asks
  to review code against the spec, check ICEA compliance, validate a PR, audit
  a diff, or self-review before requesting human review. Triggers on:
  "review this PR", "check against ICEA", "ICEA compliance", "review my diff",
  "does this match the spec", "self-review", "audit my changes",
  or any request to validate code against a specification.
---

# ICEA Code Review Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: B_
## Purpose
Produce an objective, structured compliance report that tells a developer
exactly which Acceptance Criteria are implemented, which are missing, where
scope has crept in, and whether the stack conventions are followed — all
mapped to specific files and line references where possible.

## Stack Context

Stack context is read from `.claude/architecture/architecture.md` during the
Codebase Orientation step. If that file is missing, fall back to the project
defaults below.

**Default stack (K&E project — update architecture.md to override):**
- .NET 8 Clean Architecture | Angular 17+ OnPush standalone | Node.js Express
- Azure AD auth | EF Core | SQL Server
- xUnit / Jasmine / Jest testing


## Codebase Orientation (run before Step 1)

> Schema: `../shared/graph-index-schema.md` · `../shared/graph-module-schema.md`

Before collecting the diff, orient yourself to the project without reading raw source files:

1. **Read `.claude/architecture/architecture.md`** if it exists — provides system overview, layer responsibilities, and key patterns.
2. **Read `.claude/graph/graph-index.md`** if it exists — the module table maps each module to its entry point. Match the branch diff to the closest **Module** row and **read that module's detail file** (`.claude/graph/<module>.md`) for bounded context, key files, dependencies, and patterns.
3. **Read `.claude/architecture/architecture-security.md` and `architecture-data.md`** if present — use the authorization model and data-ownership map to check the diff for compliance (new/changed actions have an enforced policy; data writes respect ownership boundaries).
4. If none exist, continue without orientation (no prompt needed — icea-review is invoked mid-workflow when the developer already has context).
5. Use the graph to understand which module the branch diff touches. Reference the entry-point files in compliance findings rather than opening all changed files blindly.

5. **Staleness check** — if `.claude/graph/.stale` exists (set by the post-merge git hook), the graph may be behind the working tree:
   ```
   ⚠ .claude/graph may be stale — run /graph-sync to refresh. Continuing with current graph…
   ```
   Then proceed — do not block execution.
6. Do NOT scan `src/` or open source files during orientation — use only the architecture docs and the knowledge graph.

## Execution Steps

### Step 1 — Collect the ICEA and Diff

Run automatically:
```
!git symbolic-ref --short HEAD
!git diff dev..HEAD --stat
!git diff dev..HEAD
```

**Source file consent** — this skill operates on the diff and architecture docs.
Before reading any source file beyond the diff output, apply the gate from
`../shared/source-file-consent.md` (Category B). State which file, why the diff
context is insufficient for that specific finding, what you are looking for,
and the estimated token cost. Wait for confirmation before reading.

If no ICEA in context, ask:
```
Paste the approved ICEA for this branch (or at minimum the
Examples and Acceptance Criteria sections).
```

### Step 2 — Run the Seven Checks

Work through each check in `references/review-checks.md` in order.
For each check, scan the full diff before writing the result.

### Step 3 — Output the Compliance Report

Open with:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICEA COMPLIANCE REPORT — ADO #[ID]
Branch: [branch name]
Reviewed: [date from git log]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then output the full report using the format in `references/report-format.md`.

### Step 4 — Verdict

End with one of:

```
✅ READY FOR REVIEW
All ACs implemented. All scenarios covered. No scope creep. Conventions followed.
Recommended action: request human review.
```

```
⚠️ NEEDS WORK BEFORE REVIEW
[N] issues found. Fix these before requesting human review.
See flagged items above.
```

```
❌ BLOCKED
Critical issues found — missing ACs or scope creep requires ICEA update
or code removal before this can be merged.
See critical items above.
```

## Severity Levels

Use these consistently throughout the report:

| Level | Symbol | Meaning |
|---|---|---|
| Critical | ❌ | Blocks merge — missing AC, scope creep, security issue |
| Warning | ⚠️ | Should fix before review — convention violation, missing test |
| Info | ℹ️ | Observation — not blocking but worth noting |

**Business context override — mandatory for every review.**
Before finalising any finding's severity, apply the domain override check from
`references/review-checks.md` Check 7 and `../shared/business-context-severity.md`.
If a Warning or Info finding touches attorney-client data, immigration identifiers,
active case timelines, vulnerable client data, breach notification obligations,
physical safety data, or PII in a static-serving directory — escalate it to Critical.
State the override trigger (B1–B7). Business context overrides are not optional and
cannot be waived.
| Pass | ✅ | Confirmed implemented and correct |


## Model routing

This skill is in the **review tier** — it uses `REVIEW_MODEL` (default: `claude-sonnet-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "REVIEW_MODEL": "claude-sonnet-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.

## Persona

Execute as **[TL] Marcus Reid — Tech Lead** (14 yrs across web, service, and data layers). Optimizes
for honest spec-vs-code compliance; always asks "does the diff actually implement this AC, and does
it fit how we build?" Weigh [QA] Sam Okonkwo's AC-validation concerns. Expertise = this project's
actual stack per layer.

The persona sets *what to scrutinize* — it never licenses assumption. The approved ICEA and the diff
are the only sources of truth; never mark an AC met without the implementing code in hand (subordinate
to CLAUDE.md §3 / decision transparency). Never name the persona in the report. See
`../shared/personas-spec.md`.

## Hard Rules

- NEVER mark an AC as ✅ without finding the implementing code in the diff
- NEVER skip the scope creep check — it is the most important check
- NEVER give a ✅ READY FOR REVIEW verdict if any ❌ items exist
- If the diff is empty or too large to analyse fully, say so explicitly
- Reference specific file names when flagging issues — never vague statements
- When a test is missing, name the scenario it should cover
