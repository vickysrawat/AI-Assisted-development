# 0032 — Global keyword handlers for ICEA workflow

**Status:** Accepted
**Date:** 2026-06-15

## Context

Commands like `/icea-approve` require the developer to remember exact command
names. After a session gap, this friction is higher — the developer may not
remember which command to run or what arguments to pass. More importantly,
when a Tech Lead approves an ICEA via email or Teams, the developer needs to
action that approval immediately without looking up command syntax.

## Decision

CLAUDE.md Section 0a defines global keyword handlers. Claude recognises these
patterns in any message, in any session, without a leading `/`:

| Pattern | Routes to | Notes |
|---|---|---|
| `APPROVE ADO-{ID}` | icea-approve skill | Case-insensitive |
| `APPROVE ADO-{ID} Story-{N}` | icea-approve skill | Story-level approval for Epics |
| `IMPLEMENT ADO-{ID}` | icea-implement skill | Case-insensitive |
| `IMPLEMENT ADO-{ID} Story-{N}` | icea-implement skill | Story-by-story for Epics |
| `REVISE ADO-{ID}` | icea-revise skill | Case-insensitive |
| `STATUS ADO-{ID}` | icea-status skill | Case-insensitive |
| `BUG ADO-{ID} — {description}` | Log to tracker | Immediate, no gate |

ADO ID normalisation: ADO-1847, ADO #1847, and 1847 all resolve to the
same ID. Skills normalise on ingestion.

Keyword handlers take priority over general conversation. If the pattern
is recognised, the skill executes immediately.

Slash command equivalents remain available for discoverability:
`/icea-approve`, `/icea-implement`, `/icea-revise`, `/icea-status`.

## Consequences

- Developers do not need to remember command names after a session gap
- Approval received externally can be actioned with a single natural phrase
- The ADO ID in the keyword anchors the action to the right files on disk
- Slash commands remain as discoverable alternatives
