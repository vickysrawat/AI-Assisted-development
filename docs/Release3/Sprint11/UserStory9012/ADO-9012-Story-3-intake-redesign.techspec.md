# Tech Spec — Story 3: Intake Redesign
ADO #9012 · Story 3 of 5 · Release 3 · Sprint 11
Status: DRAFT
Depends on: Story 1 (gate structure must be in place)

---

## Overview

Replaces the hand-authored `source-context-manifest.md` with a skill-generated
`docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md`, auto-produced by a 3-pass
detection sequence inside `skills/upgrade/SKILL.md`. Pass 1 queries the live package
registry once per dependency for compatibility status. Pass 2 scans the migration knowledge
cache for SDK renames and replacement mappings. Pass 3 greps the codebase against behavioral
change patterns from the knowledge cache. The intake document has exactly 12 sections
(0–11); every section renders with findings or a documented "Not applicable — evidence: X";
a summary banner at the top shows blocker/warning/compatible/not-applicable counts.
Each package finding is appended immediately to the intake file (incremental write).
The checkpoint ledger records `intake_pass` and `intake_progress_index` before each query
so that UPGRADE RESUME can skip already-processed packages.

Only `skills/upgrade/SKILL.md` is modified. No scripts changed by this story.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F8 | Skill generates upgrade-intake.md automatically; developer confirms with INTAKE CONFIRMED | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F9 | 12 sections (0–11) all present; every section renders with findings or not-applicable evidence | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F10 | Summary banner at top: blocker count, migration-required, behavioral change, compatible, not-applicable counts | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F11 | DEVELOPER REVIEW label includes reason code: registry timeout / no compatible version / registry unavailable | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F12 | Intake file written incrementally — each package appended immediately after its query | skills/upgrade/SKILL.md | ✅ Covered |
| AC-F13 | Checkpoint ledger records intake_pass and intake_progress_index before each query; UPGRADE RESUME reads and skips | skills/upgrade/SKILL.md | ✅ Covered |
| AC-NF1 | Context budget check fires before Pass 1; COMPACT path offered if near capacity | skills/upgrade/SKILL.md | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| skills/upgrade/SKILL.md | AC-F8, AC-F9, AC-F10, AC-F11, AC-F12, AC-F13, AC-NF1 |

**Coverage result:** All 7 ACs covered. No orphaned file changes. ✅

---

## Files Changed

### `skills/upgrade/SKILL.md` — Modify (intake generation section)

**New Step 3 — Intake Generation:**

The existing Step 3 (or whichever step follows tool preflight) is replaced with the
3-pass intake generation sequence:

#### Context budget check (AC-NF1)

Before starting Pass 1, check context budget:
```
Estimate context usage for Pass 1 (N packages × ~200 tokens per query result).
If context is near capacity:
  → Offer developer: COMPACT path
  → Recovery command: UPGRADE RESUME ADO-<ADO-ID>
  → Do NOT start Pass 1 until developer confirms or context is compact
```
This ensures compaction does not interrupt a partially-written pass.

#### Create intake file

```
Create docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md
  with header: ADO ID, stack, source version, target version, date, status: GENERATING
  and 12 empty section stubs (## Section 0 through ## Section 11)
```

This file is a migration artefact (exempt from the Write Gate).

#### The 12 sections (AC-F9)

| Section | Title | What it covers |
|---|---|---|
| 0 | Baseline and target | Source version, target version, stack, detected package manager |
| 1 | Upgrade path | Supported hop (direct/sequential), breaking hops identified |
| 2 | Version coupling | Co-version constraints (framework packages that must bump together) |
| 3 | Deprecated API removals | APIs removed in target version; grep patterns used |
| 4 | Breaking behaviour changes | Default behaviour changes that affect runtime without code change |
| 5 | Package compatibility | Per-package compatibility status (Pass 1 output) |
| 6 | SDK renames and merges | Package renames, namespace changes, SDK consolidations (Pass 2) |
| 7 | Security advisories | Known CVEs fixed or introduced in target version |
| 8 | Build and tooling | Required CLI version changes, project file format changes |
| 9 | Test framework compatibility | Test SDK version changes, runner compatibility |
| 10 | Configuration changes | appsettings / config key renames, new required keys |
| 11 | Platform constraints | OS/runtime/container image constraints for target version |

