# ICEA Review Report Format
# Used by icea-review skill — full report structure

---

## Full Report Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICEA COMPLIANCE REPORT — ADO #[ID]
Branch: [branch name]
Feature: [feature name from ICEA]
Commits: [N] commits, [N] files changed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
───────
✅ Passed:   [N] checks
⚠️ Warnings: [N] items to fix before review
❌ Critical: [N] blocking issues

[Full output of all 7 checks from review-checks.md]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critical — fix before raising PR:
  1. [file:line] — [what to fix]
  2. [file:line] — [what to fix]

Warnings — fix before requesting human review:
  1. [file:line] — [what to fix]
  2. [file:line] — [what to fix]

Info — consider but not blocking:
  1. [observation]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT: [✅ READY FOR REVIEW / ⚠️ NEEDS WORK / ❌ BLOCKED]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Compact Re-review Format

After the developer fixes issues and asks for a re-review, use this shorter
format — only show what changed:

```
RE-REVIEW — ADO #[ID] — [fixes applied]
────────────────────────────────────────
Previously flagged — now resolved:
  ✅ [item that was ❌ or ⚠️, now fixed]
  ✅ [item that was ❌ or ⚠️, now fixed]

Still outstanding:
  ⚠️ [item still not fixed]

New issues introduced:
  ❌ [anything new found in the latest diff]

VERDICT: [✅ / ⚠️ / ❌]
────────────────────────────────────────
```

---

## Reviewer Handoff Note

Generate this after a ✅ verdict — paste into the ADO PR description
or add as a PR comment:

```
Self-review completed via icea-review skill.

ICEA Compliance:
  ✅ All [N] Acceptance Criteria implemented
  ✅ All 5 ICEA scenarios covered by tests
  ✅ No scope creep detected
  ✅ Stack conventions followed (.NET / Angular / Node.js)
  ✅ Security checks passed

Reviewer focus areas:
  [Any specific areas the human reviewer should pay attention to,
   or known tradeoffs made during implementation]
```
