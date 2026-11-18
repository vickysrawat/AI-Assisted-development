# Test Plan — /arch-diagram: Architecture / Recovery Diagram Generated from the Codebase
ADO #8001 · Release 3 · Sprint 14
Document type: QA Test Plan
Prepared: 2026-11-13
Status: DRAFT (temp — moved to `docs/Release3/Sprint14/UserStory8001/ADO-8001-arch-diagram.test-plan.md` at SAVE TECH)
Source: ICEA `ADO-8001-arch-diagram.icea.md` + Epic and Story 1–3 Tech Specs (`--source icea --subagent`)

<!-- test-plan-state
epic: ADO-8001
generated-by: test-plan --source icea --subagent
stories:
  - id: Story-1
    suite: "Suite 1"
    tech-spec: ADO-8001-Story-1-renderer.techspec.md
    status: generated
  - id: Story-2
    suite: "Suite 2"
    tech-spec: ADO-8001-Story-2-spec-generation.techspec.md
    status: generated
  - id: Story-3
    suite: "Suite 3"
    tech-spec: ADO-8001-Story-3-refresh-rollout.techspec.md
    status: generated
cross-cutting-suites-status: generated
refreshed-at: null
-->

---

## Overview

This plan covers the `/arch-diagram` epic. It has three parts: the renderer, scanner and skill scaffold (Story 1); spec generation from repository evidence (Story 2); and refresh mode plus the release (Story 3). Run the story suites in story order, because Story 2 depends on Story 1's renderer and scanner, and Story 3 depends on Story 2's generation steps. Run the Regression, Security and Non-Functional suites after all three stories are deployed.

Each TC cites its ICEA AC and, where one exists, the Tech Spec test ID it verifies, for example `S1 P-U3` = Story 1 Tech Spec, Positive Unit Test P-U3.

