# Epic Tech Spec — /arch-diagram: Architecture / Recovery Diagram Generated from the Codebase
ADO #8001 · Release 3 · Sprint 14
Status: DRAFT · EPIC · 13 SP total

---

## Overview

This epic adds `/arch-diagram`, a skill that draws an application's architecture and recovery diagram from that application's own repository.
- The skill reads `.claude/architecture/*.md` and the deployment files the evidence map names.
- It drafts a YAML spec in which every zone, component and flow cites a file (`# source: path[:line]`) or is marked `⚠ TODO`.
- It secret-scans the draft, lists hostnames and IPs, shows the draft, and only after approval writes the spec and renders a PNG.

Three components:
1. **The generic renderer** (from ADO-90), moved to `scripts/architecture-diagram.py`. It gains hosting presets, a `--check` mode and an "unverified" style for D-1 Option A.
2. **`scripts/arch-spec-scan.cjs`**, a deterministic scanner for secrets and hostnames/IPs in the draft spec.
3. **The skill itself.** It is an LLM procedure: the LLM reads evidence; scripts draw and check.

The governing pattern is the same as `operations`: derived from evidence only, unknowns shown as `⚠ TODO`, never invented.

**Out of scope:**
- no manifest or IaC parsing in code
- no SVG, draw.io or Visio output
- no changes to `architect`, `operations` or `go-live`
- no edits to Word or PDF documents
- no changes to consuming application repositories

Nothing in the plugin names a real application: identity comes from the target repository at run time.

---

## Story Breakdown

All implementation detail (AC Coverage Matrix, Files Changed, Test Cases) lives in each story's tech spec.

| Story | Title | SP | Shippable alone? | Depends on | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Renderer, scanner and skill scaffold (shared foundation) | 4 | Yes — `/arch-diagram --spec <file>` renders a hand-written spec | None | [ADO-8001-Story-1-renderer.techspec.md](ADO-8001-Story-1-renderer.techspec.md) | ⏳ Pending |
| 2 | Spec generation (`/arch-diagram`) | 6 | Yes — produces reviewed diagrams | Story 1 | [ADO-8001-Story-2-spec-generation.techspec.md](ADO-8001-Story-2-spec-generation.techspec.md) | ⏳ Pending |
| 3 | Refresh and rollout | 3 | Yes — release complete | Story 2 | [ADO-8001-Story-3-refresh-rollout.techspec.md](ADO-8001-Story-3-refresh-rollout.techspec.md) | ⏳ Pending |

> Story 1 owns the shared contracts later stories depend on:
> - the spec format (keys and `todo: true`)
> - the renderer CLI: `<spec> <png> [--dpi N] [--check]`, exit codes 0 ok · 1 spec error or check problems · 2 usage
> - `scripts/arch-spec-scan.cjs`, both its `--secrets` and `--hosts` modes. The AC-F13 allow-list test in Story 1 uses the host extraction
> - the skill scaffold
>
> `scripts/new-skill.sh` refuses to run when `skills/arch-diagram/` already exists, and Story 1's examples live in that folder. So Story 1 runs the scaffold and ships a minimal skill: dependency check, then render and check of a hand-written spec.
>
> There is no database schema in this epic.
>
> **Re-split from the ICEA:** AC-F1 and AC-F2 move from Story 2 to Story 1, so Story 1 is 3 → 4 SP and Story 2 is 7 → 6 SP. The total is unchanged at 13. The three fixture repositories also move, from the ICEA's Story 3 row to Story 2, because AC-F5's scenarios need them.
>
> **The ICEA is not edited by SAVE TECH.** It is immutable at this stage. These deviations are recorded here and in the tracker. To bring the ICEA in line (story table, plus System Context rows for `arch-spec-scan.cjs` and the `--spec` mode), run `REVISE ADO-8001`.

AC allocation:
- **Story 1:** AC-F1, AC-F2, AC-F3, AC-F4, AC-F13, AC-F14, AC-NF3
- **Story 2:** AC-F5, AC-F6, AC-F7, AC-F8, AC-F9, AC-F12, AC-NF2
- **Story 3:** AC-F10, AC-F11, AC-NF1

All 17 ICEA ACs are allocated exactly once.

---

## Auth & Security

There are no endpoints, tokens or network calls. Everything runs locally inside the developer's Claude Code session.

**Authentication pattern:** none. The skill runs as the developer's local session.

**Authorisation:**
- Writes are governed by the target application's Write Gate.
- The spec (`docs/architecture/diagram/{app}.arch.yaml`) and the PNG (`docs/images/{app}-architecture.png`) are docs artefacts, written only after the developer approves the draft (AC-F8).

