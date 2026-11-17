# Tech Spec — Story 3: Refresh and rollout
ADO #8001 · Story 3 of 3 · Release 3 · Sprint 14
Status: DRAFT · 3 SP · Depends on: Story 2

---

## Overview

This story finishes the release in three parts:
1. **`/arch-diagram --refresh`.** It re-runs Story 2's evidence collection and drafting, diffs the new draft against the saved spec, keeps every entry the developer marked `# manual`, and writes only after approval.
2. **Housekeeping.**
   - `ARCH DIAGRAM` / `ARCH DIAGRAM --refresh` keywords in the deployed `_project-deploy/CLAUDE.md` §0a
   - a 3.27.0 CHANGELOG entry
   - the version bump via `scripts/bump-version.sh 3.27.0`
3. **Verification runs (AC-NF1).** On repositories that already have a hand-made diagram, the run must reproduce its zones, components and flows. The repositories are chosen through the epic's ❓[1] before this story's verification step.

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F10 | `--refresh`: diff vs saved spec, keep every `# manual` entry, write only after approval | `skills/arch-diagram/SKILL.md` § Refresh (Steps F1–F5), `skills/arch-diagram/references/spec-format.md` § `# manual`, `tests/skill-scenarios/arch-diagram.yaml` | ✅ Covered |
| AC-F11 | Keywords in `_project-deploy/CLAUDE.md` §0a; CHANGELOG 3.27.0; version 3.27.0 everywhere `check-version-consistency.js` looks | `_project-deploy/CLAUDE.md`, `CLAUDE.md` (`# Plugin version` line only, written by `bump-version.js`), `CHANGELOG.md`, `.claude-plugin/plugin.json` + display copies (via `bump-version.sh`) | ✅ Covered |
| AC-NF1 | Verification repo with a hand-made diagram reproduced (zones, components, flows) | `docs/Release3/Sprint14/UserStory8001/ADO-8001-arch-diagram.tracker.md` (verification record) | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/arch-diagram/SKILL.md` (delta) | AC-F10 |
| `skills/arch-diagram/references/spec-format.md` (delta) | AC-F10 |
| `tests/skill-scenarios/arch-diagram.yaml` (delta) | AC-F10 |
| `_project-deploy/CLAUDE.md` | AC-F11 |
| `CLAUDE.md` (plugin root — `# Plugin version` line only, via `bump-version.js`) | AC-F11 |
| `CHANGELOG.md` | AC-F11 |
| `.claude-plugin/plugin.json`, `README.md` version header, HTML guide header (written by `bump-version.js`) | AC-F11 |
| `docs/Release3/Sprint14/UserStory8001/ADO-8001-arch-diagram.tracker.md` | AC-NF1 |

**Coverage result:** all 3 Story 3 ACs covered, no orphaned file changes ✅

---

## DO NOT rules (apply to every file in this spec)

- DO NOT overwrite, reorder or reformat any item whose first line carries `# manual`. Copy it byte for byte into the refreshed spec.
- DO NOT write the refreshed spec or PNG before approval. The diff is the review artefact.
- DO NOT hand-edit version strings. Use `scripts/bump-version.sh 3.27.0` only, then `node scripts/check-version-consistency.js`.
- DO NOT name the verification repositories, or copy anything from them, in plugin files. Results go in the tracker as counts plus a pass/fail per zone, component and flow, with no hostnames.
- DO NOT change `.gitignore`, CI/CD or auth policy files.

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 1 | `skills/arch-diagram/SKILL.md` | Skill (delta) | Add § Refresh (Steps F1–F5); add `--refresh` to the frontmatter triggers |
| 2 | `skills/arch-diagram/references/spec-format.md` | Skill ref (delta) | Add § `# manual`: where the marker goes, what it protects (the whole item block, children included), and how the diff shows it |
| 3 | `tests/skill-scenarios/arch-diagram.yaml` | Test (delta) | Refresh scenarios: `# manual` kept; added / removed / changed items shown; nothing written before approval; no saved spec → "run `/arch-diagram` first" |
| 4 | `_project-deploy/CLAUDE.md` | Docs | §0a rows: `ARCH DIAGRAM` → run arch-diagram skill; `ARCH DIAGRAM --refresh` → refresh mode |
| 5 | `CLAUDE.md` | Docs | `# Plugin version: 3.27.0`, written by `bump-version.js`. No keyword rows: the ICEA names only `_project-deploy/CLAUDE.md` |
| 6 | `CHANGELOG.md` | Docs | `## 3.27.0` entry: new `/arch-diagram` skill, renderer, scanner, Python prerequisite |
| 7 | `.claude-plugin/plugin.json` (+ display copies) | Config | `version: 3.27.0` via `scripts/bump-version.sh 3.27.0` |
| 8 | `docs/Release3/Sprint14/UserStory8001/ADO-8001-arch-diagram.tracker.md` | Governance | AC-NF1 verification record per repository (hosting model, counts, side-by-side result) |

