# Tracker — LLM-Agnostic Multi-Harness Convergence (Claude Code + GitHub Copilot)
ADO #4000 · Type: EPIC · ✅ APPROVED 2026-08-14 · ~41 SP total (Story 2 ~4, Story 8 6; Story 6 sub-decomposes — total grows at sizing)

> 🚧 **COPILOT VALIDATION DEBT (hard rollout gate, opened 2026-08-17).** No GitHub Copilot access on the
> build machine → all Copilot-side ACs are DESIGNED-BUT-UNVALIDATED: **F1 (Copilot half), F5 (`.vscode`
> scoping), F7 (merge-gate + `review-icea`), AC-NF2 egress-on-Copilot, and spike H2.** These MUST be
> empirically validated on VS Code Copilot ≥1.109 + a GitHub repo (branch protection) BEFORE any Copilot
> production rollout. Harness-independent + Claude-side work proceeds meanwhile.

> Status legend: ✅ Done · ✅ Spec drafted (implementation pending) · ⏳ Pending · ⚠ Flagged.
> Child ADO numbers are filled when `IMPLEMENT ADO-4000 Story-{N}` is run.

| Story | Child ADO # | Logical scope | SP | Status | Notes |
|---|---|---|---|---|---|
| 0 | — | Verify settings disable-syntax (VS Code ≥1.109) | 1 | ✅ Done (spike, no code) | Completed 2026-08-13; result in `.claude/architecture/architecture.md` §8 + MEMORY.md |
| 1 | ADO-4001 | Skill self-containment spike (1 skill, both tools) | 3 | ⚠ Partial — Copilot BLOCKED | AC-F1: code in `spike/story-1/` + **mechanical guard PASS** (exit 0) + **Claude dual-run PASS (2026-08-17)**. **Copilot dual-run BLOCKED — no Copilot access on this machine** → AC-F1 is **PARTIAL** (Copilot half = validation debt; doc-grounded, empirically untested). Does NOT close D-4. |
| 2 | ADO-4002 | Shared **L1 content core** + prompt-version manifest + CI re-author guardrail; retire `$PLUGIN_DIR`. **No delta-map / no projection** (#7). | ~4 | 🚧 In progress | **2a+2b+2c-seed DONE & VERIFIED (2026-08-17)**: AC-F9 `scripts/check-prompt-versions.cjs` PASS; AC-F2 `scripts/check-l1-reauthor.cjs` PASS + negative test bites (caught an un-marked fork, exit 1); `Shared/` seeded (icea-status L1 + manifest + CHANGELOG + README). **DEFERRED (own gated passes): 2d `$PLUGIN_DIR` fleet-retirement (~531 refs) · full 2c content migration · 2e scripts/* exec.** |
| 3 | TBD | Rules projection (`paths:`/`applyTo` + unconditional creation-critical) | 3 | ✅ Spec drafted | AC-F3; D-5 resolved (unconditional-in-CLAUDE.md for creation-critical) |
| 3a | TBD | Neutral shared artifacts (architecture/graph/memory/docs read-once) | 3 | ✅ Spec drafted | AC-F6; D-2 resolved (relocate to neutral) |
| 4 | TBD | Hook compat shim + memory SessionStart/capture on both | 5 | ✅ Spec drafted | AC-F7, AC-NF4(parity) |
| 5 | TBD | CLAUDE.md scrub + per-harness model note; `.vscode/settings.json` scoping | 3 | ✅ Spec drafted | AC-F5, AC-NF4(parity); D-3 resolved (shared CLAUDE.md) |
| 6 | TBD | Governance hardening (approval-integrity, egress, memory-untrusted, secrets, gate) | 8† | ✅ Spec drafted | AC-NF1/NF2/NF3/NF7; D-1 (vendored-pinned default); sub-decomposes 6a–6d |
| 7 | TBD | Eval harness + audit stamping + capability floor; cross-harness cost telemetry | 5 | ✅ Spec drafted | AC-NF5, AC-NF6 |
| 8 | TBD | Provisioning/sync/teardown (hash-verified `.github/` deletes) + gate agents (name-from-dir) + neutral `plugin.manifest.json`; harness-neutral install | 6 | ✅ Spec revised | AC-F4, AC-F8a, AC-F8b, AC-NF7(distribution), AC-F7(agent-gen, partial); depends on 2,5,6 (distributes Story 6's gate) |

† Stories 2 (5 SP) and 6 (8 SP) exceed the ≤5-SP shippable-slice rule and sub-decompose into ≤5-SP child stories at implement-time sizing (2a–2d; 6a–6d). Total ~41 SP grows accordingly.

## Open items carried (non-blocking)
- Skill-count denominator: `skills/` has 33 dirs; the ICEA/AC-F2 use **32** (excluding `shared/`). Story 2 additionally questioned whether `command-stubs` (an internal deploy helper) counts as a user-facing skill — confirm the exact denominator at Story 2 implement time.
- Deferred decisions D-1…D-5 + AC-NF2 classifier scope are recorded in each owning story's spec and the epic Tech Spec's "Deferred Decisions" table — resolved before each story implements.

## Audit
- 2026-08-13 — Epic ICEA saved (critic ICEA-mode: PASS WITH NOTES, 9 fixes applied).
- 2026-08-13 — Epic package drafted: epic Tech Spec + 9 story specs (Stories 1–8 + 3a) + this tracker.
- 2026-08-13 — Adversarial architect review (4 independent code-grounded reviewers) → REVISE. ICEA revised (Revision Log #4: AC-NF1 Tier-C scope, AC-NF2 egress re-scope, AC-F2 real delta-map, AC-F3 rule-inventory, AC-NF6 deterministic eval, producer/dep corrections). All 9 story specs re-revised to match. Cross-story producer contracts now consistent (artifact-paths.md: 3a→4/6; artifact-write.cjs: 4→7). SP re-sized (Story 2 ~7, Story 8 ~6). NOTE: epic Tech Spec `ADO-4000-tech.md` still needs a light sync (SP totals + AC-NF1/NF2 wording) to match the revised ICEA. Awaiting optional re-verification + TECH-mode critic + `SAVE TECH ADO-4000`.
- 2026-08-14 — Verify-the-fix pass (3 verifiers): all Criticals RESOLVED against code; caught + broke 2 new dependency cycles (6↔8, 3→8→6→5→3); DAG now acyclic.
- 2026-08-14 — 3-iteration web-grounded critical pass. ADOPTED the ASYMMETRIC enforcement model (ICEA Revision Log #6): Claude = write-time PREVENTION (unchanged); Copilot = DETECTION + MERGE-GATE — hard gate = CI `ai-gate` REQUIRED status check on a protected branch (known-good), critic = review-time `review-icea` code-review skill (owned by Story 6; no sibling-skill orchestration → dissolved F1.1/F2.1). Fixed F1.2 (`chat.hookFilesLocations` in Story 5/AC-F5). Cascaded into Stories 2,4,5,6,7,8 (verified: 4/4 headers, no company name). Story 8 now stands up the branch-protection/required-check (the Copilot hard gate) + WARNS if unprotected. Phase-1 spike scaffolded (`spike/`) + protocol (`docs/plans/2026-08-14-phase1-spike.md`). REMAINING before SAVE TECH: (a) run spike H1/H2 (hands-on) to confirm review-icea can load the ICEA; (b) TECH-mode critic will catch any residual epic-spec/story wording drift.
- 2026-08-14 — STRUCTURE LOCKED (ICEA #7): shared L1 content core + native per-harness (L2/L3); projection/ delta-map/`$PLUGIN_DIR` RETIRED. Prompt-artifact versioning added (ICEA #8, AC-F9). Re-cascaded ALL 9 story specs + epic AC-matrix to the current design (verified: 4/4 headers, no company name). User chose formal APPROVE ADO-4000 (proceeding without a pre-approval spike — Story 1 IS the spike / first implementation story; H2 failure there → REVISE). IN PROGRESS: TECH-mode critic gate → then SAVE TECH (move temp→docs) → APPROVE flip. Not approving until the critic verifies clean.
