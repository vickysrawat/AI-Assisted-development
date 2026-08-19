# Critic Output — Tech Spec package ADO-4000 (TECH mode, final gate before SAVE TECH)

_Run: 2026-08-14 · Mode: TECH critique · Independent subagent · Scope: ICEA + epic spec + 9 story specs + tracker_

## Verdict: REVISE → fixed → clean

The 9 story specs, the ICEA, and the tracker were mutually consistent and correctly reflected the locked design (asymmetric enforcement + L1/L2/L3 shared-content-core, NO mechanical projection + AC-F9 versioning). **Single systemic defect:** the epic spec `ADO-4000-…techspec.md` body (Overview, Story-Breakdown table, Files-Changed, Governance, Overall-Flow, Deferred-Decisions, header) had not been re-synced past ICEA #4 — it still presented the retired converged-projection / three-tier / hard-vs-soft model as live, contradicting every story it governs.

### Punch-list (all resolved)
| Severity | File | Issue | Resolution |
|---|---|---|---|
| Blocker | epic Overview | live "mechanically projected / three-tier (Copilot Preview gate)" | Rewritten to L1/L2/L3 + asymmetric (prevention/merge-gate) |
| Blocker | epic Story Breakdown | Story 2 "Projection engine + delta-map"; Story 3 "Rules projection"; wrong spec filenames | Retitled (Story 2 = L1 core ~4 SP; Story 3 = rules-as-L1); filenames corrected |
| Blocker | epic Governance | "three tiers / Tier B soft / hard-vs-soft / Copilot-soft approval" | Replaced with gate-point framing (both hard; required-check = Copilot hard gate) |
| Blocker | epic Files Changed + Flow | projected `Shared/skills/**`; "PreToolUse deny (soft)" | Rebuilt to Shared(L1)+Claude+Copilot(native)+neutral + AC-F9 artifacts; flow → best-effort client + required-check hard gate |
| Blocker | epic Deferred Decisions / Future-Dev | live D-4 + "projection engine, delta-map, override loader" | D-4 marked dissolved (#7); follow-on text struck |
| Major | epic header | "~44 SP … synced to #4" | → ~41 SP (Story 2 ~4, Story 8 6); synced to #8 |
| Major | epic AC-F7 | 4/6/8 owners without slice annotation | slice + required-check-is-hard-line prose aligned |

### Passed (no action)
- No LIVE projection/`$PLUGIN_DIR` usage in the 9 story specs / ICEA / tracker (all negations or history).
- AC coverage 1:1 incl. AC-F9 (Story 2 manifest+CI / Story 6 gate-artifact versioning / Story 7 eval-gate+stamp).
- Producer/consumer contracts consistent (`review-icea` → Copilot/skills, single owner Story 6; `artifact-write.cjs` 4→7; `ai-gate` 6 owns/8 distributes; `prompt-manifest.json` 2→3/6/7/8; `artifact-paths.md` 3a→4/6).
- Dependency DAG acyclic; SP totals ~41 coherent; no client/company name.

### Post-fix
Epic body re-synced to #6/#7/#8; re-checked — remaining "projection/delta-map" hits are negations only. Package moved to permanent docs and approved (Status ✅ APPROVED 2026-08-14).