Each section renders with findings or `Not applicable — evidence: <detection result or knowledge file statement>`. No section is silently skipped.

#### Pass 1 — Live registry query (AC-F12, AC-F13)

For each package in the project's dependency manifest:
1. Write to checkpoint ledger: `intake_pass=1`, `intake_progress_index=<i>` (before the query)
2. Query the package registry for the package's compatibility with the target version
3. Classify result as one of:
   - ✅ COMPATIBLE
   - ⛔ BLOCKER (no compatible version exists)
   - ⚠ MIGRATION REQUIRED (compatible version requires code changes)
   - ⚠ BEHAVIORAL CHANGE (compatible version has behavioural differences)
   - DEVELOPER REVIEW (reason code: `registry timeout` / `no compatible version found` / `registry unavailable`)
4. Immediately append the result to Section 5 of upgrade-intake.md (AC-F12)

**DEVELOPER REVIEW reason codes (AC-F11):**
- `(registry timeout)` — query timed out; developer should check manually
- `(no compatible version found)` — registry responded but no version satisfies target constraint
- `(registry unavailable)` — all registry queries failing; Pass 1 continues for remaining packages; header notes count

If all Pass 1 registry calls fail:
```
Section 5 header: "Registry unreachable — compatibility check skipped. All packages labeled
DEVELOPER REVIEW (registry unavailable). Passes 2 and 3 still run."
```

**UPGRADE RESUME resumability (AC-F13):**
On UPGRADE RESUME, the skill reads `intake_pass` and `intake_progress_index` from the
checkpoint ledger, reads the existing intake file, and skips already-processed packages
(indices < `intake_progress_index`). Processing resumes from the next unprocessed package.

#### Pass 2 — Knowledge cache replacement mapping

Read `skills/shared/migration-knowledge/refs/mappings/<stack>-upgrade.md` for the target
version hop. Extract replacement mappings (SDK renames, namespace changes, merged packages).
Write results to Sections 6, 8, 10 as applicable.
Write to checkpoint ledger: `intake_pass=2`.

If the per-stack knowledge file does not exist for this stack: write to the relevant sections
`Not applicable — evidence: no per-stack knowledge file for <stack> (follow-up F-1 work).`

#### Pass 3 — Codebase grep

For each behavioral change pattern in the per-stack knowledge file (Pass 3 patterns):
- Grep the codebase for the pattern
- If found: append finding to Section 4 with file locations and required action
- If not found: pattern not detected (not-applicable evidence)

Write to checkpoint ledger: `intake_pass=3`.
Write findings to Sections 3, 4, 7 as applicable.

#### Summary banner (AC-F10)

After all 3 passes complete, prepend the summary banner to upgrade-intake.md:
```
## Summary
⛔ N blockers · ⚠ N migration required · ⚠ N behavioral changes · ✅ N compatible
· N sections not applicable
Status: READY FOR REVIEW
```

#### Gate: INTAKE CONFIRMED (AC-F8)

Display:
```
📋 upgrade-intake.md generated — open in VS Code (Ctrl+Shift+V):
   docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md

   Summary: ⛔ N blockers · ⚠ N migration required · ⚠ N behavioral changes
            · ✅ N compatible · N sections not applicable

   Confirming means: baseline correct · statuses correct · not-applicable evidence holds.

   INTAKE CONFIRMED ADO-<ADO-ID>
```

The INTAKE CONFIRMED gate is hook-enforced (Story 1, AC-F1). Skill stops until keyword received.

#### upgrade-checkpoint.cjs intake verification

