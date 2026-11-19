<!-- test-plan-state
source: plan
plan: ADO-82-arch-diagram-icons.plan.md
stories:
  - id: Story-1
    suite: "Suite 1"
    tech-spec: null
    status: generated
  - id: Story-2
    suite: "Suite 2"
    tech-spec: null
    status: generated
cross-cutting-suites-status: stub
-->
# Test Plan — /arch-diagram: Azure Architecture Icons in the rendered diagram
ADO #82 · Release R3 · Sprint S15
Document type: QA Test Plan (lightweight — generated from the approved plan's Must Have items)
Prepared: 2026-11-19

---

## Overview
Checks that the bundled Azure icons ship correctly (Story 1) and that `/arch-diagram` draws them,
honours the `icon:` key and degrades safely (Story 2). Run Suite 1 before Suite 2: the renderer
cases need the assets in place.

## Environment Requirements
| Item | Requirement |
|---|---|
| Node.js | The plugin's supported version (`npm test` runs) |
| Python | 3.10+ with `pip install matplotlib pyyaml` |
| Working copy | Plugin repo at 3.28.0, `assets/icons/azure/` present (34 PNGs) |
| Scratch folder | Any temp folder outside the repo for rendered PNGs and test specs |
| Maintainer only (TC-P5-*) | Microsoft `Azure_Public_Service_Icons_V25.zip` extracted; headless Edge or Chrome |

## Test Suites
| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | Plan Verification — Story 1: Assets | Every release that touches `assets/icons/azure/` | 25 min (+10 min maintainer build) |
| Suite 2 | Plan Verification — Story 2: Renderer | Every change to `scripts/architecture-diagram.py` | 35 min |
| Suite 3 | Regression | Before release | ⚠ stub |
| Suite 4 | Security | Before release | ⚠ stub |
| Suite 5 | Non-Functional | Before release | ⚠ stub |

**Estimated total effort: ~1.2 hours for a full pass (Suites 1–2).**

---

## Suite 1 — Plan Verification — Story 1: Assets
> Must Have 1, 2 and 5. Most checks are automated in `tests/architecture-diagram.test.cjs`
> (manifest case, runs without Python); the manual steps confirm what a reviewer sees.

### TC-P1-01 — Bundled icons are present, 128 px, transparent, under 250 KB
**Priority:** Critical
**Type:** Manual / script
**AC:** AC-F1

**Steps:**
1. `ls assets/icons/azure/*.png | wc -l`
2. `du -ch assets/icons/azure/*.png | tail -1`
3. Open three PNGs (`key-vaults.png`, `users.png`, `virtual-networks.png`) in an image viewer on a dark background.
4. `node tests/architecture-diagram.test.cjs` and read the "ADO-82 Azure icon assets" lines.

**Expected:** 34 PNGs; total under 250 KB; each is 128 × 128 with a transparent background; both
`ADO-82 AC-F6 every manifest.json entry (34) has its PNG on disk` and `... every PNG ... is listed in manifest.json` pass.

### TC-P1-02 — A PNG missing from disk, or on disk but not in the manifest, fails the suite
**Priority:** High
**Type:** Script (negative)
**AC:** AC-F1

**Steps:**
1. In a scratch copy of the repo, rename `assets/icons/azure/monitor.png` to `monitor.bak`; run `node tests/architecture-diagram.test.cjs`.
2. Restore it; copy `users.png` to `extra.png`; run again.

**Expected:** step 1 fails "every manifest.json entry has its PNG on disk" naming `monitor.png`;
step 2 fails "every PNG ... is listed in manifest.json" naming `extra.png`. Exit code 1 both times.

### TC-P2-01 — NOTICE.md records source, version and Microsoft's terms; README links to it
**Priority:** Critical
**Type:** Manual review
**AC:** AC-F2

**Steps:**
1. Open `assets/icons/azure/NOTICE.md`.
2. Open `README.md`, Licence section.

**Expected:** NOTICE.md names the source page, the icon-set version (V25) and Microsoft's terms of
use, and states the icons are not covered by the repo's MIT licence. The README Licence section links to NOTICE.md.

### TC-P2-02 — No icon ships without the notice
**Priority:** High
**Type:** Manual review (negative)
**AC:** AC-F2

**Steps:**
1. `git ls-files assets/icons/azure` (after commit) or `ls assets/icons/azure`.

**Expected:** NOTICE.md is in the same folder as the PNGs and `manifest.json`. **Fail condition:**
PNGs present with no NOTICE.md, or NOTICE.md that does not mention the terms of use.

### TC-P5-01 — Maintainer build reproduces the same file names
**Priority:** Medium
**Type:** Maintainer script
**AC:** AC-F5

**Steps:**
1. In a scratch copy, delete `assets/icons/azure/*.png`.
2. Run `node scripts/build-azure-icons.cjs <extracted zip folder>` (usage per the script header).
3. `ls assets/icons/azure/*.png` and compare with the 34 names in `manifest.json`.

**Expected:** the build finishes, writes 34 PNGs whose names match the manifest exactly, each 128 × 128 and transparent. A second run gives the same names.

### TC-P5-02 — Build fails loudly when a source SVG is missing or arguments are wrong
**Priority:** High
**Type:** Maintainer script (negative)
**AC:** AC-F5

**Steps:**
1. Run the build with no arguments.
2. Run it against a folder that is not the extracted zip.

**Expected:** step 1 prints usage and exits 2; step 2 fails and names every manifest entry whose source SVG is missing (34 for a wrong folder). No partial PNGs are reported as success.

---

## Suite 2 — Plan Verification — Story 2: Renderer
> Must Have 3, 4, 6 and 7. Automated equivalents are the `ADO-82 ...` cases in
> `tests/architecture-diagram.test.cjs`; the manual steps check the picture itself.

Shared test spec for this suite (save as `icons.yaml` in the scratch folder):
```yaml
title: "Icons"
zones:
  - name: "Icon rules"
    columns: 4
    components:
      - {id: kv, name: kv, type: key-vault}
      - {id: vm, name: vm, type: vm, icon: virtual-machine}
      - {id: hide, name: hide, type: key-vault, icon: ""}
      - {id: nodb, name: nodb, type: storage, icon: ""}
      - {id: typo, name: typo, type: key-vault, icon: key-vault}
      - {id: sqlsrv, name: sqlsrv, type: sql-server}
```

### TC-P3-01 — Known type draws its Azure icon; icon: overrides and hides
**Priority:** Critical
**Type:** Manual render
**AC:** AC-F3

**Steps:**
1. `python scripts/architecture-diagram.py icons.yaml icons.png --check`
2. Open `icons.png`.

**Expected:** exit 0, `check: ok`. `kv` shows the Key Vault icon; `vm` shows the Virtual Machine
icon; `hide` and `nodb` show no icon at all (no Key Vault icon, no database cylinder); `sqlsrv`
shows the built-in database cylinder. Icons are square, not stretched, left of the text.

### TC-P3-02 — Unknown icon name warns and still renders; bad icon value is a spec error
**Priority:** High
**Type:** Manual render (negative)
**AC:** AC-F3

**Steps:**
1. Run step 1 of TC-P3-01 and read stderr.
2. Add `      - {id: bad, name: bad, type: key-vault, icon: 5}` to `icons.yaml`; render again.

**Expected:** step 1 prints one `warning: 'typo' has unknown icon 'key-vault', drawn with its usual icon. Known icons: ...`
line, exit 0, and `typo` shows the Key Vault icon. Step 2 exits 1 with the single line
`spec error: icon must be an icon name or "" (component bad)` and writes no PNG.

### TC-P3-03 — Renders from any working directory
**Priority:** High
**Type:** Manual render
**AC:** AC-F3

**Steps:**
1. `cd` to the scratch folder (outside the repo).
2. `python "<repo>/scripts/architecture-diagram.py" icons.yaml icons2.png`

**Expected:** identical icons to TC-P3-01 — the assets are found relative to the script, not the working directory.

### TC-P3-04 — Without the assets folder the diagram renders as in 3.27.0
**Priority:** Critical
**Type:** Manual render (negative)
**AC:** AC-F3

**Steps:**
1. In a scratch copy of the repo, rename `assets/icons/azure` to `azure.off`.
2. Render `icons.yaml` and `skills/arch-diagram/references/examples/azure-app-service.yaml` with `--check`.

**Expected:** both exit 0 with `check: ok` and **no** warnings (the `typo` name is ignored quietly).
No Azure icons appear; storage/SQL boxes show the database cylinder and users the screen shape,
as in 3.27.0. (`icon: ""` still hides the built-in shape.)

### TC-P4-01 — The 8 new types are known, labelled and iconed
**Priority:** Critical
**Type:** Manual render
**AC:** AC-F4

**Steps:**
1. Write a spec with one component each of `event-hubs`, `service-bus`, `log-analytics`, `private-endpoint`, `network-interface`, `vnet`, `expressroute`, `entra-app`; render with `--check`.

**Expected:** exit 0, `check: ok`, no `unknown type` warning. Labels read Azure Event Hubs, Azure
Service Bus, Log Analytics workspace, Private endpoint, Network interface, Virtual network,
ExpressRoute circuit, Entra ID app registration, each with its matching icon (approved table in the plan's Revision Log).

### TC-P4-02 — A misspelt new type warns and draws a plain box
**Priority:** Medium
**Type:** Manual render (negative)
**AC:** AC-F4

**Steps:**
1. Render a component with `type: eventhub`.

**Expected:** `warning: ... unknown type 'eventhub', drawn as a plain box`; exit 0; the box has no icon and no type label.

### TC-P6-01 — The automated suite passes
**Priority:** Critical
**Type:** Script
**AC:** AC-F6

**Steps:**
1. `node tests/architecture-diagram.test.cjs`
2. `npm test`

**Expected:** step 1 ends `37 passed · 0 failed` and includes the 10 `ADO-82` cases (manifest both
ways, known type draws icon, override, hide, built-in kept, unknown warns, 8 new types, defaults in
manifest, no-assets layout) and the five example specs with `check: ok`. Step 2 passes.

### TC-P6-02 — Without Python the suite still passes with a skip notice
**Priority:** High
**Type:** Script (negative)
**AC:** AC-F6

**Steps:**
1. `ARCH_DIAGRAM_PYTHON=none node tests/architecture-diagram.test.cjs`

**Expected:** `architecture-diagram: skipped — python/matplotlib not found`; the allow-list and the two manifest cases still run and pass; exit 0.

### TC-P7-01 — Docs, CHANGELOG and version are updated
**Priority:** High
**Type:** Manual review
**AC:** AC-F7

**Steps:**
1. Read the renderer docstring (`AZURE ICONS` section, `icon:` key in the spec format).
2. Read `skills/arch-diagram/references/spec-format.md` § Azure icons (ADO-82).
3. Read the top of `CHANGELOG.md`; `node -p "require('./.claude-plugin/plugin.json').version"`.
4. Read the Won't Have list in `docs/Release3/Sprint14/UserStory8001/ADO-8001-arch-diagram.plan.md`.

**Expected:** docstring and spec-format list the iconed types, `icon: <name>`, `icon: ""` and the
unknown-name rule; CHANGELOG has a `[3.28.0]` ADO-82 entry; version is `3.28.0`; the ADO-8001 Won't
Have line carries the ADO-82 amendment pointer.

### TC-P7-02 — No version drift and no non-documentation hostnames introduced
**Priority:** Medium
**Type:** Script (negative)
**AC:** AC-F7

**Steps:**
1. `node scripts/check-version-consistency.js`
2. `node tests/architecture-diagram.test.cjs` — the AC-F13 allow-list line.

**Expected:** version consistent with plugin.json (3.28.0); the allow-list case passes (no real
URLs or hostnames were added to `spec-format.md` or the renderer). **Fail condition:** any
`learn.microsoft.com`-style host reported from `skills/arch-diagram/`.

---

## Suite 3 — Regression  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-REG-01 — Every existing /arch-diagram example and an ADO-90-format spec still pass --check
**Priority:** Critical | **AC:** AC-F3, AC-F6 | **Type:** Script
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-REG-02 — /arch-diagram generate and --refresh flows unchanged on a fixture repository
**Priority:** High | **AC:** AC-F3 | **Type:** Manual skill run
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Suite 4 — Security  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-SEC-01 — Icon paths cannot escape the assets folder (manifest `file` values, `icon:` names)
**Priority:** High | **AC:** AC-F3 | **Type:** Code review
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-SEC-02 — Licence sign-off (plan open question 1) recorded before release
**Priority:** High | **AC:** AC-F2 | **Type:** Manual review
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Suite 5 — Non-Functional  ⚠ Stub
⚠ [lightweight — expand manually]

### TC-NFR-01 — No new dependency: renderer needs only matplotlib (+ PyYAML for YAML)
**Priority:** High | **AC:** AC-F3 | **Type:** Manual
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

### TC-NFR-02 — Render time with icons within 10% of 3.27.0 on the largest example
**Priority:** Medium | **AC:** AC-F3 | **Type:** Performance
**Steps:** ⬜ TBD
**Expected:** ⬜ TBD

---

## Test Execution Tracker
| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-P1-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P1-02 | Suite 1 | High | | | ⬜ | |
| TC-P2-01 | Suite 1 | Critical | | | ⬜ | |
| TC-P2-02 | Suite 1 | High | | | ⬜ | |
| TC-P5-01 | Suite 1 | Medium | | | ⬜ | Maintainer only |
| TC-P5-02 | Suite 1 | High | | | ⬜ | Maintainer only |
| TC-P3-01 | Suite 2 | Critical | | | ⬜ | |
| TC-P3-02 | Suite 2 | High | | | ⬜ | |
| TC-P3-03 | Suite 2 | High | | | ⬜ | |
| TC-P3-04 | Suite 2 | Critical | | | ⬜ | |
| TC-P4-01 | Suite 2 | Critical | | | ⬜ | |
| TC-P4-02 | Suite 2 | Medium | | | ⬜ | |
| TC-P6-01 | Suite 2 | Critical | | | ⬜ | |
| TC-P6-02 | Suite 2 | High | | | ⬜ | |
| TC-P7-01 | Suite 2 | High | | | ⬜ | |
| TC-P7-02 | Suite 2 | Medium | | | ⬜ | |
| TC-REG-01 | Suite 3 | Critical | | | ⬜ | Stub |
| TC-REG-02 | Suite 3 | High | | | ⬜ | Stub |
| TC-SEC-01 | Suite 4 | High | | | ⬜ | Stub |
| TC-SEC-02 | Suite 4 | High | | | ⬜ | Stub |
| TC-NFR-01 | Suite 5 | High | | | ⬜ | Stub |
| TC-NFR-02 | Suite 5 | Medium | | | ⬜ | Stub |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## Exit Criteria
### Minimum for story to close
- [ ] All Critical TCs in Suites 1–2 passed
- [ ] Zero open Critical defects
- [ ] TC-P6-01 (automated suite) passed on the release commit
- [ ] Licence sign-off (plan open question 1) recorded — hard gate before the icons are pushed to the shared repo
