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

# ICEA Code Review Skill (thin alias)

_Skill version: 2.0 · Last changed: 2026-08-28 · Plugin compatibility: ≥1.14.0 · Consent: B_

## Purpose

`icea-review` is a **thin alias** for `pr-spec-review --icea-only`. It reviews a PR/diff
against the approved **ICEA acceptance criteria only** (no Tech Spec design checks) and keeps
the familiar verb for the common "check my diff against the spec" request. All compliance
logic, status vocabulary, report format, and the merge verdict live in `pr-spec-review` and
the shared specs it references — this skill holds no independent review logic.

## Delegation (the entire procedure)

1. Read `.claude/plugin-path.txt` for `PLUGIN_DIR` (if absent, use the resolver in
   `skills/shared/plugin-path-resolution.md §1a`).
2. Read `$PLUGIN_DIR/skills/pr-spec-review/SKILL.md` and execute it with:
   - **scope = `--icea-only`** (acceptance-criteria compliance; skip Tech Spec design checks)
   - **output** = full four-part report by default; if the caller passed `--compact`, emit the
     compact verdict block instead (this is the form `checkin`'s Check B consumes).
3. pr-spec-review auto-discovers the ICEA for the branch's ADO ID, builds the diff↔AC map via
   `traceability-mapping-spec.md`, applies business-context (B1–B7) severity, and produces the
   report + verdict. Pass through any `spec=`, `pr=`, or `diff=` arguments unchanged.

## Why an alias, not a merge

`icea-review` (ICEA-only) is a strict subset of `pr-spec-review` (ICEA + Tech Spec). Keeping
the verb preserves discoverability and existing muscle memory / gate wiring; the `--icea-only`
scope makes it useful before a Tech Spec is approved. See the review-skill decision context in
the SRP refactor and `scope-flags-spec.md` (which registers `--icea-only`).

## Hard Rules

- Hold NO independent compliance logic — always delegate to `pr-spec-review --icea-only`.
- Do not restate the status vocabulary, checks, or report format here — they live in
  `pr-spec-review` + `traceability-mapping-spec.md` + `icea-schema.md` + `business-context-severity.md`.
- Business-context (B1–B7) severity escalation is applied by the engine per
  `skills/shared/business-context-severity.md` and is non-waivable.
