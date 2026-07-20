---
paths: skills/icea-feature
---
<!-- auto-generated — edit graph.json then run /graph-sync -->
_Fingerprint: aeaf18a74eec718e733d430eb47855e020a11f0e | Updated: 2026-07-18_

## Bounded context
The ICEA drafting gate — drafts Intent/Context/Examples/Acceptance documents before any
feature code is written. The most upstream skill in the ICEA workflow.

## Key files
- `SKILL.md` — full instruction set; Step 8 overlay table now has `vsto` row (before `dotnet_framework`) that selects `techspec-vsto.md` instead of ASP.NET MVC template
- `references/techspec-vsto.md` — VSTO tech spec overlay: Ribbon Changes, TaskPane Changes, Office Event Handlers, COM Interop Usage table, Files Changed, Test Plan (COM mock assertions), Deployment Impact (ClickOnce version bump), Reviewer Checklist
- `references/examples.md` — includes VSTO Example 5 (Export to PDF Ribbon button) showing correct AC shape: COM lifecycle (AC-NF1), Office version matrix (AC-NF2), COMException handling (AC-NF3) — NOT HTTP status codes

## Dependencies
- `skills/shared/write-gate-spec.md` — WRITE PENDING gate for all source/config writes
- `skills/shared/source-file-consent.md` — Category B consent before reading source files
- `skills/shared/business-context-severity.md` — B1–B7 sensitivity check
- `skills/critic/SKILL.md` — invoked at Step 5 (icea mode) and Step 8 (tech mode)
- ADO REST API — for fetching work item details

## Patterns
- Blocks implementation until ICEA receives `Status: ✅ Approved`
- Critic fires at two planning gates: ICEA draft (Step 5) and Tech Spec draft (Step 8)
- VSTO tech spec overlay: `vsto` token in `detected_stacks` → `techspec-vsto.md` (takes priority over `dotnet_framework` row)

**Depended on by:** icea-implement (reads the saved ICEA), icea-review.