After INTAKE CONFIRMED, invoke:
```bash
node scripts/upgrade-checkpoint.cjs intake-verify --ado=<ADO-ID>
```
This verifies the intake_pass=3 is recorded in the ledger before allowing the skill to proceed.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Registry unavailable during Pass 1 | All packages labeled DEVELOPER REVIEW (registry unavailable); section 5 header notes count; Passes 2 and 3 still run |
| Registry timeout for one package | Package labeled DEVELOPER REVIEW (registry timeout); Pass 1 continues for remaining packages |
| Context near capacity before Pass 1 | Developer offered COMPACT path with UPGRADE RESUME recovery command; Pass 1 does not start until confirmed |
| Session compacted mid-Pass 1 (e.g. package 20 of 50) | UPGRADE RESUME reads intake_progress_index (20); skips first 20 packages; continues from 21 |
| Intake file already exists (re-run) | Skill reads existing file; reads intake_progress_index from ledger; resumes from last recorded package; does not restart |
| Per-stack knowledge file missing (Pass 2/3) | Sections note "Not applicable — evidence: no per-stack knowledge file for <stack>"; passes complete with this note |
| INTAKE CONFIRMED sent before intake file exists | upgrade-checkpoint.cjs intake-verify exits non-zero; skill reports: "Intake not recorded — generate intake first (Pass 1-3 must complete)" |

---

## Request Flow

```
Step 3: 3-pass intake generation

  [Context budget check] → near capacity? offer COMPACT → wait → proceed

  Create upgrade-intake.md (12 section stubs)

  Pass 1 (registry):
    for each package i in manifest:
      write intake_pass=1, intake_progress_index=i to ledger
      query registry → classify → append to Section 5

  [All Pass 1 queries done or registry unavailable]

  Pass 2 (knowledge cache):
    read <stack>-upgrade.md → write to Sections 6, 8, 10
    write intake_pass=2 to ledger

  Pass 3 (grep):
    for each behavioral change pattern:
      grep codebase → write to Sections 3, 4, 7
    write intake_pass=3 to ledger

  Prepend summary banner to upgrade-intake.md

  Display INTAKE CONFIRMED gate prompt → STOP

  [INTAKE CONFIRMED received (hook-enforced)]

  node upgrade-checkpoint.cjs intake-verify

  → Continue to Step 4
```

---

## Rollback

Revert `skills/upgrade/SKILL.md`. The intake generation section is fully self-contained —
no script changes. Rollback does not affect any generated migration documents on disk
(upgrade-intake.md is a migration artefact; it can be deleted manually if needed).

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-NF1 | Context budget check before Pass 1 | 1 |
| AC-F8, AC-F12 | 3-pass intake structure; incremental write per package | 2 |
| AC-F9 | 12 sections always rendered; not-applicable evidence; per-section routing from pass results | 2 |
| AC-F10 | Summary banner computation and prepend | 1 |
| AC-F11 | DEVELOPER REVIEW reason codes (3 variants) | 1 |
| AC-F13 | Checkpoint ledger integration (intake_pass + intake_progress_index); UPGRADE RESUME skip logic | 1 |
| **Total** | | **8** |

**Total SP: 8**
**Type: STORY** — single SKILL.md change; no child ADOs.

---

## Handover

### QA Team

**What was added:**
- upgrade-intake.md generated automatically (3-pass: registry, cache, grep)
- 12 sections always present; summary banner at top
- DEVELOPER REVIEW labels include reason code
- Incremental write; resume support via intake_progress_index

**How to verify:**
1. Run upgrade skill on a project with known dependencies
2. Verify `docs/migrations/<ADO-ID>/ADO-<ADO-ID>-upgrade-intake.md` exists and has all 12 sections
3. Verify summary banner shows ⛔/⚠/✅ counts
4. Simulate registry timeout: set an unreachable registry URL → confirm DEVELOPER REVIEW (registry timeout) label
5. Simulate compaction: manually set intake_progress_index in ledger to 5; run UPGRADE RESUME; confirm first 5 packages are skipped

**Regression risk:** source-context-manifest.md is no longer required — confirm no other
upgrade step references it.

### DevOps / Platform Team

No infrastructure changes.

### Future Developer

To add a new intake section (beyond 12):
1. Add Section N definition to the relevant per-stack knowledge file
2. Add routing logic in the SKILL.md Pass 2/3 section to write findings to Section N
3. Update the summary banner count if the new section uses ⛔/⚠/✅ labels

