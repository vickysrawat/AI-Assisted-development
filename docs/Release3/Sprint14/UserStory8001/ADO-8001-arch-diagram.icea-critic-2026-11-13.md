# ICEA Critic — ADO #8001
Date: 2026-11-13 · Mode: icea · Source: internal (SAVE ICEA)

## Pass 1 — REVISE
- [Completeness] AC-F13 contradicted itself: a deny-list of real names kept in the test would put real application/organisation names into a plugin file, which AC-F13 forbids.
- [Completeness] AC-NF2 "caps reads per role" gave no number, so very different implementations would both pass.

Revision 1: AC-F13 became an RFC 2606 / RFC 5737 allow-list (the test holds no real names); AC-NF2 cap set to 15 files per role, with the excluded folders listed.

## Pass 2 — PASS WITH NOTES
- [Conformance] All mandatory sections present, including the Permission Boundary example; D-1 resolved (Option A).
- [Note] AC numbering is not sequential (AC-F12 to AC-F14 were added in revisions). Keep the IDs stable for traceability rather than renumbering.
- [Note] The assumption that the Write Gate secret-scan patterns cover YAML is unverified. The Tech Spec must name the check, and Story 2 must confirm it.
- [Note] Open Question 1 is deferred with justification (fixtures cover AC-F5 until Story 3). Acceptable.
