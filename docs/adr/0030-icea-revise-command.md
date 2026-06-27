# 0030 — Dedicated /icea-revise command for ICEA and Tech Spec revision

**Status:** Accepted
**Date:** 2026-06-15
**Amended:** 2026-06-15 (v2.0.0 — 6 critical fixes applied; see below)

## Context

The only way to revise an existing ICEA was to re-run /icea-feature, which
triggered the full feature planning flow and buried the revision path in
Step 1.0 (REVISE / KEEP prompt). This was not discoverable, felt like
starting over rather than revising, had no support for targeting specific
sections or resolving individual open questions, and had no Tech Spec
revision flow at all.

With open question blocks (❓) in the Tech Spec (ADR 0029) and the expectation
that Tech Lead and Product team provide feedback before implementation, a
dedicated revision command is needed.

## Decision

A dedicated /icea-revise command and skill is introduced. It:
- Locates existing ICEA and Tech Spec files by ADO ID (Release and Sprint
  inferred from the file path — not re-asked)
- Confirms the inferred path with the developer before writing (Fix 3)
- Checks for existing implementation files and warns before re-gating (Fix 6)
- Shows the current state including all open questions
- Reads open questions from Section 10 table — not inline ❓ counting (Fix 2)
- Asks explicitly what needs updating — never assumes
- Shows a diff-style preview before writing
- Writes both files immediately (collaboration artefacts — no APPROVE gate)
- Resets ICEA Status to DRAFT and re-gates code generation
- Writes a single superseding Dream memory entry on re-approval (Fix 5)

## 6 Critical Fixes (v2.0.0)

### Fix 1 — Re-gate fires after partial code writes
Step 2 checks for existing implementation files before resetting Status.
Warns developer if code already exists and requires CONFIRM to proceed.

### Fix 2 — Open question source of truth
Section 10 table is the source of truth — not inline ❓ block counting,
which can drift if files are edited externally.

### Fix 3 — Path confirmation
After inferring path from ADO ID, skill confirms location with developer
before writing. Prevents incorrect writes if file was moved.

### Fix 4 — icea-feature Step 1.0 redirect
Step 1.0 REVISE branch now redirects to /icea-revise rather than handling
revision inline. Prevents two conflicting revision paths producing
inconsistent results.

### Fix 5 — Dream auto-capture deduplication
On re-approval, a single superseding memory entry is written for the ADO ID.
Prevents duplicate or contradictory entries in MEMORY.md.

### Fix 6 — Mid-implementation guard
Step 2 detects existing implementation files and warns developer before
resetting Status to DRAFT. Requires explicit CONFIRM to proceed.

## Consequences

- Revision flow is discoverable as a first-class command and keyword
- Open questions can be resolved without re-running the full ICEA flow
- Cross-document consistency maintained (ICEA and Tech Spec updated together)
- Code generation re-gate enforced on every revision
- /icea-feature Step 1.0 REVISE branch retained for backward compat
  but /icea-revise is the recommended path going forward