To add registry support for a new stack:
1. Create `skills/shared/migration-knowledge/refs/mappings/<stack>-upgrade.md`
2. Add registry endpoint pattern under `# Registry` heading in that file
3. No SKILL.md changes needed — the intake generation reads the file by stack name

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | upgrade-intake.md section count | Run upgrade skill end-to-end | File has exactly 12 `## Section` headings | AC-F9 |
| P-U2 | upgrade-intake.md summary banner | Run with 2 blockers, 3 compat | Banner shows ⛔ 2 · ✅ 3 and correct totals | AC-F10 |
| P-U3 | DEVELOPER REVIEW label | Package times out | Label includes `(registry timeout)` reason | AC-F11 |
| P-U4 | Incremental write | Pause skill mid-Pass 1 (manual inspect) | intake.md has partial results appended; no empty file | AC-F12 |
| P-U5 | Checkpoint ledger | Inspect ledger during Pass 1 | intake_pass=1 and intake_progress_index=<i> present | AC-F13 |
| P-U6 | UPGRADE RESUME | Set intake_progress_index=10; run UPGRADE RESUME | First 10 packages skipped; processing resumes from 11 | AC-F13 |
| P-U7 | Context budget check | Invoke with near-capacity context signal | COMPACT path offered; Pass 1 does not start | AC-NF1 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | Registry unavailable | All registry calls fail | All packages DEVELOPER REVIEW (registry unavailable); Section 5 header note; Passes 2+3 still run | AC-F11 |
| N-U2 | Missing per-stack knowledge file | Pass 2 with no <stack>-upgrade.md | Affected sections note "Not applicable — evidence: no per-stack knowledge file"; no crash | AC-F9 |
| N-U3 | INTAKE CONFIRMED prematurely | Send keyword before intake file exists | upgrade-checkpoint.cjs exits non-zero; skill reports intake not recorded | AC-F8 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Full 3-pass intake | Run upgrade on Node.js project with 20 packages | upgrade-intake.md has all 12 sections, summary banner, all packages classified | AC-F8, AC-F9, AC-F10 |
| INT-2 | Resume after simulated compaction | Set intake_progress_index=5; UPGRADE RESUME | Packages 0-4 skipped; packages 5+ processed correctly | AC-F13 |

> AC-NF1 verification: Monitor context token usage during a test run with a large project (~50 packages); confirm context budget check fires and COMPACT path is offered before Pass 1 starts when near capacity.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] `skills/upgrade/SKILL.md` modified: 3-pass intake generation section added
- [ ] Context budget check fires before Pass 1; COMPACT path offered if near capacity
- [ ] upgrade-intake.md created with all 12 sections (0–11) on every run
- [ ] Each package result appended immediately after its query (incremental write)
- [ ] DEVELOPER REVIEW label includes reason code for all 3 variants
- [ ] Summary banner prepended after all 3 passes complete
- [ ] `intake_pass` and `intake_progress_index` written to checkpoint ledger before each query
- [ ] UPGRADE RESUME reads ledger values and skips already-processed packages
- [ ] `upgrade-checkpoint.cjs intake-verify` called after INTAKE CONFIRMED

**Quality**
- [ ] upgrade-intake.md has exactly 12 `## Section` headings
- [ ] Summary banner shows correct ⛔/⚠/✅ counts
- [ ] DEVELOPER REVIEW (registry timeout) label confirmed with simulated timeout
- [ ] DEVELOPER REVIEW (registry unavailable) label confirmed when all registry calls fail
- [ ] UPGRADE RESUME skips correctly after intake_progress_index=N is set in ledger
- [ ] No section silently skipped (every section renders with findings or not-applicable evidence)

**Review readiness**
- [ ] PR title: `[ADO-9012] Intake Redesign — 3-pass auto-generation, 12 sections, incremental write`
- [ ] PR description maps the SKILL.md changes to ACs (AC-F8 through AC-F13, AC-NF1)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

- [ ] Confirm intake file is created before Pass 1 starts (not after)
- [ ] Confirm intake_progress_index is written BEFORE each query (not after)
- [ ] Confirm all 3 DEVELOPER REVIEW reason codes are distinct and actionable
- [ ] Confirm the INTAKE CONFIRMED gate is hook-enforced (not just keyword-checked in SKILL.md)
- [ ] Confirm context budget check is a hard gate (not informational only)

---

## Open Questions

None.

---

## Revision Log

2026-10-03 — Story 3 tech spec drafted. Added Definition of Done (critic REVISE → auto-revised).
