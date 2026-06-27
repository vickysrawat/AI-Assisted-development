---
name: pr-describe
description: >
  Generates a complete, ICEA-compliant pull request description for Azure DevOps.
  Use when a developer asks to write a PR description, create a pull request,
  summarise their changes, or is ready to raise a PR. Triggers on: "write PR",
  "create pull request", "PR description", "ready to merge", "raise a PR",
  "open a PR", or any request to document changes for code review.
  Reads staged git diff automatically. Validates all changes against the ICEA.
---

# PR Description Skill

_Skill version: 1.0 · Last changed: 2026-06-03 · Plugin compatibility: ≥1.14.0 · Consent: C_
## Purpose
Generate a structured, ICEA-traceable PR description that maps every code change
to an Acceptance Criterion, flags scope creep, and gives reviewers a clear
pass/fail checklist — all without the developer writing anything manually.

## Stack Context

Stack context is read from `.claude/architecture/architecture.md` during the
Codebase Orientation step. If that file is missing, fall back to the project
defaults below.

**Default stack (K&E project — update architecture.md to override):**
- Repo: .NET 8 / Angular 17+ / Node.js
- Tracking: Azure DevOps (ADO) work items
- Branch convention: feature/ADO-[ID]-short-description


## Codebase Orientation (optional — run if domain-map.md exists)

> Schema: `../shared/domain-map-spec.md`

Before executing, check for orientation files — do not scan source:

1. **Read `.claude/architecture/domain-map.md`** if present — use it to identify the feature area, layer, and entry-point file for context in output.
2. **Staleness check**: if `.claude/architecture/domain-map.md` modification date is >7 days older than the last structural git change, note it inline — do not block.
3. If `.claude/architecture/domain-map.md` is missing, continue without orientation.

## Execution Steps

### Step 1 — Collect Context

Run these commands automatically without asking the developer:

```
!git symbolic-ref --short HEAD
!git log dev..HEAD --oneline
!git diff dev..HEAD --stat
```

Extract the ADO work item ID from the branch name (pattern: ADO-[0-9]+).
If no ID found, ask: "What is the ADO work item ID for this branch?"

### Step 2 — Request ICEA

Ask the developer:
```
Paste the approved ICEA for ADO #[ID] so I can map your changes against it.
(You can paste just the Acceptance Criteria and Examples sections if preferred.)
```

If the developer says the ICEA is already in context, use it directly.

### Step 3 — Analyse the Diff

Read the full diff:
```
!git diff dev..HEAD
```

For each changed file, identify:
- Which layer it belongs to (Angular / .NET / Node.js / DB / Tests / Config)
- Which Acceptance Criterion it implements (AC-F1, AC-F2, AC-NF1, etc.)
- Whether it introduces any behaviour NOT described in the ICEA

### Step 4 — Generate the PR Description

Output the full PR description using the template in
`references/pr-description-template.md`.

Fill every section from the diff and ICEA. Never leave a placeholder unfilled.
If a section genuinely has no content, write "N/A — not applicable for this change."

### Step 5 — Flag Scope Creep

After the description, check every changed file against the ICEA.
If any change implements behaviour not described in any AC or Example, output:

```
⚠️ SCOPE CREEP DETECTED
The following changes are not covered by any ICEA Acceptance Criterion:
- [file path]: [what it does that isn't in the ICEA]
Action required: either add an AC to the ICEA or remove this change.
```

If no scope creep found:
```
✅ Scope check passed — all changes map to ICEA Acceptance Criteria
```

### Step 6 — Self-Review Checklist

End with:
```
Run this before requesting human review:
[ ] I have tested all 5 ICEA scenarios locally
[ ] All new tests pass (dotnet test && ng test --watch=false && npx jest)
[ ] No console.log / Debug.WriteLine left in production code
[ ] No TODO comments introduced without a linked ADO item
[ ] Bundle size delta checked (ng build --stats-json)
[ ] No secrets or connection strings in diff
```


## Model routing

This skill is in the **generation tier** — it uses `ICEA_MODEL` (default: `claude-opus-4-6`).

To override for this project, set in `.claude/settings.json`:
```json
{ "env": { "ICEA_MODEL": "claude-opus-4-6" } }
```

See `../shared/model-routing-spec.md` for full routing documentation.

## Business context severity

This skill does not perform security or compliance reviews. If output from this
skill surfaces data that may trigger B1–B7 sensitivity (see
`../shared/business-context-severity.md`), flag it to the developer. Do not
silently process or display attorney-client privileged matter data, immigration
identifiers, or other B1–B7 categories without acknowledgement.

---

## Hard Rules

- NEVER generate a PR description without reading the actual git diff
- NEVER mark an AC as "implemented" without finding the corresponding code
- NEVER skip the scope creep check
- If the diff is empty, say: "No changes detected between this branch and dev.
  Run git diff dev..HEAD to verify your branch has commits."
