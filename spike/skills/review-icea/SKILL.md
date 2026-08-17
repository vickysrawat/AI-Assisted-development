---
name: review-icea
description: >
  Review a pull-request diff against the approved ICEA/Tech Spec for the work item and flag any change
  that is not traceable to an accepted acceptance criterion, or that violates one. Use at code-review /
  PR time. This is the Copilot-side "critic" — it runs at REVIEW time (no inline sibling-skill needed).
---

# review-icea (spike) — critic at review time

Spike goal (H2): prove a Copilot **code-review** agent skill can auto-load the repo's approved ICEA and
gate a PR diff — the linchpin of the asymmetric model (critic moves to review time on Copilot).

## Inputs
- The PR diff (changed files + hunks).
- The approved ICEA at `docs/Release*/Sprint*/UserStory*/ADO-<id>-*.icea.md` (for the spike, use
  `spike/fixtures/ADO-9999-demo.icea.md`). If the code-review surface cannot read a repo file directly,
  that is the H2=PARTIAL signal → note it (would need MCP or a coordinator agent to feed the ICEA).

## Procedure
1. Load the ICEA; extract the Acceptance Criteria (AC-*) and the Out-of-Scope list.
2. For each changed file/hunk:
   - Map it to the AC(s) it implements. If it maps to NONE → flag **"untraceable change (no AC)"**.
   - If it does something an AC forbids or that is listed Out-of-Scope → flag **"AC violation"** and cite the AC.
3. For each AC that requires code but has NO implementing change in the diff → note **"AC not yet covered"** (informational).
4. Emit a review summary: per-finding = {file, line, AC-ref, verdict, why}. Verdict PASS only if every
   changed file traces to an AC and no AC is violated.

## Spike pass/fail
- **PASS:** the review cites `ADO-9999-demo` ACs and flags the seeded AC-2 violation in the non-compliant diff.
- **PARTIAL:** reviews but cannot load the repo ICEA (record the load-path limitation).
- **FAIL:** no ICEA-aware review possible.

> Advisory only — the HARD gate is the required `ai-gate` check (H3). This skill improves review-time
> feedback; it is not the enforcement floor.