### AC Traceability

See the AC Coverage Matrix. The refresh step headings carry `(AC-F10)`.

---

## Skill — § Refresh (Steps F1–F5)

| Step | What it does | AC |
|---|---|---|
| F1 | Locate `docs/architecture/diagram/*.arch.yaml`. If none: "No saved spec — run `/arch-diagram` first" and stop. If more than one: list them and ask which | AC-F10 |
| F2 | Parse the saved spec text: collect `# manual` item blocks keyed by `id` (flows by `from→to`) | AC-F10 |
| F3 | Run Story 2 Steps 2–6 to build a fresh draft. Replace each matching item with its saved `# manual` block. Append `# manual` items with no match at their original zone position. Pipe the refreshed draft to `arch-spec-scan --stdin --secrets --hosts --sources`. Nothing touches disk before approval | AC-F10, (AC-F6, AC-F7 reused) |
| F4 | Show the diff grouped as **Added** / **Removed** / **Changed** (evidence-backed items), then **Kept (manual)**, then the TODO summary and host table. Write Gate prompt | AC-F10 |
| F5 | On approval: overwrite the spec, re-render with `--check`, show the PNG. Story 2 Step 10 applies (one revision) | AC-F10 |

The diff is computed by the LLM from the two texts in context, item by item on `id` / `from→to`. No diff script is added, because the specs are small (tens of items). If a saved spec has an item without `id`, it is matched on `name` and the match is reported.

---

## Domain Exceptions — app/exceptions.py
Not applicable. No FastAPI application.

## Dependency Wiring — app/dependencies.py
Not applicable.

## FastAPI Router — app/routers/{feature}.py
Not applicable. No endpoints.

## Pydantic Schemas — app/schemas/{feature}_schema.py
Not applicable.

## Service Layer — app/services/{feature}_service.py
Not applicable.

## Repository Layer — app/repositories/{feature}_repository.py
Not applicable. No persistence.

---

## API Changes

No HTTP API. New keyword triggers only (`ARCH DIAGRAM`, `ARCH DIAGRAM --refresh`).

### DB / persistence changes

No DB changes in this story.

---

## Auth & Security

| Location | Concern | Mitigation |
|---|---|---|
| Refresh F3 | A `# manual` block containing a secret is carried forward unscanned | The refreshed draft, manual blocks included, goes through `--secrets` before F4; a match blocks the save |
| Verification record | Real repository details in plugin docs | Tracker records counts and pass/fail only, plus repository folder name as written by the developer; no hostnames |
| Version bump | Hook re-sync side effects | `bump-version.sh` re-syncs `.claude/hooks/` from `_project-deploy/hooks/` (ADR 0009). Expected; reviewed in the PR diff |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No saved spec on `--refresh` | "No saved spec — run `/arch-diagram` first"; stop |
| Several saved specs | List them; ask which |
| `# manual` item references an id that no longer exists | Kept; shown under **Kept (manual)** with `⚠ references missing id {x}`; `--check` / renderer reports a dangling flow as `spec error:` → Story 2 Step 10 path |
| Developer SKIPs the refresh | Saved spec and PNG untouched |
| `check-version-consistency.js` fails | Fix the reported copy with `bump-version.sh`; never hand-edit |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F10 | Refresh steps, `# manual` doc, scenarios | 1.5 |
| AC-F11 | Keywords, CHANGELOG, bump | 0.5 |
| AC-NF1 | Verification runs + record | 1 |
| **Total** | | **3** |

**Type: STORY slice of EPIC ADO-8001.**

---

## Definition of Done

**Implementation**
- [ ] Refresh steps F1–F5 in SKILL.md; `# manual` section in spec-format.md
- [ ] `_project-deploy/CLAUDE.md` §0a has the two keyword rows
- [ ] `node scripts/check-version-consistency.js` passes at 3.27.0
- [ ] CHANGELOG 3.27.0 entry present

**Quality**
- [ ] `npm test` green (AC-F13 allow-list still green)
- [ ] Refresh scenario: the `# manual` item is byte-identical after refresh
- [ ] AC-NF1: at least one verification repository per hosting model the developer chose in ❓[1] reproduced; result recorded in the tracker

**Review readiness**
- [ ] PR title: `[ADO-8001] /arch-diagram — Story 3: refresh mode and 3.27.0 release`
- [ ] PR maps files to ACs

### Reviewer Checklist

**Integrity:**
- [ ] `# manual` blocks are copied verbatim (scenario asserts it)
- [ ] Manual blocks are secret-scanned with the rest of the draft

