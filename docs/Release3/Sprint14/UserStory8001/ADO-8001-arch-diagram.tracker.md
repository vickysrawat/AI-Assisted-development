# Tracker — ADO-8001 /arch-diagram [EPIC]
ADO #8001 · Release 3 · Sprint 14 · governance: full · 13 SP
Branch: `feature/ADO-8001-arch-diagram`

## Story Board

| Story | Title | Child ADO # | SP | ACs | Tech Spec | Status |
|---|---|---|---|---|---|---|
| 1 | Renderer, scanner and skill scaffold | TBD | 4 | AC-F1, AC-F2, AC-F3, AC-F4, AC-F13, AC-F14, AC-NF3 | ADO-8001-Story-1-renderer.techspec.md | ✅ Done |
| 2 | Spec generation | TBD | 6 | AC-F5, AC-F6, AC-F7, AC-F8, AC-F9, AC-F12, AC-NF2 | ADO-8001-Story-2-spec-generation.techspec.md | ✅ Done |
| 3 | Refresh and rollout | TBD | 3 | AC-F10, AC-F11, AC-NF1 | ADO-8001-Story-3-refresh-rollout.techspec.md | ✅ Done |

---

## Story 1 — Renderer, scanner and skill scaffold

| AC | Status |
|---|---|
**Status:** ✅ Done · **Child ADO:** TBD · Last updated 2026-11-13

| AC | Status |
|---|---|
| AC-F1 | ✅ Done (skill, deployed command stub, plugin.json `skills` entry, README row, scenarios, consent row, setup-init / setup-status stub lists) |
| AC-F2 | ✅ Done (Step 1 dependency check; verified against the Store `python3` stub on the dev machine) |
| AC-F3 | ✅ Done |
| AC-F4 | ✅ Done |
| AC-F13 | ✅ Done |
| AC-F14 | ✅ Done (rendering half; the skill half is Story 2) |
| AC-NF3 | ✅ Done (self-test with `ARCH_DIAGRAM_PYTHON=none`; the manual PATH-stripped run is still open, see Known gaps) |

### Delivered
- `script`: generic renderer: 12 hosting presets, `todo: true` unverified style, `legend_entries()`, `--check` via `check()`, heading/detail text of container boxes treated as arrow obstacles (`scripts/architecture-diagram.py`)
- `script`: spec scanner: secret patterns (YAML `key: value`, quoted, block-scalar, connection strings, cloud keys), hostname/IP extraction, RFC 2606 / 5737 allow-list, `--stdin` / `--json` (`scripts/arch-spec-scan.cjs`)
- `skill`: `/arch-diagram --spec <file>`: dependency check, scan, Write Gate, render, check, show PNG (`skills/arch-diagram/SKILL.md`)
- `examples`: five made-up specs: Kubernetes, Azure App Service, on-prem IIS, Docker Compose, Node.js + PM2 (`skills/arch-diagram/references/examples/`)
- `registration`: `_project-deploy/commands/arch-diagram.md`, `.claude-plugin/plugin.json` (skills list), `README.md` row, `skills/shared/source-file-consent.md` row (C), `scripts/setup-init-bootstrap.cjs` STUB_FILES, `skills/setup-status/SKILL.md` check 1d

### Tests
- `tests/architecture-diagram.test.cjs`: 22 cases. AC-F13 allow-list (always runs); AC-NF3 no-Python self-test; AC-F3/F4 five examples plus an ADO-90-format spec with `check: ok`; 12 presets; AC-F14 legend with and without todo; AC-F4 forced no-path exit 1, plus `check()` reporting overlap / not inside / diagonal / crosses box / crosses text / off edge; spec errors; unknown type
- `tests/arch-spec-scan.test.cjs`: 18 cases. AC-F7 secret forms and non-secrets (values never printed); AC-F13 host extraction, code identifiers, product names, Markdown fences, allow-list; CLI stdin / exit codes
- `tests/skill-scenarios/arch-diagram.yaml`: 8 scenarios (AC-F1, AC-F2, R0 block, SKIP)

