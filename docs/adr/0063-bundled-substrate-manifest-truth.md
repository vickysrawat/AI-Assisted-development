# ADR 0063 — Bundled substrate: manifest-truth guard, real-artifact tests, terminology, generated README index

Date: 2026-09-15 · Status: Accepted · Extends ADR 0003 (shared primitives) and the ADR 0061/0062 substrate work

## Context
The shared-substrate packaging seam and its documentation drifted apart, and the drift shipped:
- The count of shared specs disagrees across four "authorities": README says 41, DEVELOPER-GUIDE
  says 42, `plugin.json → components.shared` has 45, disk has 46. None match.
- `skills/shared/multi-root-scan.md` exists and is in use (CLAUDE.md boundary-crossing writes) but is
  NOT registered in `components.shared` — an unregistered, shipping spec.
- `substrate-drift.test.cjs` vendors SYNTHETIC throwaway files; nothing tests that the REAL substrate
  bundles cleanly and completely.
- README hand-duplicates derivable facts (spec count, full spec list, consumer tables), so it re-drifts
  on every change; and it mixes current-state with history.
- "Vendored" misnames first-party plugin files (vendoring = third-party). The mechanism is
  self-contained BUNDLING of first-party substrate for standalone deployment.

## Decision
- **`plugin.json → components.shared` is the single manifest of record** for shared specs. `validate.js`
  asserts it equals `skills/shared/*.md` on disk (minus README) — both directions. Register
  `multi-root-scan`.
- **Add a real-artifact test**: vendor the ACTUAL `skills/shared/`, assert file-count == disk and the
  drift-check reports clean. (The synthetic test remains as the algorithm's negative-path proof.)
- **Terminology**: rename the verb "vendored" → "bundled" throughout; keep the accurate noun
  "substrate" (already pervasive in filenames/keys). Reserve "vendored" for genuine third-party code
  (graph-viz's mermaid/WebGL libs).- **README**: carries CURRENT STATE ONLY (history lives in CHANGELOG/ADRs). The spec-list/count section
  is GENERATED from `plugin.json` (a `node` script), not hand-maintained. Non-derivable prose is kept.
 
## Consequences
- The 46-vs-45 drift is closed and cannot silently recur (CI fails on manifest ≠ disk).
- The substrate test now exercises real content, catching glob regressions and unreadable files.
- Docs stop claiming numbers they can't keep true; the spec list has one source of truth.
- No runtime change: the bundling seam remains packaging-time only and is still not consumed at runtime.
- Rollback: revert the change set; guards and generated section are additive.

## Alternatives rejected
- Keep hand-maintaining README counts/lists — guarantees re-drift (the status quo that failed).
- Rename "substrate" → "foundation" too — synonym churn across filenames/keys for no meaning gain;
  risks a new prose-vs-code split.
- Delete the synthetic drift test in favour of the real one — loses the negative-path (mutation→drift)
  proof, which the tautological real test can't give.