**Release:**
- [ ] Version changed only via `bump-version.sh`; consistency check green
- [ ] Hook re-sync diff from `bump-version.sh` contains only expected files

**AC coverage:**
- [ ] AC-NF1 record lists each zone, component and flow of the hand-made diagram with ✅ / ❌

**Regression:**
- [ ] Plain `/arch-diagram` and `--spec` modes unchanged

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| ❓[1] | Which real repositories verify the Azure, IIS and Docker / Node.js models (AC-NF1)? | Vivek Rawat | 2026-11-13 | **Answered by the developer (2026-11-13):** verify on the target project the skill runs in, plus the projects listed in the session's `additionalDirectories`. Repository names are recorded in the tracker's verification record only, never in plugin files. A hosting model with no matching repository in that set is verified on the Story 2 fixtures and marked as such |

---

## Request Flow

```
/arch-diagram --refresh   (or ARCH DIAGRAM --refresh)
 → Step 1 deps
 → F1 find saved spec ── none → stop
 → F2 collect # manual blocks
 → F3 Story 2 Steps 2–6 → fresh draft → splice manual blocks → arch-spec-scan --stdin
 → F4 diff: Added / Removed / Changed / Kept (manual) + TODO + hosts → Write Gate
        ├─ SKIP → untouched
        └─ APPROVE
 → F5 write spec → render --check → show PNG → (Step 10 one revision)
```

---

## Rollback

- **Refresh:** revert the Story 3 commit(s). Saved specs keep working with Story 2, which treats `# manual` as a plain comment.
- **Version:** revert the version commit and re-run `check-version-consistency.js`.

---

## Handover

### QA Team
1. Generate a spec on the Docker fixture.
2. Mark one component `# manual` and change its details.
3. Add a service to `docker-compose.yml`.
4. Run `/arch-diagram --refresh`.

Expected:
- the new service appears under **Added**
- the manual item appears under **Kept (manual)**, unchanged
- nothing is written before approval

Then run `ARCH DIAGRAM` as a plain keyword and confirm it triggers the skill.

### DevOps / Platform Team
Plugin release 3.27.0. Target projects pick up the keyword rows through the normal `setup-sync` / `REFRESH RULES` flow. There is no pipeline change.

### Future Developer — after release
The application where the renderer started removes its local copy (`docs/images/src/architecture-diagram.py` and its `examples/`) under its own ADO-90 and switches to `/arch-diagram --spec` or a generated spec.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | refresh scenario | saved spec + one `# manual` component | manual block byte-identical in the new draft; listed under Kept (manual) | AC-F10 |
| P-U2 | refresh scenario | new compose service added | shown under Added with `# source:` | AC-F10 |
| P-U3 | refresh scenario | APPROVE | spec overwritten; PNG re-rendered; `check: ok` | AC-F10 |
| P-U4 | keyword | `ARCH DIAGRAM` / `ARCH DIAGRAM --refresh` | skill triggered in generate / refresh mode | AC-F11 |
| P-U5 | `check-version-consistency.js` | after bump | exit 0 at 3.27.0 | AC-F11 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | refresh scenario | no saved spec | "No saved spec — run `/arch-diagram` first"; nothing written | AC-F10 |
| N-U2 | refresh scenario | draft shown, SKIP | saved spec and PNG unchanged (hash equal) | AC-F10 |
| N-U3 | refresh scenario | `# manual` block containing a fake password | `❌ BLOCKED — secret pattern … line N`; nothing written | AC-F10 |
| N-U4 | `check-version-consistency.js` | `CLAUDE.md` left at 3.26.0 | exit 1 naming the file | AC-F11 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | Verification — hand-made diagram | In each chosen repository: `/arch-diagram`, approve, then put the PNG next to the existing diagram | every zone, component and flow of the hand-made diagram present (✅ per row in the tracker); extras are cited or `⚠ TODO` | AC-NF1 |
| INT-2 | Release | `bump-version.sh 3.27.0`; `npm test`; consistency check | all green | AC-F11 |

> NF AC verification:
> AC-NF1 (reproduces a hand-made diagram): verified by INT-1 as a side-by-side review recorded in the tracker, one table per repository: item · in hand-made · in generated · ✅/❌.

---

### Revision Log
2026-11-13 — Critic pass 2 notes: F3 scan uses `--stdin`.

2026-11-13 — Critic revision 1: plugin-root `CLAUDE.md` keyword rows dropped (not in the ICEA); ❓[1] recorded as resolved by process.

2026-11-13 — Story 3 spec drafted. Fixtures moved to Story 2 (AC-F5 needs them); this story keeps refresh, rollout and verification.