### Follow-ups
| # | Issue | Fix | Files |
|---|---|---|---|
| 1 | Planned dependency check picked the Windows Store `python3` stub and refused to run | Try python3 / python / py in turn, keep the first ≥3.10; print the path for later steps | `skills/arch-diagram/SKILL.md` |
| 2 | Arrows could cross a container box's heading text (inherited from ADO-90); `--check` missed it | Container heading / detail text became ownerless obstacles; `check()` reports "crosses the text of" | `scripts/architecture-diagram.py` |
| 3 | Allow-list flagged "ASP.NET" as a host | Product names excluded from host extraction | `scripts/arch-spec-scan.cjs` |
| 4 | Test imports left `__pycache__` in the repo | `PYTHONDONTWRITEBYTECODE=1` for every Python spawn | `tests/architecture-diagram.test.cjs` |
| 5 | `new-skill.sh` crashed printing ✓ (cp1252 console) after writing plugin.json, skipping the README step; it also re-sorts the whole skills list | Kept a one-line plugin.json change; added the README row by hand | `.claude-plugin/plugin.json`, `README.md` |

### Design decisions
- AC-F1 and AC-F2 moved here from Story 2, because `new-skill.sh` must run before the examples are written into `skills/arch-diagram/`.
- `scripts/arch-spec-scan.cjs` added: the existing `SECRET_PATTERNS` miss YAML `key: value` secrets and are not exported. It reads `--stdin`, so drafts never touch disk before approval.
- `--spec` mode scans the spec and shows the Write Gate prompt before rendering.
- **Standby and todo on one box:** unverified wins (amber dashed + "⚠ unverified"). Rejected: red and amber borders together, which readers can't tell apart.
- **Zone-level `todo`:** allowed (border only), so a site known only from documents can be shown as unverified.
- **Tests:** plugin convention (plain node scripts run by `tests/jest.suite.test.cjs`) instead of jest `describe.skip`; renders run in parallel to fit the 120 s per-file limit.
- **`route_all` returns the fallback flows** instead of a `Router.fallbacks` attribute.
- **Secret values must be a single token** (or quoted); generic `secret` / `token` values need a letter and a digit. Prose such as `Password: 'rotated by Key Vault'` is still blocked, and the skill tells the developer to reword it.
- **Allow-list:** strict extraction for docs / config / specs, normal for code; dotless server names in non-code files must contain `contoso` / `example`, or be `localhost`. `0.0.0.0` is allowed (discloses nothing).
- **Consent C** for this story (reads only the named spec); Story 2 moves it to B.
- **No root `commands/arch-diagram.md`:** the deployed stub invokes `ai-assisted-development:arch-diagram` directly.
- These deviations from the ICEA story table are recorded here; the ICEA itself changes only through `REVISE ADO-8001`.

### Known gaps
- Secret patterns overlap with `validate-governance.cjs`. Merging them into one shared module is a follow-up.
- AC-NF3: one manual `npm test` with Python stripped from PATH is still to be run (the self-test covers the env override).
- ICEA System Context drift (says 9 presets; omits `arch-spec-scan.cjs` and `--spec` mode). Needs `REVISE ADO-8001`.
- The `setup-status` "All 41 exist" count text was already wrong on `origin/main` (the validator expects 49); left unchanged.

### Lessons learned

**Revision summary**
| Phase | Count | Dominant themes (from audit summaries) |
|---|---|---|
| ICEA | 2 | real-name deny-list → allow-list · read cap undefined |
| Tech Spec | 1 (12 findings) | draft on disk before scan · host-extraction false positives · test rows missing |
| Code | 1 (12 findings) | Windows Python stub · shell state between steps · test side effects |

**Root cause analysis**
Most revisions came from the Windows dev environment: the Store `python3` alias, the cp1252 console, and Bash calls that don't share state. None of these were captured in the plan or the Tech Spec. Text-matching heuristics (hostnames, secrets) needed several rounds, because their false positives only showed up against real content: product names, prose, code identifiers.

**What to do differently next time**
- [ ] For any skill that shells out to Python, specify interpreter resolution (try each candidate) in the Tech Spec, not `command -v python3`.
- [ ] Run pattern-based scanners over the plugin's own files before the critic, to surface false positives early.

---

## Story 2 — Spec generation

**Status:** ✅ Done · **Child ADO:** TBD · Last updated 2026-11-16

