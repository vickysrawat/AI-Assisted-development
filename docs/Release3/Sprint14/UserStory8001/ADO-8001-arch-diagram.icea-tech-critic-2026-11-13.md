# ICEA-Tech Critic — ADO #8001
Date: 2026-11-13
Verdict: PASS WITH NOTES


## Pass 1 — REVISE (12 findings)
| # | Severity | Finding | Resolution |
|---|---|---|---|
| F1 | HIGH | Story 2 wrote the draft to `temp/` before the secret scan | Scanner `--stdin`; no scratch file |
| F2 | HIGH | `extractHosts` dotted-name rule hits code and prose (`e.g.`, `process.env`) | URL / host-key / TLD-shaped / IPv4 rules; N-U10 |
| F3 | MED | Epic Open Question deferred; the epic template forbids that at SAVE TECH | ❓[1] Resolved (process); developer confirms at SAVE TECH |
| F4 | MED | AC-F1/F2/F7/F9/F12 missing a positive or negative test row | Rows added |
| F5 | MED | Secret tests tagged AC-F13; AC-F14 skill half uncited | Re-tagged AC-F7; AC-F14 rows added |
| F6 | MED | SAVE TECH would edit the immutable ICEA | Removed; deviations recorded in the spec and tracker; `REVISE ADO-8001` named |
| F7 | LOW | `--spec` mode rendered with no scan and no Write Gate | R0 scan + prompt |
| F8 | LOW | Existing-spec check ran before the dependency check | Reordered |
| F9 | LOW | Fake secrets would trip the commit gate | Built at runtime; fixture uses `SESSION_SIGNING_SECRET=` |
| F10 | LOW | Plugin-root `CLAUDE.md` keyword rows not in the ICEA | Dropped |
| F11 | LOW (ICEA) | AC-F13 scope covers two globs only | P-U8 extended to the two scripts |
| F12 | NOTE | AC-NF3 "hidden from PATH" vs env override | PATH-stripped manual run added |

## Pass 2 — PASS WITH NOTES
N1–N5 (wording drift; strict ccTLD / YAML-fence scanning) folded into the drafts.
N6 (ICEA fault, developer decision): the ICEA story table and System Context do not yet show the 4/6/3 re-split, `arch-spec-scan.cjs` or the `--spec` mode. Optional `REVISE ADO-8001`.