**Data rule for testers:** use only made-up identities in test data and defect reports. That means `contoso`, hosts under `*.example.com`, `*.example.org`, `*.test` or `*.invalid`, and IPs from RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`). Build any secret-looking value at runtime, for example a fake password value made by concatenating strings. Never paste one literally into a file that gets committed.

## Environment Requirements

| Item | Requirement |
|---|---|
| Plugin repository | Branch `feature/ADO-8001-arch-diagram`; `npm install` done |
| Node.js / npm | Version used by the plugin's `npm test` (jest) |
| Python | 3.10+ with `matplotlib` and `pyyaml` (`pip install matplotlib pyyaml`), for the "Python present" runs |
| Python-absent run | `ARCH_DIAGRAM_PYTHON=none`, plus one run with Python removed from `PATH` |
| Claude Code | Session with the plugin installed; `PLUGIN_DIR` resolvable from `.claude/plugin-path.txt` |
| Scratch target repos | Copies of `tests/fixtures/arch-diagram/{docker-compose-app,node-pm2-app,aws-ecs-app}/`, each `git init`-ed; one empty repo; one Kubernetes repo with `.claude/architecture/*.md` |
| Verification repos (AC-NF1) | Repositories that already have a hand-made diagram, confirmed by the developer per Open Question ❓[1]. Record names in the tracker only |
| Shell | Bash (Git Bash on Windows) |
| Image viewer | Any PNG viewer, for visual checks of rendered diagrams |

## Test Suites

| Suite | Title | When to run | Effort |
|---|---|---|---|
| Suite 1 | Renderer, scanner and skill scaffold (Story 1) | After Story 1 deploys | 120 min |
| Suite 2 | Spec generation — `/arch-diagram` (Story 2) | After Story 2 deploys | 180 min |
| Suite 3 | Refresh and rollout (Story 3) | After Story 3 deploys | 75 min |
| Suite 4 | Regression | After all stories; before release | 45 min |
| Suite 5 | Security | After all stories (SEC-01 to SEC-05 can run after Story 1) | 75 min |
| Suite 6 | Non-Functional | After Story 3 (NFR-03 needs the confirmed verification repos) | 120 min |

**Estimated total effort: ~10 hours for a full pass.**

---

## Suite 1 — Renderer, scanner and skill scaffold (Story 1)
> ACs: AC-F1, AC-F2, AC-F3, AC-F4, AC-F13, AC-F14, AC-NF3.
> Renders go to a temp directory. Each render may take up to 60 s (ADO-90 measured 7–18 s). In Story 1, `/arch-diagram` supports only `--spec <file>`.

### TC-RND-01 — Skill scaffold registers `/arch-diagram`
**Priority:** Critical
**Type:** CLI / Manual
**AC:** AC-F1 · Tech Spec: S1 INT-1

**Steps:**
1. On the feature branch, confirm `skills/arch-diagram/SKILL.md` exists. It was created by `scripts/new-skill.sh arch-diagram`.
2. Check that `_project-deploy/commands/arch-diagram.md`, `tests/skill-scenarios/arch-diagram.yaml`, the `.claude-plugin/plugin.json` skill entry and the `README.md` skill-table row all exist.
3. Run the plugin preflight.
4. In a scratch target project, type `/arch-diagram --spec <example spec>`.

**Expected:** All five artefacts exist. The preflight is green. The command resolves and runs in the target project.

### TC-RND-02 — Re-running the scaffold is refused
**Priority:** Medium
**Type:** CLI
**AC:** AC-F1 · Tech Spec: S1 N-U13

**Steps:**
1. Record `git status` and the hash of `skills/arch-diagram/SKILL.md`.
2. Run `scripts/new-skill.sh arch-diagram` again.

**Expected:** The script prints `❌ skills/arch-diagram/ already exists` and exits 1. `git status` and the SKILL.md hash are unchanged.

### TC-RND-03 — Dependency check passes when Python, matplotlib and pyyaml are present
**Priority:** High
**Type:** Manual (skill)
**AC:** AC-F2 · Tech Spec: S1 P-U11

**Steps:**
1. On a machine with Python ≥3.10, matplotlib and pyyaml, run `/arch-diagram --spec skills/arch-diagram/references/examples/docker-compose.yaml` in a scratch repo.

**Expected:** `DEP_MISSING` is not printed, and the skill continues to Step R0 (scan and host table).

### TC-RND-04 — Dependency check stops when a dependency is missing
**Priority:** Critical
**Type:** Manual (skill)
**AC:** AC-F2 · Tech Spec: S1 N-U9

**Steps:**
1. Take a snapshot of the scratch repo file list (`git status --porcelain` plus a listing of `docs/`).
2. Run `/arch-diagram` three times: (a) with Python off `PATH`, (b) in a virtualenv without matplotlib, (c) in a virtualenv without pyyaml.
3. Compare against the snapshot after each run.

**Expected:** Each run prints "Python 3.10+ with matplotlib and pyyaml is needed: `pip install matplotlib pyyaml`" and names the missing piece. The skill stops before reading any repository file. No file is created or changed.
**Fail condition:** The skill reads any target file (visible in the transcript) before the message, or anything appears under `docs/` or `temp/`.

### TC-RND-05 — All five example specs render cleanly with `--check`
**Priority:** Critical
**Type:** Automated (jest) + visual
**AC:** AC-F3, AC-F4 · Tech Spec: S1 P-U1

**Steps:**
1. For each of `kubernetes`, `azure-app-service`, `onprem-iis`, `docker-compose` and `node-server` in `skills/arch-diagram/references/examples/`, run `python scripts/architecture-diagram.py <spec> <tmp>/<name>.png --check`.
2. Open each PNG.

**Expected:** Every run exits 0, prints `check: ok` and writes a PNG larger than 10 KB, with no warnings. The PNGs show no overlapping boxes and no arrow crossing an unrelated box.

### TC-RND-06 — An ADO-90-format spec still renders unchanged
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-F3 · Tech Spec: S1 P-U2

**Steps:**
1. Render the made-up-name copy of the ADO-90 Azure example. It uses only the ADO-90 keys (`title`, `subtitle`, `width`, `zones[]`, components, `flows[]`) and no `todo` key.

**Expected:** Exit 0. No warnings on stderr. The layout matches the ADO-90 output for the same spec.

### TC-RND-07 — The 12 new type presets render
**Priority:** High
**Type:** Automated (jest) + visual
**AC:** AC-F3 · Tech Spec: S1 P-U3

**Steps:**
1. Render the preset-grid spec. It has one component each of `docker-host`, `compose-service`, `node-server`, `process-manager`, `reverse-proxy`, `linux-server`, `container-apps`, `aws-ecs`, `aws-lambda`, `aws-rds`, `s3` and `app-server`.
2. Open the PNG.

**Expected:** Exit 0 with no "unknown type" warning. Each box shows its tag from the preset table (for example "Amazon RDS", "Reverse proxy") in the colours of an existing family.

### TC-RND-08 — Spec mistake gives a one-line `spec error:` and no PNG
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F3 · Tech Spec: S1 N-U3

**Steps:**
1. Render a spec with a flow whose `to:` names an id that does not exist.

**Expected:** One line starting `spec error:` and exit 1. No PNG is written and no Python traceback is printed.

### TC-RND-09 — Unknown component type renders as a plain box
**Priority:** Medium
**Type:** Automated (jest)
**AC:** AC-F3 · Tech Spec: S1 N-U4

**Steps:**
1. Render a spec with one component of `type: mainframe` and a `tag`.

**Expected:** A warning line and exit 0. The component is drawn as a plain box with the spec's `tag`.

### TC-RND-10 — `--check` fails a crowded spec and lists the problems
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-F4 · Tech Spec: S1 N-U1

**Steps:**
1. Render a crowded spec (overlapping `span`, and a flow forced through an unrelated box) with `--check`.

**Expected:** Exit 1. At least one `check:` problem line, for example `check: overlap <a> / <b>` or `check: flow <badge> crosses <box>`, then the summary `check: N problems`. The PNG is still written.

### TC-RND-11 — `todo: true` renders as unverified, and the legend gains an entry
**Priority:** High
**Type:** Automated (jest) + visual
**AC:** AC-F14 · Tech Spec: S1 P-U4

**Steps:**
1. Render `node-server.yaml`, which has one `todo: true` component and one `todo: true` flow.
2. Load the module with `importlib` and call `legend_entries(zones, flows)`.
3. Open the PNG.

**Expected:** Exit 0 with no `Glyph … missing` warning. `legend_entries` includes "Unverified (⚠ TODO)". On the PNG, the TODO component has an amber dashed border and the "⚠ unverified" type label, the TODO flow is grey, and the legend shows the Unverified entry.

### TC-RND-12 — No `todo` items means no Unverified legend entry
**Priority:** Medium
**Type:** Automated (jest)
**AC:** AC-F14 · Tech Spec: S1 P-U5

**Steps:**
1. Call `legend_entries` on a spec without any `todo` key.

**Expected:** The result contains no "Unverified" entry.

### TC-RND-13 — A non-boolean `todo` value is a spec error
**Priority:** Medium
**Type:** Automated (jest)
**AC:** AC-F14 · Tech Spec: S1 N-U2

**Steps:**
1. Render a spec with `todo: "yes"` on a component.

**Expected:** `spec error: todo must be true or false (component <id>)`, exit 1, no PNG.

### TC-RND-14 — `isDocHost` accepts documentation hosts and IPs
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F13 · Tech Spec: S1 P-U6

**Steps:**
1. Call `isDocHost` with `api.contoso.example.com`, `db.test`, `192.0.2.10` and `localhost`.

**Expected:** All return `true`.

### TC-RND-15 — `isDocHost` rejects non-documentation hosts and IPs
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F13 · Tech Spec: S1 N-U5

**Steps:**
1. Call `isDocHost` with `db.contoso.local`, `app.example.net`, and an RFC 1918 private IPv4 address built at runtime in the test.

**Expected:** All return `false`.

### TC-RND-16 — `extractHosts` reports dotless server names and URL hosts
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F13 · Tech Spec: S1 P-U7

**Steps:**
1. Call `extractHosts` on text with `server: sqlsrv-contoso01` on line 1 and `url: https://a.b.example.org/x` on line 2.

**Expected:** Both are reported, with `line` 1 and 2 and `kind: 'host'`.

### TC-RND-17 — `extractHosts` ignores code identifiers, prose and file names
**Priority:** Medium
**Type:** Automated (jest)
**AC:** AC-F13 · Tech Spec: S1 N-U10, N-U8

**Steps:**
1. Call `extractHosts` on text with `e.g.`, `i.e.`, `process.env.PORT`, `module.exports`, `yaml.safe_load`, `!GetAtt Db.Endpoint.Address`, `config.yaml`, `package.json` and `ecosystem.config.js`.

**Expected:** Nothing is reported.

### TC-RND-18 — Strict mode catches country-code TLD hosts in YAML fences
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F13 · Tech Spec: S1 N-U14

**Steps:**
1. Put `orders.contoso.co.uk` inside a ```yaml fence in a temp `.md` file.
2. Run `extractHosts` with `strict: true`, then `isDocHost` on the result.

**Expected:** The host is reported and `isDocHost` returns `false`, so the allow-list check fails on this input.

### TC-RND-19 — Allow-list test passes on plugin files and fails when a real-style host is introduced
**Priority:** Critical
**Type:** Automated (jest) + manual mutation
**AC:** AC-F13 · Tech Spec: S1 P-U8

**Steps:**
1. Run the AC-F13 allow-list test over `skills/arch-diagram/**`, `tests/fixtures/arch-diagram/**`, `scripts/architecture-diagram.py` and `scripts/arch-spec-scan.cjs`.
2. In a throwaway copy of one fixture file, add a non-allow-listed host such as `db.contoso.local`. Re-run the test.
3. Revert the change.
4. Open `tests/architecture-diagram.test.cjs` and confirm it has no deny-list of real names.

**Expected:** Step 1 passes. Step 2 fails and names the file, line and host. After step 3 the test passes again. The test file holds only the allow-list (RFC 2606 suffixes and RFC 5737 ranges).

### TC-RND-20 — `npm test` passes without Python and reports the skip
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-NF3 · Tech Spec: S1 P-U9

**Steps:**
1. Run `ARCH_DIAGRAM_PYTHON=none npm test`.
2. Run `npm test` again with Python stripped from `PATH` (`PATH=$(echo "$PATH" | tr ':' '\n' | grep -vi python | paste -sd:) npm test`).

**Expected:** Both runs exit 0 and print "architecture-diagram: skipped — python/matplotlib not found". The renderer suite is skipped. The AC-F13 allow-list and scanner suites still run and pass.
**Fail condition:** A failure or error in any suite, or a silent skip with no notice.

### TC-RND-21 — `/arch-diagram --spec` renders a hand-written spec end to end
**Priority:** High
**Type:** Manual (skill)
**AC:** AC-F1, AC-F4 · Tech Spec: S1 INT-2

**Steps:**
1. In a scratch repo, run `/arch-diagram --spec skills/arch-diagram/references/examples/docker-compose.yaml`.
2. Review the host table, then approve at the Write Gate prompt.

**Expected:** The host table appears and the Write Gate names `docs/images/docker-compose-architecture.png`. After approval, the PNG is written at that path, `check: ok` is reported, and the PNG is shown in the session.

### TC-RND-22 — `/arch-diagram --spec` writes nothing on SKIP
**Priority:** High
**Type:** Manual (skill)
**AC:** AC-F1 · Tech Spec: S1 N-U12

**Steps:**
1. Write a spec by hand containing `server: sqlsrv-contoso01`.
2. Run `/arch-diagram --spec <that file>` and reply `SKIP` at the Write Gate prompt.

**Expected:** `sqlsrv-contoso01` appears in the host table. No PNG is written and `docs/images/` is unchanged.

---

## Suite 2 — Spec generation: `/arch-diagram` (Story 2)
> ACs: AC-F5, AC-F6, AC-F7, AC-F8, AC-F9, AC-F12, AC-NF2, plus the skill half of AC-F14.
> Copy each fixture to a scratch folder and `git init` it before running. For every scenario, also check the identity line, the TODO summary, the host table and the skipped-files list. Secret-handling scenarios are in Suite 5. The read-budget check is in Suite 6.

### TC-GEN-01 — `--sources` passes a spec where every item is sourced
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F6 · Tech Spec: S2 P-U1

**Steps:**
1. Run `checkSources` on a spec where every zone, component and flow start line has `# source: path[:line]`.

**Expected:** Returns `[]`.

### TC-GEN-02 — `--sources` accepts TODO items and `# manual` items
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F6 · Tech Spec: S2 P-U2, P-U3

**Steps:**
1. Run `checkSources` on an item with no source but with `todo: true` and a `⚠ TODO: …` detail.
2. Run `checkSources` on an item whose first line has `# manual`.

**Expected:** Both items pass (no gaps reported).

### TC-GEN-03 — `--sources` flags an unsourced item with its line number
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F6 · Tech Spec: S2 N-U1

**Steps:**
1. Run `checkSources` on a spec with one component that has no `# source:`, no `# manual` and no `todo`.

**Expected:** One gap, reporting the component's start line number.

### TC-GEN-04 — A `⚠ TODO` detail without `todo: true` is flagged
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F6, AC-F14 · Tech Spec: S2 N-U2

**Steps:**
1. Run `checkSources` on an item with a `⚠ TODO` detail but no `todo: true`.

**Expected:** The item is flagged, which keeps the D-1 unverified style from silently disappearing.

### TC-GEN-05 — Docker Compose fixture produces a Docker host diagram from code only
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F5 · Tech Spec: S2 P-U4

**Steps:**
1. Run `/arch-diagram` in the `docker-compose-app` scratch copy, which has no architecture docs.
2. Review the draft. Do not approve yet.

**Expected:** One zone "Docker host". `api` and `worker` are `compose-service`, postgres is `database` and nginx is `reverse-proxy`. Flows come from `depends_on`, ports and env key names, and each item carries `# source:`. The summary shows "no architecture docs — diagram drawn from code only; failover / backups ⚠ TODO".

### TC-GEN-06 — Node.js + PM2 fixture produces a Linux server with process manager
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F5 · Tech Spec: S2 P-U5

**Steps:**
1. Run `/arch-diagram` in the `node-pm2-app` scratch copy.

**Expected:** A `linux-server` container holds a `reverse-proxy` and a `process-manager`, and the process manager has one `node-server` child per PM2 app (2). The listen ports are cited as `ecosystem.config.js:{line}`.

### TC-GEN-07 — AWS fixture maps ECS, load balancer, RDS, S3 and pipeline
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F5 · Tech Spec: S2 P-U6

**Steps:**
1. Run `/arch-diagram` in the `aws-ecs-app` scratch copy.

**Expected:** The draft has `aws-ecs`, `load-balancer`, `aws-rds` and `s3` components, plus a pipeline from the GitHub Actions workflow. Each one cites its file and line.

### TC-GEN-08 — Empty repository falls back to a generic TODO box
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F5 · Tech Spec: S2 N-U3

**Steps:**
1. Run `/arch-diagram` in an empty `git init` repo named `contoso-empty`.

**Expected:** One `server` box named after the application, with `todo: true` and the detail `⚠ TODO: hosting not found — searched: {globs}`. The summary lists the evidence-map globs that were searched.

### TC-GEN-09 — Kubernetes repository end to end
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F5, AC-F6, AC-F7, AC-F8 · Tech Spec: S2 INT-1

**Steps:**
1. Use a Kubernetes repo that has `.claude/architecture/architecture-deployment.md` describing a primary and a failover site, k8s manifests (Deployment, Service, Ingress, Secret, PVC) and a pipeline YAML.
2. Run `/arch-diagram`, review the draft and approve.
3. Run `node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --sources <saved spec>`.

**Expected:** The draft has zones for the primary site, failover site, cloud identity, shared services, CI/CD and users. Every item has `# source:` (for example `k8s/deployment.yaml:{line}`) or a `⚠ TODO`. The TODO list includes items such as database backup schedule / retention, cited to the architecture doc. The host table is shown. After approval, the spec and PNG are written and `check: ok` is reported. Step 3 reports 0 gaps.

### TC-GEN-10 — Application identity comes from each of the four sources in order
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F12 · Tech Spec: S2 P-U7

**Steps:**
1. Prepare four scratch repos:
   (a) `.claude/architecture/architecture.md` titled `# Contoso Billing — Architecture`;
   (b) only a `CLAUDE.md` whose Project Overview starts "Contoso Ledger is a …";
   (c) only a `package.json` with `name: "orders-api"`;
   (d) none of these, in a folder named `contoso-folder-app`.
2. Run `/arch-diagram` in each and read the identity line and draft title.

**Expected:** (a) `Application: Contoso Billing (from architecture.md title)`; (b) `Contoso Ledger (from CLAUDE.md)`; (c) `orders-api (from package.json name)`; (d) `contoso-folder-app (from folder name)`. Each title is `{Name} — Architecture & Recovery` and each slug is derived from the name, for example `contoso-billing`.

### TC-GEN-11 — Identity falls through an untitled architecture doc to a scoped npm name
**Priority:** Medium
**Type:** Manual (skill scenario)
**AC:** AC-F12 · Tech Spec: S2 N-U9

**Steps:**
1. In a scratch repo, add `architecture.md` with no `# ` heading and a `package.json` with `name: "@contoso/orders-web"`.
2. Run `/arch-diagram`.

**Expected:** The identity line cites package.json, and the slug is `orders-web`.

### TC-GEN-12 — Display-name override changes the title and slug only
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F12 · Tech Spec: S2 P-U8

**Steps:**
1. In the repo from TC-GEN-10 (c), reply "call it Orders Platform" at the draft review.
2. Compare the re-shown draft with the original.

**Expected:** The title becomes `Orders Platform — Architecture & Recovery`. The Write Gate paths become `docs/architecture/diagram/orders-platform.arch.yaml` and `docs/images/orders-platform-architecture.png`. No other line of the draft changes.

### TC-GEN-13 — Approval writes the spec and PNG at the announced paths
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F8 · Tech Spec: S2 P-U9

**Steps:**
1. In the Docker fixture copy, run `/arch-diagram` and reply `APPROVE`.
2. Run `git status --porcelain`.

**Expected:** Exactly two new files: `docs/architecture/diagram/{slug}.arch.yaml` and `docs/images/{slug}-architecture.png`. `--check` runs and reports `check: ok`, and the PNG is shown.

### TC-GEN-14 — Nothing is written before approval (SKIP / no reply)
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F8 · Tech Spec: S2 N-U5

**Steps:**
1. Run `/arch-diagram` in a fixture copy. When the draft and Write Gate prompt appear, reply `SKIP`.
2. Run it again and end the session without replying.
3. Check `git status --porcelain`, and look under `docs/architecture/diagram/`, `docs/images/`, `temp/` and the OS temp folder for new spec files.

**Expected:** No new or changed file in any of these locations after either run. The draft only ever existed in the conversation.

### TC-GEN-15 — An existing spec blocks a plain run
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F8 · Tech Spec: S2 N-U6

**Steps:**
1. In the repo from TC-GEN-13, which already has a saved spec, run plain `/arch-diagram`.

**Expected:** "A spec already exists at …; run `/arch-diagram --refresh` to update it, or reply OVERWRITE to start again". No evidence is read (the dependency check is the only step before it) and nothing is written.

### TC-GEN-16 — Host table offers keep / mask, and a masked host is replaced
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F7 · Tech Spec: S2 P-U10

**Steps:**
1. Run `/arch-diagram` in the Node+PM2 fixture copy, which has no secrets.
2. In the host table, choose **mask** for `app.contoso.example.com`, then approve.
3. Open the saved spec and the PNG.

**Expected:** The scan passes. The host table lists `app.contoso.example.com` with keep / mask. In the saved spec and the PNG the host is replaced by `proxy-host` (`{role}-host`), and the original value appears nowhere in either.

### TC-GEN-17 — One layout revision fixes a crowded render
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F9 · Tech Spec: S2 P-U11

**Steps:**
1. Use a scenario whose generated spec overlaps on first render, where `span: 2` on the crowded zone fixes it. Approve the draft.
2. When `--check` exits 1, review the proposed revision and approve it.

**Expected:** The skill proposes exactly one layout change as a diff, using `span`, `columns`, `stack` or `row`. It re-renders only after approval and reports the final `check: ok`.

### TC-GEN-18 — No second automatic revision when the first one does not fix the render
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F9 · Tech Spec: S2 N-U7

**Steps:**
1. Use a spec that still fails `--check` after any single layout lever. Approve the draft and the one proposed revision.

**Expected:** The skill re-renders, reports the remaining `check:` problem list and keeps the PNG. It does not propose a second revision.
**Fail condition:** A second revision diff is offered, or a re-render happens without approval.

### TC-GEN-19 — Renderer `spec error:` leads to a spec fix, never a renderer edit
**Priority:** Medium
**Type:** Manual (skill scenario)
**AC:** AC-F9 · Tech Spec: S2 N-U8

**Steps:**
1. Use a scenario whose draft ends up with a dangling flow endpoint. Approve it.
2. Check `git diff` on the plugin's `scripts/architecture-diagram.py` afterwards.

**Expected:** The one-line `spec error:` is shown, and a fix to the generated spec is proposed as a diff and re-rendered only after approval. The renderer script is unchanged.

### TC-GEN-20 — Every `⚠ TODO` item in a generated spec carries `todo: true`
**Priority:** Medium
**Type:** Manual (spec line check)
**AC:** AC-F14, AC-F6 · Tech Spec: S2 Step 5 / `checkSources`

**Steps:**
1. For each spec saved in TC-GEN-05, TC-GEN-09 and TC-GEN-13, run `arch-spec-scan.cjs --sources <spec>`.
2. Count the `⚠ TODO` lines and the `todo: true` flags.
3. Open the matching PNGs.

**Expected:** 0 gaps. Every item with a `⚠ TODO` detail has `todo: true`. On the PNG those items have the amber dashed border, or grey if they are flows, and the legend shows "Unverified (⚠ TODO)". Every TODO appears in the skill's TODO summary.

---

## Suite 3 — Refresh and rollout (Story 3)
> ACs: AC-F10, AC-F11. AC-NF1 (verification) is in Suite 6.
> Set-up: generate and save a spec on the Docker fixture copy (TC-GEN-13). Mark one component `# manual` and change its details. Then add a new service to `docker-compose.yml`.

### TC-RFR-01 — A `# manual` entry is kept byte for byte
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 P-U1

**Steps:**
1. Run `/arch-diagram --refresh`.
2. Compare the `# manual` block in the shown draft with the saved spec.

**Expected:** The manual block is byte-identical: same text, same order, same formatting, children included. It is listed under **Kept (manual)**.

### TC-RFR-02 — Evidence changes show as Added / Removed / Changed
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 P-U2

**Steps:**
1. With the new compose service in place, and one existing service removed from `docker-compose.yml`, run `/arch-diagram --refresh`.

**Expected:** The diff is grouped as **Added** (the new service, with `# source:`), **Removed** (the deleted service) and **Changed**, followed by **Kept (manual)**, the TODO summary and the host table. A Write Gate prompt follows.

### TC-RFR-03 — Approving a refresh overwrites the spec and re-renders
**Priority:** High
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 P-U3

**Steps:**
1. Run `/arch-diagram --refresh` and reply `APPROVE`.

**Expected:** The spec file is overwritten and the PNG is re-rendered with `--check` (`check: ok`) and shown. If `--check` fails, the single-revision path from Story 2 applies.

### TC-RFR-04 — Refresh with no saved spec stops
**Priority:** Medium
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 N-U1

**Steps:**
1. In a fresh fixture copy with no saved spec, run `/arch-diagram --refresh`.

**Expected:** "No saved spec — run `/arch-diagram` first". The skill stops and nothing is written.

### TC-RFR-05 — SKIP on refresh leaves the spec and PNG untouched
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 N-U2

**Steps:**
1. Record SHA-256 hashes of the saved spec and PNG.
2. Run `/arch-diagram --refresh` and reply `SKIP`.
3. Recompute the hashes.

**Expected:** Both hashes are equal and no other file is created.

### TC-RFR-06 — Several saved specs: the skill lists them and asks
**Priority:** Medium
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 Error Handling (F1)

**Steps:**
1. Put two `*.arch.yaml` files under `docs/architecture/diagram/`.
2. Run `/arch-diagram --refresh`.

**Expected:** Both files are listed and the skill asks which one to refresh. It does not pick one.

### TC-RFR-07 — A `# manual` item that references a removed id is kept and flagged
**Priority:** Medium
**Type:** Manual (skill scenario)
**AC:** AC-F10 · Tech Spec: S3 Error Handling (F3)

**Steps:**
1. Mark a flow `# manual` whose `to:` component is then deleted from the evidence.
2. Run `/arch-diagram --refresh` and approve.

**Expected:** The flow appears under **Kept (manual)** with `⚠ references missing id {x}`. The render reports `spec error:` for the dangling endpoint and the Story 2 spec-fix path follows. The manual block is never changed without approval.

### TC-RFR-08 — `ARCH DIAGRAM` keywords trigger the skill
**Priority:** High
**Type:** Manual
**AC:** AC-F11 · Tech Spec: S3 P-U4

**Steps:**
1. Confirm `_project-deploy/CLAUDE.md` §0a has rows for `ARCH DIAGRAM` and `ARCH DIAGRAM --refresh`.
2. In a target project synced to 3.27.0, type `ARCH DIAGRAM` as plain text, without a slash.
3. Type `ARCH DIAGRAM --refresh`.

**Expected:** Both rows exist. Step 2 starts generate mode and step 3 starts refresh mode.

### TC-RFR-09 — Version 3.27.0 is consistent everywhere
**Priority:** Critical
**Type:** CLI
**AC:** AC-F11 · Tech Spec: S3 P-U5, INT-2

**Steps:**
1. Run `scripts/bump-version.sh 3.27.0`.
2. Run `node scripts/check-version-consistency.js`.
3. Run `npm test`.
4. Open `CHANGELOG.md`.

**Expected:** The consistency check exits 0 at 3.27.0 and `npm test` is green. `CHANGELOG.md` has a `## 3.27.0` entry covering the `/arch-diagram` skill, the renderer, the scanner and the Python prerequisite.

### TC-RFR-10 — The consistency check catches a stale version copy
**Priority:** Medium
**Type:** CLI
**AC:** AC-F11 · Tech Spec: S3 N-U4

**Steps:**
1. In a throwaway branch, set the `# Plugin version` line in `CLAUDE.md` back to 3.26.0.
2. Run `node scripts/check-version-consistency.js`.
3. Discard the change.

**Expected:** Exit 1, naming `CLAUDE.md`.

### TC-RFR-11 — No version string was hand-edited
**Priority:** Medium
**Type:** Manual (PR review)
**AC:** AC-F11 · Tech Spec: S3 DO NOT rules

**Steps:**
1. In the Story 3 PR diff, list every changed version string.
2. Compare the list against the files `bump-version.js` writes (`plugin.json`, README version header, HTML guide header, `CLAUDE.md` `# Plugin version` line).

**Expected:** Every version change is in a file `bump-version.js` writes. The plugin-root `CLAUDE.md` changes only on its version line and gains no keyword rows.

---

## Suite 4 — Regression
> Behaviour that existed before this epic must be unchanged. ACs cited are the ones whose change could cause the regression.

### TC-REG-01 — Existing test suites still pass with Python present
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-F3, AC-NF3

**Steps:**
1. On a machine with Python, matplotlib and pyyaml, run the full `npm test`.
2. Compare the pass count of the pre-existing suites with `main`.

**Expected:** All suites pass. The pre-existing suites have the same test count as on `main`, and the only additions are `architecture-diagram.test.cjs` and `arch-spec-scan.test.cjs`.

### TC-REG-02 — Skill registration did not disturb other skills
**Priority:** High
**Type:** CLI / Manual
**AC:** AC-F1

**Steps:**
1. Diff `.claude-plugin/plugin.json` against `main`.
2. Run the plugin preflight.
3. In a target project, invoke two unrelated skills (for example `/explain` and `/setup-status`).

**Expected:** The only `plugin.json` changes are the new skill entry and the version. The preflight is green and the other skills run as before.

### TC-REG-03 — Existing §0a keyword rows are unchanged after deployment
**Priority:** High
**Type:** Manual
**AC:** AC-F11

**Steps:**
1. Diff `_project-deploy/CLAUDE.md` against `main`.
2. Run `setup-sync` on a scratch target project. Trigger two existing keywords (for example `STATUS ADO-{ID}` and `SAVE TEST ADO-{ID}`).

**Expected:** The diff adds only the two `ARCH DIAGRAM` rows. The existing keywords still route to their skills in the synced target.

### TC-REG-04 — The hook re-sync from the version bump is as expected
**Priority:** Medium
**Type:** Manual (PR review)
**AC:** AC-F11

**Steps:**
1. Review the `.claude/hooks/` changes in the version-bump commit.

**Expected:** The hooks match `_project-deploy/hooks/` byte for byte (ADR 0009 re-sync), and no hook logic is changed by this epic.

### TC-REG-05 — A run in a target repo changes nothing except the two output files
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F8

**Steps:**
1. In the Kubernetes repo, commit a clean baseline. Run `/arch-diagram` and approve.
2. Run `git status --porcelain` and `git diff --stat`.
3. Check for new or changed files outside the repo, for example the parent folder and the OS temp folder.

**Expected:** Only `docs/architecture/diagram/{slug}.arch.yaml` and `docs/images/{slug}-architecture.png` are new. No source, deployment manifest or dependency file (`package.json`, `requirements*.txt`, `pyproject.toml`, `*.csproj`) is changed, and nothing is written outside the repo.

### TC-REG-06 — `architect`, `operations` and `go-live` are untouched
**Priority:** Medium
**Type:** Manual (PR review)
**AC:** AC-F1

**Steps:**
1. Run `git diff main --stat -- skills/architect skills/operations skills/go-live`.

**Expected:** No changes.

### TC-REG-07 — Saved specs keep rendering after rolling back Story 3
**Priority:** Medium
**Type:** CLI
**AC:** AC-F10, AC-F3

**Steps:**
1. Take a saved spec that contains a `# manual` entry.
2. Render it with `python scripts/architecture-diagram.py <spec> <tmp>.png --check` on a build without Story 3 (Story 2 head).

**Expected:** Exit 0. `# manual` is treated as a plain comment and the diagram renders.

---

## Suite 5 — Security
> Secret handling, host disclosure, and the boundary on what is read or run. All secret-looking inputs are built at runtime or described. None is stored literally.

### TC-SEC-01 — YAML `password:` value is detected with its line number
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-F7 · Tech Spec: S1 N-U6

**Steps:**
1. Call `scanSecrets` on YAML text where a `password:` key holds a runtime-built fake password value, on line 3.

**Expected:** 1 finding, `label: 'password'`, `line: 3`.

### TC-SEC-02 — `client_secret:` and connection-string password are both detected
**Priority:** Critical
**Type:** Automated (jest)
**AC:** AC-F7 · Tech Spec: S1 N-U7

**Steps:**
1. Call `scanSecrets` on text with a `client_secret:` key holding a runtime-built fake value and a `Server=…;Password=…` connection string with a runtime-built fake password.

**Expected:** 2 findings, labelled `secret/token/key` and `connection string` / `password`, each on its correct line.

### TC-SEC-03 — Prefixed key names are caught
**Priority:** High
**Type:** Automated (jest)
**AC:** AC-F7 · Tech Spec: S1 N-U11

**Steps:**
1. Call `scanSecrets` on `SESSION_SIGNING_SECRET=` followed by a runtime-built fake value.

**Expected:** 1 finding.

### TC-SEC-04 — Key names without values are not findings
**Priority:** Medium
**Type:** Automated (jest)
**AC:** AC-F7 · Tech Spec: S1 P-U10

**Steps:**
1. Call `scanSecrets` on a spec that lists `DB_PASSWORD` as a name only (for example in a `details:` line), and on placeholders such as `{{ … }}`, `<…>`, `***` and `changeme`.

**Expected:** No findings.

### TC-SEC-05 — `--stdin` scanning leaves nothing on disk
**Priority:** High
**Type:** CLI
**AC:** AC-F7, AC-F8 · Tech Spec: S1 P-U12

**Steps:**
1. Pipe a clean spec into `node scripts/arch-spec-scan.cjs --stdin --secrets --hosts`.
2. List the files in the working directory and the OS temp folder before and after.

**Expected:** Exit 0 and the host list is printed. No file is created anywhere.

### TC-SEC-06 — A secret value in `.env.example` never reaches the draft
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F7 · Tech Spec: S2 N-U4

**Steps:**
1. In the Docker fixture copy, make sure `.env.example` holds a fake secret value (the fixture's value uses a key form the commit gate tolerates).
2. Run `/arch-diagram`. Search the draft and the whole chat transcript for the value.
3. Ask the session to insert that value into a component's `details` (a simulated slip), then let the skill continue.

**Expected:** Step 2: the key name may appear, but the value never does. Step 3: the save is blocked with `❌ BLOCKED — secret pattern ({label}) at spec line N`, with no approval path. The skill removes the value and re-scans. Nothing is written while the block stands.
**Fail condition:** The value appears anywhere in the chat, or any file is written while a match exists.

### TC-SEC-07 — `.env` and secret values are never opened
**Priority:** Critical
**Type:** Manual (transcript review)
**AC:** AC-F7

**Steps:**
1. In the Kubernetes repo, add a `.env` file with a runtime-generated fake value, alongside the existing k8s `Secret` manifest and a Key Vault reference.
2. Run `/arch-diagram`. Review every Read / Grep tool call in the transcript.

**Expected:** `.env` is never read. Only `.env.example` and templates are. For the Secret manifest and the vault reference, only names appear in the draft and summary (secret name, key name, vault name). No `data:` value is quoted.

### TC-SEC-08 — A secret inside a `# manual` block blocks a refresh
**Priority:** Critical
**Type:** Manual (skill scenario)
**AC:** AC-F10, AC-F7 · Tech Spec: S3 N-U3

**Steps:**
1. Add a runtime-built fake password value to a `# manual` item's details in a saved spec.
2. Run `/arch-diagram --refresh`.

**Expected:** `❌ BLOCKED — secret pattern … line N` before the diff is offered for approval. The saved spec and PNG are unchanged.

### TC-SEC-09 — `--spec` mode scans before it renders
**Priority:** High
**Type:** Manual (skill)
**AC:** AC-F7, AC-F1 · Tech Spec: S1 Steps R0–R3

**Steps:**
1. Write a spec by hand that contains a runtime-built fake token value.
2. Run `/arch-diagram --spec <file>`.

**Expected:** `❌ BLOCKED — secret pattern ({label}) at spec line N`. The skill stops and no PNG is rendered.

### TC-SEC-10 — The renderer never builds objects from YAML
**Priority:** High
**Type:** CLI
**AC:** AC-F3

**Steps:**
1. Render a spec that contains a Python-specific YAML tag (for example `!!python/object/apply:` with a harmless callable such as `os.getcwd`).

**Expected:** The run ends with `spec error:` or a YAML load error, exit 1, no traceback. The tag is not evaluated (`yaml.safe_load` only), and nothing from the spec or the target repository is executed.

### TC-SEC-11 — Test files contain no literal secret-looking strings
**Priority:** Medium
**Type:** Manual + commit gate
**AC:** AC-F7, AC-F13

**Steps:**
1. Run the commit gate (`validate-governance.cjs` secret patterns) and `arch-spec-scan.cjs --secrets` over `tests/arch-spec-scan.test.cjs`, `tests/architecture-diagram.test.cjs` and `tests/fixtures/arch-diagram/**`.

**Expected:** 0 findings. Fake secrets in the tests are built at runtime by concatenating strings.

---

## Suite 6 — Non-Functional
> Read budget, fidelity against a hand-made diagram, and render time.

### TC-NFR-01 — Read budget: at most 15 files per role, and skipped files listed
**Priority:** Critical
**Type:** Manual (transcript review)
**AC:** AC-NF2 · Tech Spec: S2 INT-2

**Steps:**
1. Run `/arch-diagram` on the largest available verification repository.
2. In the session transcript, count the Read calls per evidence-map role.
3. Compare the matched globs with the files read.

**Expected:** No role has more than 15 Read calls. Every matched file that was not read appears under "Skipped (cap)" in the Step 7 summary. Files are read only through evidence-map globs, never by walking the whole tree.
**Fail condition:** Any role over 15, or a file that matched but was neither read nor listed.

### TC-NFR-02 — Excluded folders are never read
**Priority:** High
**Type:** Manual (transcript review)
**AC:** AC-NF2

**Steps:**
1. In a fixture copy, add files that match evidence globs under `node_modules/`, `bin/`, `obj/`, `dist/`, a vendored folder and a `.gitignore`-d folder, for example `node_modules/x/docker-compose.yml` and `dist/k8s/deploy.yaml`.
2. Run `/arch-diagram`.

**Expected:** None of those paths is read or cited. They do not count toward the per-role cap.

### TC-NFR-03 — Generated diagram reproduces a hand-made diagram
**Priority:** Critical
**Type:** Manual (side-by-side review)
**AC:** AC-NF1 · Tech Spec: S3 INT-1

**Steps:**
1. For each verification repository the developer confirmed (❓[1]), run `/arch-diagram` and approve.
2. Put the generated PNG next to the existing hand-made diagram.
3. Fill one table per repository in the tracker: item · in hand-made · in generated · ✅/❌, for every zone, component and flow. Record counts and pass/fail only, with no hostnames.
4. For hosting models with no confirmed repository, run against the Story 2 fixtures and mark them "fixture-verified".

**Expected:** Every zone, component and flow of each hand-made diagram is present in the generated one. Any extra item is either cited (`# source:`) or `⚠ TODO`. The tracker records the results without naming hosts, and no plugin file names the verification repositories.
**Fail condition:** Any ❌ row for an item in the hand-made diagram.

### TC-NFR-04 — Render time stays within the test timeout
**Priority:** Medium
**Type:** Performance
**AC:** AC-F3

**Steps:**
1. Time `python scripts/architecture-diagram.py <spec> <tmp>.png --check` for each of the five example specs and for the largest generated spec from TC-NFR-03.

**Expected:** Each render finishes within 60 s, the jest per-case timeout. The examples should be roughly in the ADO-90 baseline range of 7–18 s.

---

## Test Execution Tracker
| TC ID | Suite | Priority | Tester | Date | Status | Notes |
|---|---|---|---|---|---|---|
| TC-RND-01 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-02 | Suite 1 | Medium | | | ⬜ | |
| TC-RND-03 | Suite 1 | High | | | ⬜ | |
| TC-RND-04 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-05 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-06 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-07 | Suite 1 | High | | | ⬜ | |
| TC-RND-08 | Suite 1 | High | | | ⬜ | |
| TC-RND-09 | Suite 1 | Medium | | | ⬜ | |
| TC-RND-10 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-11 | Suite 1 | High | | | ⬜ | |
| TC-RND-12 | Suite 1 | Medium | | | ⬜ | |
| TC-RND-13 | Suite 1 | Medium | | | ⬜ | |
| TC-RND-14 | Suite 1 | High | | | ⬜ | |
| TC-RND-15 | Suite 1 | High | | | ⬜ | |
| TC-RND-16 | Suite 1 | High | | | ⬜ | |
| TC-RND-17 | Suite 1 | Medium | | | ⬜ | |
| TC-RND-18 | Suite 1 | High | | | ⬜ | |
| TC-RND-19 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-20 | Suite 1 | Critical | | | ⬜ | |
| TC-RND-21 | Suite 1 | High | | | ⬜ | |
| TC-RND-22 | Suite 1 | High | | | ⬜ | |
| TC-GEN-01 | Suite 2 | High | | | ⬜ | |
| TC-GEN-02 | Suite 2 | High | | | ⬜ | |
| TC-GEN-03 | Suite 2 | High | | | ⬜ | |
| TC-GEN-04 | Suite 2 | High | | | ⬜ | |
| TC-GEN-05 | Suite 2 | Critical | | | ⬜ | |
| TC-GEN-06 | Suite 2 | High | | | ⬜ | |
| TC-GEN-07 | Suite 2 | High | | | ⬜ | |
| TC-GEN-08 | Suite 2 | High | | | ⬜ | |
| TC-GEN-09 | Suite 2 | Critical | | | ⬜ | |
| TC-GEN-10 | Suite 2 | High | | | ⬜ | |
| TC-GEN-11 | Suite 2 | Medium | | | ⬜ | |
| TC-GEN-12 | Suite 2 | High | | | ⬜ | |
| TC-GEN-13 | Suite 2 | Critical | | | ⬜ | |
| TC-GEN-14 | Suite 2 | Critical | | | ⬜ | |
| TC-GEN-15 | Suite 2 | High | | | ⬜ | |
| TC-GEN-16 | Suite 2 | High | | | ⬜ | |
| TC-GEN-17 | Suite 2 | High | | | ⬜ | |
| TC-GEN-18 | Suite 2 | High | | | ⬜ | |
| TC-GEN-19 | Suite 2 | Medium | | | ⬜ | |
| TC-GEN-20 | Suite 2 | Medium | | | ⬜ | |
| TC-RFR-01 | Suite 3 | Critical | | | ⬜ | |
| TC-RFR-02 | Suite 3 | High | | | ⬜ | |
| TC-RFR-03 | Suite 3 | High | | | ⬜ | |
| TC-RFR-04 | Suite 3 | Medium | | | ⬜ | |
| TC-RFR-05 | Suite 3 | Critical | | | ⬜ | |
| TC-RFR-06 | Suite 3 | Medium | | | ⬜ | |
| TC-RFR-07 | Suite 3 | Medium | | | ⬜ | |
| TC-RFR-08 | Suite 3 | High | | | ⬜ | |
| TC-RFR-09 | Suite 3 | Critical | | | ⬜ | |
| TC-RFR-10 | Suite 3 | Medium | | | ⬜ | |
| TC-RFR-11 | Suite 3 | Medium | | | ⬜ | |
| TC-REG-01 | Suite 4 | Critical | | | ⬜ | |
| TC-REG-02 | Suite 4 | High | | | ⬜ | |
| TC-REG-03 | Suite 4 | High | | | ⬜ | |
| TC-REG-04 | Suite 4 | Medium | | | ⬜ | |
| TC-REG-05 | Suite 4 | Critical | | | ⬜ | |
| TC-REG-06 | Suite 4 | Medium | | | ⬜ | |
| TC-REG-07 | Suite 4 | Medium | | | ⬜ | |
| TC-SEC-01 | Suite 5 | Critical | | | ⬜ | |
| TC-SEC-02 | Suite 5 | Critical | | | ⬜ | |
| TC-SEC-03 | Suite 5 | High | | | ⬜ | |
| TC-SEC-04 | Suite 5 | Medium | | | ⬜ | |
| TC-SEC-05 | Suite 5 | High | | | ⬜ | |
| TC-SEC-06 | Suite 5 | Critical | | | ⬜ | |
| TC-SEC-07 | Suite 5 | Critical | | | ⬜ | |
| TC-SEC-08 | Suite 5 | Critical | | | ⬜ | |
| TC-SEC-09 | Suite 5 | High | | | ⬜ | |
| TC-SEC-10 | Suite 5 | High | | | ⬜ | |
| TC-SEC-11 | Suite 5 | Medium | | | ⬜ | |
| TC-NFR-01 | Suite 6 | Critical | | | ⬜ | |
| TC-NFR-02 | Suite 6 | High | | | ⬜ | |
| TC-NFR-03 | Suite 6 | Critical | | | ⬜ | |
| TC-NFR-04 | Suite 6 | Medium | | | ⬜ | |

**Legend:** ⬜ Not run · ✅ Pass · ❌ Fail · ⚠ Blocked · ➡ Deferred

---

## AC Coverage Summary

| AC | Story | TCs |
|---|---|---|
| AC-F1 | 1 | RND-01, RND-02, RND-21, RND-22, REG-02, REG-06, SEC-09 |
| AC-F2 | 1 | RND-03, RND-04 |
| AC-F3 | 1 | RND-05, RND-06, RND-07, RND-08, RND-09, REG-01, REG-07, SEC-10, NFR-04 |
| AC-F4 | 1 | RND-05, RND-10, RND-21 |
| AC-F13 | 1 | RND-14, RND-15, RND-16, RND-17, RND-18, RND-19, SEC-11 |
| AC-F14 | 1 (render) / 2 (skill) | RND-11, RND-12, RND-13, GEN-04, GEN-20 |
| AC-NF3 | 1 | RND-20, REG-01 |
| AC-F5 | 2 | GEN-05, GEN-06, GEN-07, GEN-08, GEN-09 |
| AC-F6 | 2 | GEN-01, GEN-02, GEN-03, GEN-04, GEN-09, GEN-20 |
| AC-F7 | 2 | GEN-09, GEN-16, SEC-01 to SEC-09, SEC-11 |
| AC-F8 | 2 | GEN-09, GEN-13, GEN-14, GEN-15, REG-05, SEC-05 |
| AC-F9 | 2 | GEN-17, GEN-18, GEN-19 |
| AC-F12 | 2 | GEN-10, GEN-11, GEN-12 |
| AC-NF2 | 2 | NFR-01, NFR-02 |
| AC-F10 | 3 | RFR-01 to RFR-07, REG-07, SEC-08 |
| AC-F11 | 3 | RFR-08, RFR-09, RFR-10, RFR-11, REG-03, REG-04 |
| AC-NF1 | 3 | NFR-03 |

All 17 ICEA ACs are covered, and every TC cites at least one AC.

---

## Exit Criteria

### Minimum for each story to close
- [ ] **Story 1:** every Suite 1 Critical TC has passed (RND-01, RND-04, RND-05, RND-06, RND-10, RND-19, RND-20), and SEC-01 and SEC-02 have passed
- [ ] **Story 2:** every Suite 2 Critical TC has passed (GEN-05, GEN-09, GEN-13, GEN-14), and SEC-06, SEC-07 and NFR-01 have passed
- [ ] **Story 3:** every Suite 3 Critical TC has passed (RFR-01, RFR-05, RFR-09), and SEC-08 has passed
- [ ] Zero open Critical defects against the story

### Minimum for the epic (release 3.27.0)
- [ ] All Critical TCs in all six suites passed
- [ ] Zero open Critical or High defects
- [ ] **Hard gate:** TC-RND-20 passes. `npm test` is green both with Python and without it (`ARCH_DIAGRAM_PYTHON=none` and Python stripped from `PATH`)
- [ ] **Hard gate:** TC-RND-19 passes. The AC-F13 allow-list finds no real hostname or IP in any plugin file this epic adds
- [ ] **Hard gate:** TC-RFR-09 passes. `check-version-consistency.js` exits 0 at 3.27.0
- [ ] **Hard gate:** TC-NFR-03 has a signed-off side-by-side table in the tracker for each verification repository, recorded with counts and pass/fail only
- [ ] **Hard gate:** TC-SEC-06 and TC-SEC-07 pass. No secret value appears in any draft, saved spec, PNG or chat transcript