| AC | Status |
|---|---|
| AC-F5 | ✅ Done (evidence map, 12 rows incl. documents + settings; fallback `server` + TODO; 3 fixtures) |
| AC-F6 | ✅ Done (`--sources` with list-aware item detection; `--root` checks cited files and lines exist) |
| AC-F7 | ✅ Done (Step 6 stdin scan; settings templates via `--keys`, never opened; host keep / mask table) |
| AC-F8 | ✅ Done (no write before APPROVE; no scratch file) |
| AC-F9 | ✅ Done (one layout revision; spec errors fixed in the spec; re-scan after any edit) |
| AC-F12 | ✅ Done (four identity sources, slug, override) |
| AC-NF2 | ✅ Done (glob-only reads, 15 per role, exclusions, skipped list, one-count-per-file rule) — transcript check on a large repository is Story 3 / AC-NF1 territory |
| AC-F14 (skill half) | ✅ Done (`⚠ TODO` without `todo: true` is a source gap) |

### Delivered
- `skill`: `/arch-diagram` generation: dependency check → existing-spec check → identity → bulk-scan consent → evidence by role → draft with sources / TODO → stdin scan → review with host table → write → render + check → one revision (`skills/arch-diagram/SKILL.md`)
- `reference`: application identity order, slug, title, override (`skills/arch-diagram/references/app-identity.md`)
- `reference`: roles, 12 evidence rows, read budget, exclusions, counting rule (`skills/arch-diagram/references/evidence-map.md`)
- `reference`: generated-spec conventions, a tested example for the Docker fixture, zone templates, layout levers (`skills/arch-diagram/references/spec-format.md`)
- `script`: `checkSources` / `--sources` / `--root=`, `extractKeys` / `--keys`, space-form hosts (`server host:port;`, `Data Source host;`) (`scripts/arch-spec-scan.cjs`)
- `fixtures`: `docker-compose-app` (5 files), `node-pm2-app` (4), `aws-ecs-app` (4) (`tests/fixtures/arch-diagram/`)
- `registration`: consent row C → B (`skills/shared/source-file-consent.md`)

### Tests
- `tests/arch-spec-scan.test.cjs`: 37 cases (+19). checkSources: sources, TODO, `# manual`, missing source, TODO without flag, any first key, keys level with the list key, non-mapping entries, parent / child todo, stack only as a real `type` key, paths outside the repository, `.env`, line 0, missing file, line past the end, inline lists; the spec-format.md example against the fixture. extractKeys: .env / YAML / JSON, YAML block values skipped, `--keys` on the fixture prints no value. Space-form hosts; systemd unit names
- `tests/architecture-diagram.test.cjs`: 23 cases (+1). Renders the spec-format.md example with `check: ok`; allow-list now covers 24 files including the fixtures
- `tests/skill-scenarios/arch-diagram.yaml`: 27 scenarios (+19 for Story 2)

### Follow-ups
| # | Issue | Fix | Files |
|---|---|---|---|
| 1 | `checkSources` only saw items starting with `id:` / `name:` / `from:` / `type:` (key order is free in YAML) | List-aware item detection (`listItems`) | `scripts/arch-spec-scan.cjs` |
| 2 | Narrowing the nginx rule dropped `server host:port;` and `Data Source host;` | `SPACE_HOST` for server / data source; `server_name` kept separately | `scripts/arch-spec-scan.cjs` |
| 3 | Skill said documentation hosts "need no decision", contradicting the mask scenario | Every host listed; documentation names pre-marked keep; role tokens defined | `skills/arch-diagram/SKILL.md` |
| 4 | `--root` accepted paths outside the repository, `.env`, and line 0 | Containment, `.env` and line checks | `scripts/arch-spec-scan.cjs` |
| 5 | Settings template values would enter the conversation when read | `--keys` mode; the skill never opens templates | `scripts/arch-spec-scan.cjs`, `skills/arch-diagram/SKILL.md` |
| 6 | Allow-list false positives: `metadata.name`, "host table);", `network.target` | Code span in the doc; space form limited to server / data source; systemd suffixes | `evidence-map.md`, `scripts/arch-spec-scan.cjs` |
| 7 | Stack skip matched `type: stack` inside a label; `--keys` read YAML block-value lines | Real `type` key only; block values skipped | `scripts/arch-spec-scan.cjs` |

### Design decisions
- Fixtures moved here from Story 3 (AC-F5 scenarios need them).
- `arch-spec-scan.cjs --sources` is the deterministic AC-F6 line check; `--root=` goes further and checks each cited file and line exists, so "traceable to a file" is mechanical.
- **Consent B:** one bulk-scan prompt (Step 3b) with counts per role and a token estimate. Identity files (Step 2) are read before it as project configuration.
- **Draft scanning:** a quoted heredoc (`ARCH_DIAGRAM_DRAFT_EOF`) pipes the draft to the scanner, with no scratch file. Verified that apostrophes, quotes, `$` and backticks survive.
- **Settings templates:** read with `--keys` only (key names and lines), never opened.
- **Fixture deviations:** the Docker fixture's fake secret is in `docker-compose.yml` `environment:` (the Write Gate blocks committed `.env.*` files), and a keys-only template is `config/app.yaml`. Compose services are named `contoso-*`, because service names are hostnames and must pass the AC-F13 rule. Both fake values are commented as fake in the files.
- **`--refresh`:** stops with "arrives in the next release" until Story 3.

