# 0074 — Migration log entry scoping: audit signal vs noise
Status: Accepted · Date: 2026-10-06
Governs: `skills/upgrade/SKILL.md`, `skills/shared/migration-knowledge/refs/specs/migration-log-spec.md`
Relates to: [[0070-migration-skill-continue-gate-elimination]], [[0068-end-to-end-audit-trail-and-rich-tracker]]

## Problem

Step 7 of the upgrade skill required a `[FINDING]` entry written before every residual fix
and a `[DECISION]` entry written after every Write Gate approval, optionally followed by a
`[LESSON]` entry and an update to `lessons.md`.

A typical upgrade with 10–15 residual compile errors produces 20–30 migration log writes.
Most of these writes document routine fixes: namespace renames, package version bumps, API
renames that the intake report already flagged as required changes with a specified remedy.

The migration log is intended as an audit trail for decisions and surprises. Requiring
identical log structure for every routine fix buries the signal (unexpected findings,
non-obvious choices) in noise (predictable, intake-matched fixes that have one correct
answer).

The net effect: reviewers skimming the migration log after a run cannot distinguish a
routine namespace rename from an unanticipated behavioral change — they have the same entry
format. The audit trail loses value as it grows, instead of gaining it.

## Decision

**Scope migration log entries to non-routine fixes only.**

| Fix type | Criteria | Log entry required |
|---|---|---|
| Unanticipated find | Not flagged by intake; discovered during tool run or residual phase | `[FINDING]` + `[DECISION]` |
| Non-obvious choice | Multiple viable approaches; architectural decision required | `[DECISION]` with alternatives |
| Surprising behavioral change | Silent runtime failure; not in intake | `[FINDING]` + `[DECISION]` + consider `[LESSON]` |
| Routine fix | Matches intake finding; single obvious fix; no choice required | Write Gate diff is the record |

**End-of-step summary entry (always written):**

After all residual fixes, append one summary entry to `migration-log.md`:

```markdown
### [RESIDUAL SUMMARY] Step 7 — {N} fixes applied — {date}
Anticipated (intake-matched): {N}
Unanticipated (logged individually above): {N}
```

This gives the audit trail the count without forcing per-fix entries for routine work. The
count is verifiable against the Write Gate diff history.

**The Write Gate diff IS the record for routine fixes.** The diff shows exactly what
changed, in which file, at which line. A migration log entry that repeats "changed namespace
from X to Y" adds no information beyond the diff.

## Rationale

- **Signal-to-noise ratio.** An audit trail where every entry has the same weight is
  functionally equivalent to no audit trail — the reader must process all entries to find
  the important ones. Restricting log entries to genuinely new information (surprises,
  choices) makes each entry meaningful.
- **Intake matching as the boundary condition.** If an intake section flags "package X:
  replace with Y," and the residual phase performs that replacement, the fix is anticipated.
  The intake entry + Write Gate diff together constitute a complete record. A third log
  entry is redundant.
- **Write Gate diffs are already structured records.** The Write Gate shows file path,
  changed lines, and surrounding context before every approval. This is a richer record
  for a routine fix than a migration log entry that would paraphrase it in prose.
- **Summary entry preserves auditability at the batch level.** The count of anticipated vs
  unanticipated fixes is meaningful — a ratio skewed heavily toward unanticipated is a
  signal that the intake was incomplete (a knowledge gap to capture). The summary entry
  preserves this signal without requiring per-fix noise.

## Alternatives rejected

- **Require log entries for all fixes but make the format shorter for routine fixes.**
  Rejected — the distinction between "short entry required" and "no entry required" is
  unclear at the point of logging. The criteria above are clear: anticipated + single
  obvious fix = no entry. Any format compression still requires the author to make a
  judgment call about length, adding friction without removing the fundamental noise.
- **Use the Write Gate approval timestamp as the audit record, no migration log at all.**
  Rejected — Write Gate diffs do not capture decision rationale or developer observations.
  For unanticipated finds and non-obvious choices, prose entries in the migration log are
  the only place this information is recorded. The log is necessary; it needs scoping,
  not removal.
- **Require entries for all finds but not decisions (FINDING-only log).**
  Rejected — the most valuable log entries are decisions: "I chose approach A over B
  because..." A FINDING-only log records what happened but not why. Decision entries are
  the primary signal for future runs and lessons learned.

## Consequences

- Step 7 produces fewer migration log writes per run on codebases with many routine residual
  fixes. The session is shorter; the log is denser with signal.
- The `[RESIDUAL SUMMARY]` entry at the end of Step 7 becomes the primary audit anchor
  for routine fixes. Reviewers can check the count and cross-reference against Write Gate
  diffs if they need to verify a specific routine change.
- Developers must exercise judgment about whether a fix is "routine" (intake-matched, single
  obvious fix) or "non-routine" (unanticipated, requires a choice). The criteria table in
  this ADR is the decision guide. When uncertain, log it — the cost of a redundant entry is
  lower than the cost of a missing record for a genuine surprise.

## Revisit when

- If post-upgrade reviews find that unanticipated fixes were missed (no log entry despite
  being a genuine surprise), tighten the "unanticipated" definition in the skill instruction
  to provide clearer examples.
- If the LESSONS ADO-{ID} command produces insufficient lesson density (because fewer log
  entries means fewer lesson signals), reconsider whether the `[LESSON]` entry threshold
  should be lower than the `[FINDING]`/`[DECISION]` threshold.
