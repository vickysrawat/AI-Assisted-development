# Tech Spec — Story 1: Skill self-containment spike

ADO #4000 · Release 4 · Sprint 1 · Story 1 Status: DRAFT (revised 2026-08-14 to match ICEA Revision #8) · STORY · 3 SP

> Per-story spec under the epic ADO-4000-tech.md. This is the **FIRST implementation story** under the
> approved plan — the proof-of-concept **spike** that de-risks the multi-harness epic before Story 2
> establishes the shared **L1 content core** across all 32 skills. Scoped to **AC-F1** (the both-tools
> self-containment proof) plus the AC-F2 sibling-invocation **probe** (informational).
> Source ICEA: `docs/Release4/Sprint1/UserStory4000/ADO-4000-llm-agnostic-multi-harness.icea.md`
> (esp. Revision Logs #6 asymmetric enforcement, #7 L1/L2/L3 shared-content-core, #8 prompt-artifact
> versioning; the "Enforcement model" + "Repository structure & layering (L1/L2/L3)" subsections; and
> AC-F1/AC-F2/AC-F9).
> This is a plugin/tooling story: Node.js CJS scripts + markdown skills/hooks. There is no database,
> no Angular/ASP.NET layer, no HTTP API — the framework template sections are adapted accordingly.
>
> **Framing within the locked L1/L2/L3 structure (ICEA #7).** L1 (`Shared/`) is CONTENT & STANDARDS —
> single source, harness-independent, never duplicated. L2/L3 (`Claude/`, `Copilot/`) are engagement +
> enforcement, authored **natively** per harness — there is **no mechanical projection, no delta-map,
> and no runtime `$PLUGIN_DIR` bridge** between them (all RETIRED in #7). This spike proves, on one
> representative content item, the two properties the whole structure rests on: **(a) an L1 content item
> is CONSUMED natively by both harnesses** (Claude discovers it from its native path, Copilot from its
> native path — no mechanical projection step is required for the content to work), and **(b) a dual-run
> with no `$PLUGIN_DIR`** anywhere in the exercised path.

---

## Overview

This is the **first implementation story** under the approved plan. It proves the epic's governing structural pattern — *L1 content authored once, CONSUMED natively by each harness, self-contained, project-relative reads, no `$PLUGIN_DIR`* — on exactly **one** representative L1 content item before the shared L1 core is established fleet-wide in Story 2. The chosen item is the **`icea-status`** skill: a read-only, low-dependency status/analysis skill that reports the on-disk state of an ADO ID and the single next action.

**What "proven" means here, mapped to the L1/L2/L3 structure (ICEA #7).** The spike delivers two structural proofs and nothing more:
- **(a) L1 content is CONSUMED natively by BOTH harnesses — no mechanical projection.** The `icea-status` content lives once as an L1 item; Claude Code discovers and runs it from its native project skills path and VS Code Copilot ≥1.109 discovers and runs it from its native path. The spike does NOT build a delta-map or a projection engine (both RETIRED in #7); the copy into each harness's native path is a plain, hard-coded placement of the same content, standing in for whatever native packaging Story 2 chooses per harness. The load-bearing claim is that the *same L1 content works, consumed natively*, not that a transform layer exists.
- **(b) Dual-run with NO `$PLUGIN_DIR`.** Neither harness resolves a runtime plugin dir anywhere in the exercised path — the retirement of the `$PLUGIN_DIR` bridge is demonstrated end-to-end on a live skill.

**Honest scope of the evidence this spike produces (re-scoped per ICEA Revision #4, note (f)).** `icea-status` is a *best-case* pilot, not a representative one. Ground truth from the current source (`skills/icea-status/SKILL.md`): its only two `$PLUGIN_DIR` occurrences are **prose "see also" pointers** — a reference to a `business-context-severity.md` model it explicitly does NOT trigger, and a persona-lens pointer to `personas-spec.md`. It has **no executable `$PLUGIN_DIR` read**, **no `.claude/plugin-path.txt` resolver fast-path to strip**, **no `$PLUGIN_DIR/scripts/*` execution**, and **no sibling-skill invocation**. Therefore this spike proves ONLY two things: (1) the native-consumption mechanics (author once as L1 content, place into both harness native paths, residual-token guard — no delta-map, no projection engine) and (2) Copilot *discovery + execution* of a natively-placed L1 skill on VS Code ≥1.109. It does **NOT and CANNOT close D-4** (the native-authoring threshold) for orchestrating skills, because `icea-status` exercises none of the hard shapes D-4 turns on — runtime `$PLUGIN_DIR` reads, `scripts/*` execution, or sibling-skill invocation. **D-4 stays gated on Story 2's harder skills** (`icea-feature`, `icea-implement`, `migration`); this story records that explicitly and does not let a green `icea-status` run be mistaken for a D-4 resolution.

**Copilot sibling-skill-invocation probe (now INFORMATIONAL — orchestration is review-time per ICEA #6).** Under the asymmetric-enforcement model adopted in #6, Copilot's critic/orchestration runs at **review time** as the GA `review-icea` code-review skill, which needs **NO inline sibling-skill invocation** — so whether Copilot can invoke a sibling skill inline is **no longer on the governance-critical path** (it does not decide whether Copilot is governed; the CI `ai-gate` required check does, per #6). The probe is therefore retained as **informational** data only: a minimal throwaway skill `Shared/skills/spike-sibling-probe/SKILL.md` whose only action is to `Read` the natively-placed `critic` SKILL.md and attempt to execute it inline, placed into both harnesses' native paths and invoked in Copilot. The outcome is recorded as PROVEN / UNPROVEN and fed forward as a **useful-but-non-blocking** input to Story 2's native-authoring decisions (and to D-4). It is *not* a gate on this story and — post #6 — no longer the hard governance question it was under the earlier "must project orchestrating skills" framing; the ICEA still lists sibling invocation as a Phase-1 check, and this probe supplies that evidence without treating a UNPROVEN result as a governance hole.

**Shared-dependency strategy decision (propagates to all 32 skills in Story 2).** The relocated skill needs its two shared reference docs (`business-context-severity.md`, `personas-spec.md`). Two layouts were considered; the choice is made **now** because Story 2 replicates it across the fleet:

- **A) Per-skill `_shared/` copies** — bundle a copy of each shared file inside every skill folder. Rejected: with 32 skills sharing a handful of reference docs, this duplicates each shared file up to N times, directly violating the ICEA success metric *"1 source of truth per artifact"* and creating drift the epic exists to eliminate.
- **B) A single `shared/` directory in L1** (`Shared/skills/shared/`, placed once into each harness's native path at `.claude/skills/shared/` and `.github/skills/shared/`) that all skills read by a project-relative path — **CHOSEN**. One L1 source, one copy per harness's native tree, no N-way duplication — the same single-source-per-artifact property the L1 core exists to guarantee; still self-contained (no runtime plugin dir) because the read is a project-relative sibling path, not `$PLUGIN_DIR`.

So the work is: relocate `icea-status` into the L1 content core at `Shared/skills/icea-status/`; place its two shared reference docs **once** under `Shared/skills/shared/`; rewrite the skill's two prose `$PLUGIN_DIR/skills/shared/X` pointers to the project-relative `shared/X` location; author the minimal `spike-sibling-probe` skill; place the L1 content into both `.claude/skills/**` (Claude native path) and `.github/skills/**` (Copilot native path) with a small provisioning helper; then run in **both** Claude Code and VS Code Copilot ≥1.109 against a scratch fixture, confirming (a) identical `icea-status` behaviour with **zero** `$PLUGIN_DIR`/dangling-reference failures and (b) the informational sibling-probe PROVEN/UNPROVEN result. The placement here is a plain manual/scripted copy — Story 1 deliberately hard-codes the one skill and does **not** build any projection engine or delta-map (both RETIRED in #7); Story 2 decides the real per-harness native packaging on top of this single-`shared/` layout.

---

## AC Coverage Matrix

Every AC in scope for this story must be covered by at least one file change; every file change must satisfy at least one AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | One L1 content item (relocated skill) is CONSUMED natively by BOTH Claude Code and VS Code Copilot ≥1.109 with zero `$PLUGIN_DIR`/dangling-relative-reference failures (no mechanical projection) | `Shared/skills/icea-status/SKILL.md`, `Shared/skills/shared/business-context-severity.md`, `Shared/skills/shared/personas-spec.md`, `.claude/skills/**` (native placement), `.github/skills/**` (native placement), `scripts/spike-project-skill.cjs`, `temp/scratch-fixture/` | ✅ Covered |
| AC-F2 (informational probe only — orchestration is review-time per #6) | Copilot sibling-skill-invocation is PROVEN or explicitly recorded UNPROVEN as non-blocking evidence carried to Story 2 | `Shared/skills/spike-sibling-probe/SKILL.md`, `.github/skills/spike-sibling-probe/**` (native placement), spike evidence attached to PR | ✅ Covered (probe delivers informational evidence; not governance-critical post #6; does not resolve D-4) |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `Shared/skills/icea-status/SKILL.md` (relocated, prose pointers rewritten to project-relative `shared/`) | AC-F1 |
| `Shared/skills/shared/business-context-severity.md` (single shared source, not per-skill copy) | AC-F1 |
| `Shared/skills/shared/personas-spec.md` (single shared source, not per-skill copy) | AC-F1 |
| `Shared/skills/spike-sibling-probe/SKILL.md` (minimal probe that Reads+executes `critic` inline) | AC-F2 (informational evidence only) |
| `.claude/skills/**` (native placement for Claude Code) | AC-F1 |
| `.github/skills/**` (native placement for GitHub Copilot) | AC-F1, AC-F2 (probe run) |
| `scripts/spike-project-skill.cjs` (one-shot native-placement helper + residual-token guard) | AC-F1 |
| `temp/scratch-fixture/` (provisioned docs fixture the skill reports on) | AC-F1 |

**Coverage result:** AC-F1 is covered by a self-contained L1 content item reading a single shared directory, placed into each harness's native path and CONSUMED natively in both tools (no mechanical projection). The AC-F2 sibling-invocation capability is covered *as an informational probe only* — under #6 it is no longer governance-critical (Copilot's critic is the review-time `review-icea` skill needing no inline sibling invocation); this story produces the PROVEN/UNPROVEN evidence and hands it forward as non-blocking input; it does not claim to resolve AC-F2 or D-4. No file change is orphaned. No gaps ✅.

---

## Files Changed

Real plugin paths. Change column: `+` new, `~` modified. There is no database, so no schema/DDL section.

| File | Change +/~ | Purpose |
|---|---|---|
| `Shared/skills/icea-status/SKILL.md` | + | L1 content item — relocated copy of `skills/icea-status/SKILL.md`, self-contained: its two prose `$PLUGIN_DIR/skills/shared/X` pointers rewritten to the project-relative `shared/X` location. There is no executable `$PLUGIN_DIR` read and no `plugin-path.txt` resolver in this skill, so nothing else is stripped. Step 2's `find docs …` stays project-relative (already correct). |
| `Shared/skills/shared/business-context-severity.md` | + | **Single** L1 shared reference (strategy B), NOT a per-skill copy. One source, read by any skill via a project-relative `shared/` path. |
| `Shared/skills/shared/personas-spec.md` | + | **Single** L1 shared reference (the `[DL]` lens), same single-source strategy. |
| `Shared/skills/spike-sibling-probe/SKILL.md` | + | Minimal throwaway skill for the informational Copilot sibling-invocation probe: its only action is `Read` the natively-placed `critic` SKILL.md and attempt to execute it inline; establishes a non-blocking PROVEN/UNPROVEN datum for AC-F2 (not governance-critical post #6). Removed at end of spike (see Rollback). |
| `.claude/skills/icea-status/SKILL.md`, `.claude/skills/shared/*`, `.claude/skills/spike-sibling-probe/SKILL.md` | + | Native Claude placement — a byte-for-byte copy of the `Shared/skills/` L1 source at the Claude native project skills path, CONSUMED directly (no delta-map). The single `shared/` dir is placed once (not once-per-skill). |
| `.github/skills/icea-status/SKILL.md`, `.github/skills/shared/*`, `.github/skills/spike-sibling-probe/SKILL.md` | + | Native Copilot placement — the same L1 source at the Copilot native project skills path, CONSUMED directly; single shared `shared/` dir. |
| `scripts/spike-project-skill.cjs` | + | One-shot Node CJS helper: copies `Shared/skills/**` into both `.claude/skills/` and `.github/skills/` (a plain placement — NOT a projection engine or delta-map, both RETIRED in #7), then greps both native trees for any residual `$PLUGIN_DIR`, `../`, `plugin-path.txt`, or `installed_plugins.json` token and exits non-zero if any is found. Also verifies the single `shared/` dir exists once in each native tree. Hard-coded to this one skill set; Story 2 decides the real per-harness native packaging. |
| `temp/scratch-fixture/docs/Release4/Sprint1/UserStory9999/ADO-9999-spike.icea.md` | + | Provisioning step: a synthetic scratch docs fixture (a minimal ICEA + tracker for a throwaway ADO-9999) the relocated skill reports on during the both-tools run. Synthetic, no real privileged/PII data. |
| `skills/icea-status/SKILL.md` | ~ | Left in place unchanged for this story (parity reference); the fleet-wide removal of the old copies happens in Story 2. Listed for traceability — the spike does not delete the original. |

---

## Skill Interface Surface (replaces "API Changes")

No external/HTTP API. The skill's interface surface is its invocation contract and its file reads:

- **Invocation (Claude Code):** `/icea-status ADO-9999` or the bare keyword `STATUS ADO-9999`. Claude Code auto-discovers the skill from the project `.claude/skills/icea-status/` path — no plugin dir, no registry lookup.
- **Invocation (VS Code Copilot ≥1.109):** the skill is discovered from `.github/skills/icea-status/` (Copilot native path) and invoked as an agent skill from the chat surface. Same SKILL.md content, same reported output.
- **Reads (project-relative only):** (a) the **single** L1 shared references placed at `shared/business-context-severity.md` and `shared/personas-spec.md` — one copy per harness native tree, not a per-skill duplicate; (b) the target project's `docs/**` tree via `find docs …` from the project root. It reads **nothing** outside the project tree — no `$PLUGIN_DIR`, no `~/.claude`, no `plugin-path.txt`, no `installed_plugins.json`.
- **Sibling-probe interface:** `spike-sibling-probe` reads `../critic/SKILL.md` (project-relative) and attempts inline execution — the *only* skill in this story exercising sibling invocation, and only to gather informational Copilot-support data (non-blocking post #6, where Copilot orchestration is review-time via `review-icea`, not inline sibling invocation).
- **Writes:** none. `icea-status` is read-only reporting, so the Write Gate is never engaged.

---

## Auth & Security

No new concerns beyond the epic-level Governance & Security section of `temp/ADO-4000-tech.md`. This story adds no approval path, no data-egress path, and no model call — it relocates and projects a read-only reporting skill plus a throwaway probe. The one security-relevant property it must preserve: the scratch fixture is **synthetic** (no real privileged/PII/secret material), consistent with the ICEA eval-fixtures assumption, so exercising the skill in Copilot's cloud/`Auto` boundary during the spike cannot leak privileged context.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Relocated SKILL.md still contains a `$PLUGIN_DIR` token | `scripts/spike-project-skill.cjs` grep guard exits non-zero and names the offending file+line; projection is not accepted until the token is removed. |
| Relocated SKILL.md contains a dangling `../` or `references/`-bare reference | Same grep guard trips and reports it; the reference must be rewritten to the project-relative `shared/` path. |
| Single `shared/` directory missing after native placement | Guard verifies `shared/business-context-severity.md` and `shared/personas-spec.md` exist once in each native tree; missing file → non-zero exit with the path. |
| Skill invoked for an ADO ID with no files on disk | Existing skill behaviour preserved on both harnesses: prints `⚠ No files found for ADO #{id}` and stops (Step 2). |
| VS Code below 1.109 (no agent-skills discovery) | Out of scope for this spike (AC-F1 fixes the floor at ≥1.109); the version floor is documented and the run is performed on ≥1.109 only. |
| Sibling-probe does not execute the sibling under Copilot | NOT a spike failure — a recorded **UNPROVEN** result for AC-F2, informational and non-blocking (Copilot orchestration is review-time per #6), carried to Story 2 as non-critical input to D-4. Only an unexpected crash/hang counts as an error; a clean "did not invoke" is a valid, logged outcome. |
| Skill reads its shared dependency but path resolves to project root instead of the `shared/` sibling | Detected by the both-tools run — the `[DL]` persona/severity note would be absent from output; treated as a dangling-reference failure and fixed before the AC passes. |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F1 (relocate to L1 + self-contain) | Copy `icea-status` into the L1 core `Shared/skills/`; place the two shared docs ONCE under `Shared/skills/shared/`; rewrite the two prose `$PLUGIN_DIR` pointers to project-relative `shared/` | 1 |
| AC-F1 (native placement) + AC-F2 (probe author) | Write `scripts/spike-project-skill.cjs` (plain placement, no delta-map); author `spike-sibling-probe`; place into `.claude/skills` and `.github/skills` native paths; grep-guard for residual tokens; verify single `shared/` dir; seed scratch fixture | 1 |
| AC-F1 (both-tools run) + AC-F2 (informational probe run) | Provision scratch repo; run `icea-status` in Claude Code and VS Code Copilot ≥1.109; diff outputs; run the sibling-probe in Copilot and record PROVEN/UNPROVEN; record evidence (D-4 stays open) | 1 |
| **Total** | | **3** |

**Total SP: 3** **Type: STORY** — a single shippable slice delivering one verifiable outcome (one skill self-contained and proven in both tools, plus the informational sibling-invocation probe evidence). It is well within the ≤5-SP rule and does not sub-decompose.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files created/modified as specified in the Files Changed section.
- [ ] `Shared/skills/icea-status/SKILL.md` contains **zero** `$PLUGIN_DIR`, `plugin-path.txt`, `installed_plugins.json`, `../` (except the deliberate sibling-probe read), or bare `references/`/`skills/shared/` tokens.
- [ ] The two shared references live ONCE under `Shared/skills/shared/` (single-source strategy B), NOT copied per-skill, and are read by a project-relative `shared/` path.
- [ ] `spike-sibling-probe` is authored, placed into both harnesses' native paths, and its `../critic/SKILL.md` read is project-relative.
- [ ] No hardcoded secrets, credentials, or absolute machine paths anywhere in the relocated skill or the projection helper.
- [ ] The scratch fixture under `temp/scratch-fixture/` is synthetic (no real privileged/PII/secret data).
- [ ] `scripts/spike-project-skill.cjs` follows the Script Execution Transparency rule (its five points shown to the developer before it is run).

**Quality**
- [ ] All positive and negative test cases pass — see Test Cases section.
- [ ] The both-tools integration test (INT-1) passes: identical `icea-status` behaviour in Claude Code and VS Code Copilot ≥1.109, zero `$PLUGIN_DIR`/dangling-reference failures.
- [ ] The informational sibling-invocation probe (INT-3) has a recorded PROVEN or UNPROVEN result; if UNPROVEN it is written into the D-4 note and the Story-2 input checklist (non-blocking post #6).
- [ ] Regression: the original `skills/icea-status/SKILL.md` is left unchanged and still works on Claude.

**Review readiness**
- [ ] PR title format: `[ADO-4000] Skill self-containment spike — icea-status in both tools`.
- [ ] PR description maps each changed file to AC-F1 / AC-F2 (reference the AC Coverage Matrix).
- [ ] ICEA and this tech spec are committed on the feature branch `feature/4.x-multi-harness`.

### Reviewer Checklist

- [ ] The relocated skill reads **only** project-relative paths — verified by inspecting every Read instruction in `Shared/skills/icea-status/SKILL.md`.
- [ ] The two shared docs appear ONCE under `Shared/skills/shared/` — confirm there is no per-skill `_shared/` duplicate (single-source metric upheld for Story 2).
- [ ] The projection helper's grep guard actually fails on a planted `$PLUGIN_DIR` token (guard is not a no-op) — confirm by a quick tamper check.
- [ ] Both native trees (`.claude/skills`, `.github/skills`) are byte-identical to the `Shared/skills` L1 source, including a single shared `shared/` dir in each.
- [ ] The Overview's honest-scope statement is intact: reviewer confirms the PR does NOT claim D-4 is closed and does NOT claim sibling invocation works unless the probe PROVED it.
- [ ] The both-tools run evidence (two `icea-status` outputs + a diff) and the sibling-probe PROVEN/UNPROVEN record are attached to the PR.
- [ ] No new external dependency, no third-party library, no `.gitignore`/CI change introduced by the spike.

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None blocking. D-4 (native-authoring threshold) is a story-owned Deferred Decision in the epic spec; this spike **cannot** close it (icea-status is a best-case, non-orchestrating skill) and does not attempt to. The informational sibling-invocation probe produces PROVEN/UNPROVEN evidence that is carried into Story 2's D-4 inputs regardless of outcome (non-blocking post #6). | Story 2 owner | Story 2 sizing | Resolved-as-deferred |

> No open question blocks approval. The spike's purpose is to prove native L1 consumption by both
> harnesses + Copilot discovery and to *feed* the D-4 evidence — explicitly not to resolve D-4 for
> orchestrating skills.

---

## Request Flow

Two flows: provisioning (place the L1 content into each harness native path) and the both-tools run.

```
PROVISIONING (spike setup):
  1. Author self-contained L1 content:
       skills/icea-status/  --copy+rewrite-->  Shared/skills/icea-status/   (L1 core)
         - SKILL.md: rewrite the two prose $PLUGIN_DIR/skills/shared/X pointers -> shared/X
                     (project-relative; there is NO executable read and NO plugin-path.txt to strip)
       place the two shared docs ONCE (L1):
         Shared/skills/shared/business-context-severity.md
         Shared/skills/shared/personas-spec.md
       author probe:
         Shared/skills/spike-sibling-probe/SKILL.md  (Read ../critic/SKILL.md + execute inline)
  2. node scripts/spike-project-skill.cjs   (plain placement; NO projection engine / NO delta-map)
       - copy Shared/skills/**  ->  .claude/skills/**   (native Claude path; single shared/ dir once)
       - copy Shared/skills/**  ->  .github/skills/**   (native Copilot path; single shared/ dir once)
       - grep guard: fail if any $PLUGIN_DIR / plugin-path.txt / installed_plugins.json remains
       - verify shared/*.md present once in each native tree
  3. Seed temp/scratch-fixture/docs/.../ADO-9999-spike.icea.md  (synthetic)

BOTH-TOOLS RUN (the AC-F1 proof — L1 consumed natively by both — + informational AC-F2 probe):
  Claude Code:      STATUS ADO-9999
      -> discovers .claude/skills/icea-status  -> reads shared/*  -> find docs   (native consumption)
      -> prints the STATUS report + [DL]/severity note
  VS Code Copilot (>=1.109): invoke icea-status skill on ADO-9999
      -> discovers .github/skills/icea-status  -> reads shared/*  -> find docs   (native consumption)
      -> prints the same STATUS report + [DL]/severity note
  DIFF the two outputs -> must be identical in substance; zero $PLUGIN_DIR/dangling-ref errors.
  Copilot sibling probe (informational, non-blocking post #6):
      -> does Copilot Read ../critic/SKILL.md and execute it inline?
      -> record PROVEN (it ran) or UNPROVEN (it did not / not supported) -> carry to Story 2 / D-4.
```

No network or DB tiers are involved; the skills run in-process in each harness and touch only the project tree.

---

## Rollback

**Schema migrations:** None — this story is code/config only and purely additive to new paths.

**Story-level rollback (git-based):**
1. The story lands as a commit range on `feature/4.x-multi-harness`; the frozen `v3.13.0` tag and untouched `main` remain the Claude-only fallback.
2. Revert the story's commit range (`git revert <range>` or drop the branch commits) to remove `Shared/skills/icea-status/`, `Shared/skills/shared/`, `Shared/skills/spike-sibling-probe/`, `scripts/spike-project-skill.cjs`, and the two projected trees. The original `skills/icea-status/SKILL.md` was never modified, so Claude behaviour returns to 3.x exactly.
3. Delete the throwaway `spike-sibling-probe` and `temp/scratch-fixture/` (both temp/spike-only, not product paths).
4. Verify: original `/icea-status` still runs on Claude via the unmodified `skills/icea-status/` copy.

Nothing in this story is irreversible: no shared per-repo file (e.g. `.vscode/settings.json`) is touched here — that arrives in Story 5.

---

## Handover

### QA Team
**What was added:** one existing read-only skill (`icea-status`) relocated to `Shared/skills/`, made self-contained (no runtime plugin dir; single shared `shared/` dir), projected into both `.claude/skills` and `.github/skills`; plus a throwaway sibling-invocation probe. **How to test manually:** provision the scratch fixture, then invoke `STATUS ADO-9999` in Claude Code and invoke the `icea-status` skill in VS Code Copilot ≥1.109; the two reports must match and neither may raise a `$PLUGIN_DIR`/dangling-reference error. Then invoke the sibling-probe in Copilot and record whether it executed the sibling. **Test data:** synthetic scratch fixture only (`temp/scratch-fixture/`) — no real privileged/PII/secret material. **Regression risk:** low — the original skill copy is untouched; the only risk is the projected copy silently reading the wrong path, which INT-1 catches by diffing outputs.

### DevOps / Platform Team
- No CI pipeline change, no new secret, no new environment variable, no new HTTP client in this story.
- New one-shot helper `scripts/spike-project-skill.cjs` is run manually during the spike; it performs only local file copies and greps — no network calls, no git operations, no registry changes.
- The projected `.claude/skills/` and `.github/skills/` trees are committed on the feature branch; the general provisioning integration (harness selection, manifest) is Story 8, not this story.

### Future Developer — Follow-on Work
- Story 2 establishes the shared **L1 content core** (`Shared/`: ICEA method+templates, rules, B1–B7 taxonomy, checker knowledge, gate) across all 32 skills with the **CI guardrail** (Copilot must not re-author an L1 standard) and the **prompt-version manifest + CHANGELOG + CI bump/hash check** (AC-F9), and removes the old `$PLUGIN_DIR` copies fleet-wide. There is **no projection engine or delta-map** to generalise (both RETIRED in #7) — L2/L3 are authored **natively** per harness on top of the L1 core. Reuse the grep-guard logic from `scripts/spike-project-skill.cjs` as the residual-token check, and reuse the **single `shared/` directory** layout decided here (strategy B) — do NOT introduce per-skill `_shared/` copies.
- **D-4 is NOT closed by this story.** A green `icea-status` run proves only native L1 consumption + Copilot discovery + no-`$PLUGIN_DIR`. D-4 (native-authoring threshold for orchestrating skills) must be decided against Story 2's hard skills — `icea-feature`, `icea-implement`, `migration` — which actually exercise `$PLUGIN_DIR` execution, `scripts/*`, and sibling invocation. Carry the informational sibling-probe PROVEN/UNPROVEN result in as one non-blocking input (post #6 it is not the decisive factor — Copilot orchestration is review-time via `review-icea`).
- To add another spike skill later, copy it into `Shared/skills/<name>/` (L1), point its shared reads at the single `shared/` dir, and re-run the placement helper.

---

## Test Cases

> Derived from AC-F1 (and the informational AC-F2 probe). Positive + negative unit-level checks on the
> relocated L1 source and the placement helper, plus the both-tools integration test which is the key
> AC-F1 proof (L1 consumed natively by both) and the sibling-invocation probe.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `Shared/skills/icea-status/SKILL.md` reference scan | Read the relocated SKILL.md | Every dependency read is a project-relative `shared/…` path; no `$PLUGIN_DIR`, no `../`, no `plugin-path.txt` | AC-F1 |
| P-U2 | `scripts/spike-project-skill.cjs` | Run against clean `Shared/skills/` | Both `.claude/skills/` and `.github/skills/` created byte-identical to source; exit code 0 | AC-F1 |
| P-U3 | Single shared dir presence | Inspect both native trees | `shared/business-context-severity.md` and `shared/personas-spec.md` present ONCE in each tree (no per-skill duplicate) | AC-F1 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `scripts/spike-project-skill.cjs` grep guard | Plant a `$PLUGIN_DIR/skills/shared/X` token in the source SKILL.md, run the helper | Helper exits non-zero and names the offending file+line; projection is rejected | AC-F1 |
| N-U2 | `scripts/spike-project-skill.cjs` grep guard | Plant a dangling `../shared/X` reference (outside the deliberate probe read), run the helper | Helper exits non-zero and reports the dangling reference | AC-F1 |
| N-U3 | Missing shared dependency | Delete `shared/personas-spec.md` from source, run the helper | Helper's presence check fails with the missing path; no partial projection accepted | AC-F1 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 (key) | The relocated skill runs in BOTH tools | 1) provision scratch fixture; 2) in Claude Code run `STATUS ADO-9999`; 3) in VS Code Copilot ≥1.109 invoke the `icea-status` skill on ADO-9999; 4) diff the two outputs | Both produce the same STATUS report (files-on-disk, AC progress, next action) including the `[DL]`/severity note read from the single `shared/` dir; **zero** `$PLUGIN_DIR`/dangling-reference errors on either harness | AC-F1 |
| INT-2 | Empty-ADO behaviour parity | Invoke the skill for an ADO ID with no files on disk, on each harness | Both print `⚠ No files found for ADO #{id}` and stop — identical behaviour | AC-F1 |
| INT-3 | Copilot sibling-invocation probe (informational) | In VS Code Copilot ≥1.109 invoke `spike-sibling-probe`, which Reads `../critic/SKILL.md` and attempts inline execution | Record **PROVEN** (the sibling actually ran) or **UNPROVEN** (Copilot did not invoke it / not supported). UNPROVEN is a valid recorded result, NOT a failure — carried to Story 2 as a non-blocking D-4 input (post #6, Copilot orchestration is review-time via `review-icea`) | AC-F2 (informational evidence only) |

> NF verification: AC-F1's "zero `$PLUGIN_DIR`/dangling-relative-reference failures" is verified by (a)
> the static grep guard in `scripts/spike-project-skill.cjs` (N-U1/N-U2) and (b) the observed both-tools
> run (INT-1) producing complete, identical reports — an absent shared-dependency note would signal a
> silent dangling-reference failure and fail the AC. AC-F2 here is an *informational probe*, not a
> pass/fail AC for this story: INT-3 must produce a recorded verdict, and an UNPROVEN verdict still
> satisfies the story's obligation (feed D-4 as non-blocking input), it does not block the story.

---

### Revision Log
2026-08-13 — Story 1 tech spec drafted from the saved ICEA and the epic tech spec (dogfood; synthetic
ADO-4000). Scoped to AC-F1 only.
2026-08-13 (rev to match ICEA #4) — Applied post-adversarial-review fixes: (1) EVIDENCE re-scoped —
`icea-status` has only prose `$PLUGIN_DIR` pointers, no executable read and no `plugin-path.txt`
resolver, so the spike proves ONLY projection mechanics + Copilot discovery and explicitly CANNOT close
D-4 for orchestrating skills (D-4 gated on Story 2's harder skills). (2) Added an explicit Copilot
sibling-skill-invocation probe (`spike-sibling-probe` → Read+execute `critic`) with PROVEN/UNPROVEN
recording carried to Story 2 as a D-4 gating check — addresses the ICEA's top pre-mortem risk. (3)
Chose the shared-dependency strategy now: a SINGLE projected `shared/` directory (strategy B), NOT
per-skill `_shared/` copies, upholding the ICEA "1 source of truth per artifact" metric across all 32
Story-2 skills; Overview + Files Changed + tests updated accordingly. Generic terms only (no
organization/company name).
2026-08-14 (rev to match ICEA #8) — Re-revised to the current ICEA design (Revision Logs #6/#7/#8).
Source-ICEA pointer moved to #8; status re-dated. (1) STRUCTURE (#7): the spike is now framed inside the
locked L1/L2/L3 model — it proves (a) an L1 content item is CONSUMED natively by BOTH harnesses (no
mechanical projection) and (b) a dual-run with no `$PLUGIN_DIR`. The delta-map / projection engine
framing is RETIRED throughout; `scripts/spike-project-skill.cjs` is described as a plain native-placement
copy, not a projection engine, and Story-2 follow-on is re-described as establishing the shared L1 core +
CI guardrail + prompt-version manifest (AC-F9), not generalising a projection engine. (2) ENFORCEMENT
(#6): the Copilot sibling-invocation probe is downgraded from a governance-critical gating check to an
INFORMATIONAL, non-blocking probe — Copilot orchestration is review-time via the GA `review-icea`
code-review skill (no inline sibling invocation), so the probe outcome no longer decides whether Copilot
is governed; it feeds D-4 as one non-blocking input. (3) Marked this as the FIRST implementation story
(the spike) under the approved plan. Kept unchanged: the single-`shared/` (strategy B) decision and the
sibling-invocation probe itself. Generic terms only (no organization/company name).