### Known gaps
- **Residual risk:** Step 6 passes the draft in the scan command's input, so a secret that slipped into a draft is visible in that tool call before the scan blocks it. Every no-disk route has this.
- **Org credential scanners:** the fixtures' fake values (`SESSION_SIGNING_SECRET`, `ORDERS_DB_PASSWORD`) pass the plugin commit gate but may be flagged by an organisation-level credential scanner; add a suppression if that happens.
- **Mechanical TODO summary** (optional critic note 12): `checkSources` could return the `⚠ TODO` lines so the summary is checked mechanically. Not done.
- **Routing:** recovery arrows can run along zone borders (seen on the spec-format example). Legible, passes `--check`; router unchanged.
- **Test time margin:** `tests/architecture-diagram.test.cjs` takes 25 s alone but 88.7 s under the full `npm test` load, against the wrapper's 120 s per-file limit. If it grows (more examples or renders), cap the parallel renders or split the file.

### Lessons learned

**Revision summary**
| Phase | Count | Dominant themes (from audit summaries) |
|---|---|---|
| Code | 1 (12 findings) | text heuristics fail open (item detection, space-form hosts) · secret values reachable through reads · scenario / skill mismatch |

**Root cause analysis**
The first `checkSources` recognised items by their first key, which works for drafts written in a set key order but fails open on valid YAML. In the same pass, narrowing one host rule silently removed coverage another case relied on. Both happened because the checks were written from the happy path rather than from the ways a draft can vary.

**What to do differently next time**
- [ ] For every mechanical check, write the "fails open" tests first: other key orders, other indentation styles, other spellings of the same fact.
- [ ] When narrowing a pattern to fix a false positive, re-run the cases it previously caught before moving on.

---

## Story 3 — Refresh and rollout

**Status:** ✅ Done · **Child ADO:** TBD · Last updated 2026-11-16

| AC | Status |
|---|---|
| AC-F10 | ✅ Done (Steps F1–F5; `--manual-kept` checks every manual block: same key, same text, same zone; no new manual items) |
| AC-F11 | ✅ Done (`ARCH DIAGRAM` rows in `_project-deploy/CLAUDE.md`; CHANGELOG `[3.27.0] — 2026-11-16`; version 3.27.0 in plugin.json, both CLAUDE.md labels, plugin-manifest.json and the README header; check-version-consistency OK) |
| AC-NF1 | ✅ Done, with exceptions: 4 repositories verified; the hand-made diagram is reproduced except the 2 firewall notes, which have no evidence (`# manual` items) |

### Delivered
- `skill`: refresh mode Steps F1–F5, keyword triggers, version 1.0 (`skills/arch-diagram/SKILL.md`); § `# manual` (`references/spec-format.md`)
- `script`: `itemTree`, `manualBlocks`, `checkManualKept`, `--manual-kept=` (`scripts/arch-spec-scan.cjs`)
- `release`: `_project-deploy/CLAUDE.md` §0a rows and version label, CHANGELOG 3.27.0 (option A: the former `[Unreleased]` notes ship with it), plugin.json / CLAUDE.md via `bump-version.js`, `plugin-manifest.json`, README header and skills row
- `fix round` (after verification, developer: FIX ALL):
  - **scanner:** dotless server names; XML `--keys` (element-level, comment-aware, never values); loud refusal of unsupported types; linear line counting
  - **renderer:** wrapping at `.` `-` `/` and camelCase; `--check` badge overlap and badge-on-box; badge fallback beside the line; crash guard
  - **skill and references:** no masking; evidence map (case, transforms, deploy-script scope, CI under build/, sub-project docs, .docx/.pdf, K8s mounts, Node entry file, exclusions, large-repo search); identity rules; Step 4 rules