**Cross-cutting security concerns:**

| Concern | Mitigation |
|---|---|
| Secret values copied into the spec | Settings and env templates are read for **key names only**; `.env` is never opened (Permission Boundary row 2). `scripts/arch-spec-scan.cjs --secrets` runs on the draft before save and blocks the save on any match (AC-F7) |
| YAML-form secrets missed by the existing scan | `validate-governance.cjs` `SECRET_PATTERNS` match `password=` only, not YAML `password: x`. `arch-spec-scan.cjs` adds the `key: value` forms (password, pwd, secret, token, api key, connection string, client secret, SAS `sig=`) plus the existing AWS / OpenAI / URL-credential / AccountKey patterns. This resolves the ICEA assumption "secret-scan patterns cover the spec's YAML format — unverified" |
| Internal hostnames / IPs published in a committed PNG | `arch-spec-scan.cjs --hosts` lists hostnames (URL hosts, host-like key values, TLD-shaped names) and IPv4 addresses in the draft; the developer keeps or masks each one before save. This applies in both generate mode and `--spec` mode |
| Unapproved draft on disk | The draft is scanned via `--stdin`; nothing is written until approval (AC-F8) |
| Real names leaking into plugin files | AC-F13 allow-list test: hostnames in `skills/arch-diagram/**` and `tests/fixtures/arch-diagram/**` must end in `example.com`, `example.org`, `.test` or `.invalid`, and IPv4 addresses must be in RFC 5737 ranges |
| Writing outside the target repository | The skill writes only the two output paths inside the target repository and never touches source, manifests or dependency files (Permission Boundary row 3) |
| Untrusted repository content run as code | Nothing from the target repository is executed. The renderer reads YAML with `yaml.safe_load` (no object construction) |

---

## Overall Request Flow

```
Developer: /arch-diagram  [--refresh]
  → [Story 1] dependency check: python ≥3.10, matplotlib, pyyaml        — stop with install steps if missing (AC-F2)
  → [Story 2] existing spec?  → plain run: stop with "--refresh or OVERWRITE"
                               → --refresh: go to the Story 3 branch
  → [Story 2] resolve app identity (references/app-identity.md)        — report source (AC-F12)
  → [Story 2] collect evidence by evidence-map glob, ≤15 files/role     — list skipped files (AC-F5, AC-NF2)
  → [Story 2] classify by role → draft spec with # source / ⚠ TODO + todo: true (AC-F6, AC-F14)
  → [Story 2] draft | node scripts/arch-spec-scan.cjs --stdin --secrets --hosts --sources — block on secret; show host list (AC-F6, AC-F7)
  → [Story 2] show draft + TODO summary + host list → wait for approval (AC-F8)
  → [Story 2] write docs/architecture/diagram/{app}.arch.yaml
  → [Story 1] python scripts/architecture-diagram.py <spec> docs/images/{app}-architecture.png --check   (AC-F4)
       exit 1 + "spec error:" → Story 2 shows a spec fix as a diff, re-renders after approval
       exit 1 + check problems → Story 2 proposes ONE layout revision (AC-F9)
  → [Story 2] show the PNG; report check result

--refresh branch (Story 3):
  → re-collect evidence → new draft → diff vs saved spec; keep every "# manual" entry (AC-F10)
  → same scan → approval → write → render → check
```

---

## Rollback

The epic is purely additive. There are no schema migrations, hooks or shared ledger changes.

**Schema migrations:** No schema changes.

**Rollback procedure:**
1. Revert the feature branch merge (or the per-story commits) on the plugin repository.
2. Re-run `node scripts/check-version-consistency.js` and `npm test`; both must pass at the prior version.
3. Target applications keep any spec or PNG already written. These are plain docs files, and a team can delete them by hand.

**Per-story rollback:** each story tech spec gives story-level detail.

---

## Handover

### QA Team

**What was added:**
- a Python renderer with `--check` and the unverified style
- a spec scanner
- the `/arch-diagram` skill with refresh mode
- examples and fixtures for five hosting models

**Test entry points:**
- **Story 1:** `/arch-diagram --spec` on each example spec, plus `npm test` (jest) in the plugin repository, with Python 3.10+, matplotlib and PyYAML installed. Repeat with Python hidden from PATH and check the skip notice (AC-NF3).
- **Story 2:** run `/arch-diagram` in each fixture under `tests/fixtures/arch-diagram/` and in one Kubernetes repository. Check the source lines, the TODO summary, the host list, and that nothing is written before approval.
- **Story 3:** add a `# manual` entry to a saved spec, run `/arch-diagram --refresh`, and confirm the entry is kept. Run `node scripts/check-version-consistency.js`.

