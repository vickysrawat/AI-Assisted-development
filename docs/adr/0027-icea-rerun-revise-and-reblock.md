# 0027 — ICEA re-run revises (not overwrites), and re-blocks the gate
Status: Accepted · Date: 2026-06-12
Amended: 2026-06-15 (v2.0.0) — The REVISE branch in icea-feature Step 1.0
now redirects to /icea-revise (ADR 0030) rather than handling revision inline.
The REVISE/KEEP prompt is retained for backward compat but /icea-revise is the
recommended path going forward. /icea-revise includes path confirmation,
mid-implementation guard, open question source-of-truth fix, Dream deduplication,
and diff-style preview — none of which the inline REVISE branch provides.

## Problem
`icea-feature` had no existing-file handling. Re-running on a feature that already
had an ICEA regenerated a fresh draft from the prompt and wrote it with no
exists-guard — silently overwriting prior edits, approvals, and D-selections, or
(if the reworded feature name produced a different kebab slug) orphaning a second
ICEA for the same ADO ID. There was no defined revise path and no protection for an
already-approved ICEA.

Investigating the fix surfaced two latent gate bugs that meant the ICEA enforcement
floor was not actually enforcing:
1. **Filename mismatch.** Step 6 writes `docs/icea/ADO-<id>-<feature>.md`, but both
   `icea-floor.sh` and `validate-pr-compliance.py` globbed `icea-*.md` — so they
   matched no real ICEA files at all.
2. **Status regex mismatch.** The template and skill write `Status: ✅ Approved`
   (emoji decoration), but the predicate was `Status:\s*Approved`, which the emoji
   breaks. Even a correctly-approved ICEA failed the predicate.

## Decision
**Re-run is revise-by-default, keyed by ADO ID.** Step 1.0 globs
`docs/icea/ADO-<id>-*.md` before classifying and branches: no file → fresh draft;
`DRAFT` → load as working draft and enter the EDIT/APPROVE cycle, reusing the exact
existing path; `✅ Approved`/`Locked` → confirm (REVISE/KEEP) before doing anything.
`--force` is the explicit scrap-and-restart escape hatch. Prior Sign-Off and
D-selections are carried forward; history is appended, not reset.

**Revising an approved ICEA re-blocks code generation.** On REVISE, the skill
immediately rewrites the `Status:` line off `Approved` to
`DRAFT — Revising (supersedes approval of <date>)`. Because the floor hook and CI
check treat any `Status:` line containing `Approved` as satisfied, this single edit
re-arms the gate: source-file writes block until re-approval restores
`Status: ✅ Approved`. The revise line deliberately uses lowercase "approval" so it
cannot self-satisfy the predicate.

**Gate predicates fixed to match reality.** Both hooks now glob `ADO-*.md` (plus the
legacy `icea-*.md`) and match `Status:.*Approved` so the documented emoji format is
recognised. Without this, the re-block would have had nothing to act on.

## Rationale
The overwrite behaviour was a silent data-loss bug — re-running to *refine* an ICEA
destroyed the refinement. Keying on ADO ID rather than feature-name slug is what
prevents duplicate orphans. Re-blocking on revise follows the gate's own honesty
posture (ADR 0009/0010): an ICEA under active revision is not an approved spec, so
code must not flow from it until re-approved. The two predicate fixes are not
optional polish — the gate was inert without them, so the enforcement guarantees
described in ADR 0009 were not actually holding for any ICEA written under the
current filename convention.

## Revisit when
ICEA filenames change again (keep both globs in sync with Step 6), or the status
vocabulary gains states beyond Draft/Approved/Locked that should affect the floor.