### Tests
- `tests/arch-spec-scan.test.cjs`: 52 cases (+15 in Story 3): manual blocks (kept, changed, appended, comment, moved, new, manual zone), XML keys, dotless names and non-hits, unsupported `--keys`
- `tests/architecture-diagram.test.cjs`: 27 cases (+4): badge overlap / on-box, wrapping, `badge_spot` edge cases; the example lookup is anchored on its heading
- `tests/skill-scenarios/arch-diagram.yaml`: 41 scenarios (+14 in Story 3)
- Full suite 43/43 after the Story 3 write; worktree tests 52/52 and 27/27 after the fix round
### AC-NF1 verification record
Run 2026-11-16 with the developer's consent (target project + `additionalDirectories` projects). Outputs went to `C:\tmp\ado8001-verify\` only; nothing was written in any repository.

| Repository | Hosting model found | Zones / components / flows | Sourced / ⚠ TODO | Scan | `--check` |
|---|---|---|---|---|---|
| Rate-Tracker (target) | Kubernetes, on-prem (+ UAT) | 7 / 25 / 16 | 49 / 3 | clean | ok, first render |
| KE.KMS.Trackers.Phase12 | On-prem IIS (code only, no docs at root) | 5 / 26 / 15 | 31 / 9 | clean | ok, first render |
| KE.Web | IIS (from documents; "on-prem or Azure VM" → TODO) | 5 / 12 / 11 | 29 / 4 | clean | ok, first render |
| KE.KirklandData | On-prem IIS / WAS (documents + Web.config) | 5 / 13 / 10 | 22 / 6 | clean | ok, first render |

**Side-by-side against the hand-made diagram (Rate-Tracker, 43 items):** 37 reproduced ✅ · 4 shown as ⚠ TODO or renamed · 2 missing ❌.
- ❌ firewall note: no evidence anywhere in the repository. Correct not to invent it; a `# manual` candidate.
- ❌ config→pod arrow: the evidence exists (ConfigMap mount). A genuine miss.
- The generated spec has 7 evidence-backed items the hand-made diagram lacks, and shows the hand-made one is out of date (its deploy pipeline has since changed).

Not covered by a real repository: Azure PaaS, Docker-only and Node.js / PM2 hosting. These are covered by the Story 2 fixtures.

**Re-run on Rate-Tracker after the fix round (2026-11-16):** 6 zones / 25 components / 23 flows; every item sourced; 7 ⚠ TODO; scan clean; `check: ok` first render. Identity is now correct ("Rate Tracker"). Production manifests were read first. The two `.docx` recovery plans are listed as not readable. One dotless server name was listed.
- Against the hand-made diagram: **41 of 43 present** (35 clean, 6 shown as ⚠ TODO), **2 missing**. Both missing items are the firewall zone notes, which have no evidence anywhere in the repository, so they are left for `# manual`. The config→pod arrow is now drawn, together with four more mount flows.
- Two items moved from clean to ⚠ TODO under the new contradiction rule, because documents and manifests disagree on the SQL Server name and on the deploy pipeline file.