**Regression risk:**
- `npm test` across the existing suites (one new jest file per script)
- `scripts/new-skill.sh` registration in `plugin.json`
- `_project-deploy/CLAUDE.md` §0a keyword table, which is deployed to every target

**Test data:**
- the example specs in `skills/arch-diagram/references/examples/`
- the fixture repositories in `tests/fixtures/arch-diagram/`
- broken specs created inside the test (temp directory)

### DevOps / Platform Team

| Item | Story | Detail |
|---|---|---|
| New runtime prerequisite on developer machines | Story 1 | Python 3.10+, `pip install matplotlib pyyaml`. Not added to any target's dependency files |
| CI | Story 1 | No pipeline change. The Python-dependent jest cases skip when Python or matplotlib is absent, so CI stays green whether or not Python is on the agent |
| Plugin version | Story 3 | 3.26.0 → 3.27.0 via `scripts/bump-version.sh` |
| Env vars, Key Vault, DB, health checks | — | None |

### Future Developer — Follow-on Work

1. **New hosting model:**
   - add one row to `skills/arch-diagram/references/evidence-map.md` (globs → role → type)
   - if no preset fits, add a `TYPES` entry in `scripts/architecture-diagram.py`, which renders as a plain box until you do
   - add a fixture and a scenario
2. **New secret pattern:** add it to `PATTERNS` in `scripts/arch-spec-scan.cjs` with a positive and a negative case in `tests/arch-spec-scan.test.cjs`.
3. **Known gap:** the patterns overlap with `validate-governance.cjs` `SECRET_PATTERNS`. Merging them into one shared module is a follow-up and deliberately not done here, because it would touch the commit-gate script.
4. **The application where the renderer started** (its ADO-90) removes its local copy after 3.27.0 ships.

---

## Definition of Done — Epic

**Delivery**
- [ ] All 3 story tech specs generated and saved (tracker shows all ✅)
- [ ] All stories implemented, reviewed and merged (tracker Child ADO # filled)
- [ ] All child ADOs closed in Azure DevOps

**Quality**
- [ ] `npm test` passes with Python present, and with Python hidden (skip notice shown)
- [ ] `node scripts/check-version-consistency.js` passes at 3.27.0
- [ ] AC-F13 allow-list test passes: no real hostname or IP in any plugin file this epic adds
- [ ] No hardcoded secrets, connection strings or credentials in any story

**Review**
- [ ] Epic tech spec reviewed by Tech Lead and Product
- [ ] Each story's PR maps changed files to ACs (AC Coverage Matrix)
- [ ] ICEA and all story tech specs committed in `feature/ADO-8001-arch-diagram`
- [ ] AC-NF1 side-by-side review recorded in the tracker

---

## Reviewer Checklist

- [ ] No story contains a real application name, organisation, hostname or IP (AC-F13 test plus a manual skim of the examples)
- [ ] Renderer stays backward compatible: an ADO-90-format spec renders unchanged (Story 1 test)
- [ ] The skill never executes anything from the target repository; YAML is read with `safe_load` only
- [ ] `arch-spec-scan.cjs` runs **before** the draft is saved, and a secret match blocks the save with no approval path
- [ ] Every `⚠ TODO` item in a generated spec also carries `todo: true`, so D-1 Option A is visible on the PNG
- [ ] Every new `.cjs` file carries the `SCRIPT REVIEW` header (`script-review-gate`)
- [ ] No story breaks the ≤8 SP rule; dependencies are 1 → 2 → 3
- [ ] Each story's AC Coverage Matrix has no gaps

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| ❓[1] | Which real repositories verify the Azure, IIS and Docker / Node.js hosting models (AC-NF1)? | Vivek Rawat | 2026-11-13 | **Answered by the developer (2026-11-13):** verify on the target project the skill runs in, plus the projects listed in the session's `additionalDirectories`. Repository names are recorded in the tracker's verification record only, never in plugin files. A hosting model with no matching repository in that set is verified on the Story 2 fixtures and marked as such |

> Answered by the developer at SAVE TECH (2026-11-13).

---

## Revision Log

2026-11-13 — Epic tech spec drafted from the saved ICEA (TECH ADO-8001 after /compact). Critic revision 1:
- ❓[1] resolved by process
- the ICEA is no longer edited at SAVE TECH (use `REVISE ADO-8001`)
- `--stdin` scanning
- `--spec` mode gated

Re-split: AC-F1 and AC-F2 moved to Story 1, so the stories are 4/6/3 SP. Added `scripts/arch-spec-scan.cjs` to close the ICEA's unverified secret-scan assumption, because the existing patterns miss the YAML `key: value` form.