**Skill problems found by the runs:** see Story 3 Follow-ups (fix round after verification).
### Follow-ups
| # | Issue | Fix | Files |
|---|---|---|---|
| 1 | Children of a `# manual` zone needed their own sources; `--manual-kept` was a substring match | `itemTree` (parent, own lines, zone); keyed comparison of manual blocks | `scripts/arch-spec-scan.cjs` |
| 2 | Refresh could change the file name, edit manual blocks, or loop on a renamed zone | F1 fixes the paths; manual blocks never edited; zone holding a manual item keeps its name | `skills/arch-diagram/SKILL.md` |
| 3 | Verification: dotless server names (e.g. SQL servers) missed by `--hosts` | `DOTLESS_SERVER` rule, tuned against version strings | `scripts/arch-spec-scan.cjs` |
| 4 | Verification: `--keys` silently empty for Web.config | XML support; unsupported types exit 2 | `scripts/arch-spec-scan.cjs` |
| 5 | Verification: name "Architecture — Rate Tracker", "source" from a scoped npm name | Prefix/suffix stripping, generic names → scope | `references/app-identity.md` |
| 6 | Verification: `Web.config` case, transforms, deploy `.ps1` picking hooks, CI in `build/`, sub-project docs, Glob timeouts | Evidence map rewritten for these; pruned `find` | `references/evidence-map.md`, `SKILL.md` |
| 7 | Verification: config→pod arrow missed; docs with two options | Mounts → flows; two options → TODO citing both; other contradictions settled by precedence (fix round 2) | `SKILL.md`, `references/evidence-map.md` |
| 8 | Verification: overlapping badges, names broken mid-word | Badge checks + fallback; wrapping at separators / camelCase | `scripts/architecture-diagram.py` |
| 9 | Fix-round critic: XML `--keys` could print part of a value; badge crash | Attribute-level parsing; guards | both scripts |
- The application where the renderer started removes its local copy under its own ADO-90 after 3.27.0 ships.
### Design decisions
- The refresh diff is done by the LLM on `id` / `from→to`; `--manual-kept=` is a deterministic guard (accepted deviation from the Tech Spec, which planned no script).
- Manual blocks must come back at the same nesting; position among neighbours is not checked.
- **Developer decision 2026-11-16: no masking.** Hostnames and server names stay exactly as found; Step 7 lists them for information. This replaces ICEA AC-F7's "keep or mask" (needs `REVISE ADO-8001`).
- CHANGELOG option A: the former `[Unreleased]` notes ship in 3.27.0.
- **Developer decision 2026-11-16: Step 6 scans the draft from a scratch file in the OS temp folder**, outside the repository, deleted by the same command, instead of `--stdin` with a heredoc, which failed in 2 of 5 verification runs. This reverses the Story 2 / Tech Spec critic F1 resolution ("no scratch file"). The draft stays out of the repository, and the skill deletes the file again if the scan did not run. The Tech Spec row "scanned via `--stdin`" needs `REVISE ADO-8001`.
- Contradictions are settled by precedence: deployed config beats documents (same environment), an existing file beats a document naming a missing one, a newer document beats an older or self-declared stale one. Only otherwise does the item become `todo: true` citing both. Settled cases are listed in the TODO summary.
- The version was bumped with `bump-version.js` plus `release.cjs` steps 5–6 by hand, because `release.cjs` refuses an uncommitted tree. Phase 2 (commit + tag) was not run.
- Dotless server names: the last part must mix letters and digits, and no middle part may be all digits. This misses names like `sql-prod-01`, which is accepted.
### Known gaps
- `guides/plugin-user-guide.html` and `guides/plugin-developer-guide.html` still document 3.26.0: their content does not cover `/arch-diagram` yet, so they were not stamped.
- `REVISE ADO-8001` is needed for the ICEA and Tech Spec drift: AC-F7 (keep / mask → hosts listed as found), AC-F8 ("nothing is written" → nothing in the repository; scratch draft in the OS temp folder), the Tech Spec `--stdin` row, and the System Context (9 → 12 presets, `arch-spec-scan.cjs`, `--spec` mode).
- Remaining low notes: an XML element with an unquoted or valueless attribute is skipped silently; `api-gateway-v2`-style names are still listed as servers (noise only).
- AC-NF3 manual run with Python removed from PATH is still open.
- A verification agent left `C:\tmp\ado8001-verify\_scripts\`; its own delete was denied, so the developer decides.

---

## Write log

## Bugs

### Lessons learned

**Revision summary (epic)**
| Phase | Count | Dominant themes (from audit summaries) |
|---|---|---|
| ICEA | 2 | real-name deny-list → allow-list · read cap undefined |
| Tech Spec | 1 (12 findings) | draft on disk before scan · host-extraction false positives · missing test rows |
| Code | 5 (≈50 findings over Stories 1–3 and two fix rounds) | Windows tooling (Python stub, cp1252, heredocs) · pattern heuristics failing open or matching too much · manual-block and XML edge cases |
| Verification | 5 real-repository runs | identity rules, evidence globs (case, transforms, sub-projects, build/), dotless hosts, XML keys, mounts as flows, contradictions, badge overlap |

**Root cause analysis**
Fixtures and examples proved the mechanics, but they were written by the same hand as the rules, so they never challenged them. The five runs on real repositories found about twenty issues the fixtures could not: real heading styles, case and naming conventions, multi-solution layouts, documents that contradict each other, and shells that reject heredocs. Pattern-based checks (hosts, secrets, items) also failed in both directions until they were tested against what real files contain.

**What to do differently next time**
- [ ] Run a real-repository verification as soon as the first end-to-end path works (after Story 2), not only at the end.
- [ ] For every pattern-based check, write the "fails open" and the "matches too much" tests first, using real-world strings (versions, work-item IDs, product names, other key orders).
- [ ] Put Windows behaviour (interpreter resolution, console encoding, heredocs, path case) in the Tech Spec for any skill that shells out.
