# ICEA — /arch-diagram: Architecture / Recovery Diagram Generated from the Codebase
ADO #8001 · Release 3 · Sprint 14
Status: COMPLETE · EPIC · 13 SP (approved 2026-11-13; implemented 2026-11-16)

---

## Intent

### Goal
Give every plugin-instrumented application one command, `/arch-diagram`. It reads the application's architecture documents and deployment files, drafts a diagram spec in which every item can be traced to a file, and renders a PNG after the developer reviews the draft. It works on any hosting model.

### Problem Statement
Teams need an architecture / technical recovery diagram for DR plans, runbooks and go-live reviews, and they draw it by hand or hard-code it in a script.
- A generic, spec-driven renderer now exists, but its spec is still hand-written. A team with no spec and no example cannot get a diagram.
- The facts the diagram needs already sit in `.claude/architecture/*.md` (written by `architect`) and in the deployment files.

Success means:
- On a verification repository that already has a hand-made diagram, a run reproduces that diagram's zones, components and flows without a hand-written spec.
- Every item in every generated spec has a source or a `⚠ TODO`.
- Nothing in the plugin names a specific application: the application name, title, file names and hosts all come from the target repository.

### Business Impact
- Hand-drawn diagrams cost each application team hours per DR or go-live cycle, and they go stale silently.
- A wrong diagram in a DR plan misleads the people carrying out a recovery.
- Generated, evidence-backed diagrams look the same across applications, and refresh mode keeps them current at almost no cost.

### Story
As a developer or tech lead of any application using the plugin, I want `/arch-diagram` to read my codebase and architecture documents and draw my application's architecture and recovery diagram, so that I get an accurate, evidence-backed diagram without hand-writing a layout or a spec, whatever the hosting model.

### Success Metrics
- On a verification repository with an existing hand-made diagram, the saved spec and PNG contain every zone, component and flow of that diagram (side-by-side review).
- The plugin files added by this ADO contain no real application names, organisation names, hostnames or IPs (grep check); the example specs use made-up names such as `contoso` and `example.com`.
- Every zone, component and flow line in every verification run has a `# source:` comment or a `⚠ TODO` detail line, with 0 exceptions.
- Every saved spec passes the secret scan with 0 findings.
- Every rendered PNG passes the layout and routing checks: 0 overlaps and 0 arrows crossing an unrelated box.

---

## Context

### Personas
**Developer:**
- Owns an application hosted on Kubernetes, Docker, a Node.js server, a Linux VM, Azure or AWS PaaS, or on-prem IIS.
- Has the plugin installed and has usually run `architect`.
- Wants the DR or runbook diagram with little effort, and is frustrated by hand-drawing it and by diagrams going stale.
- Success: one command, one review, a PNG.

**Tech Lead / Architect:**
- Reviews DR plans across several applications.
- Wants diagrams that match what is actually deployed, and is frustrated by boxes nobody can find in the code.
- Success: every box and arrow cites a file, and gaps are visible as `⚠ TODO`.

### System Context
| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Skill | `skills/arch-diagram/SKILL.md` | new | Scaffolded by `scripts/new-skill.sh`. Steps: dependency check → resolve application identity → collect evidence → classify by role → draft spec with sources → secret scan + hostname list → draft review → save → render → post-render checks → optional layout revision. Refresh mode `--refresh` |
| Skill ref | `skills/arch-diagram/references/app-identity.md` | new | Order the skill uses to find the application name: (1) title of `.claude/architecture/architecture.md`, (2) project name in the target's `CLAUDE.md` § Project Overview, (3) the manifest name — `package.json` `name`, `*.csproj` `AssemblyName`/file name, `pyproject.toml` `[project].name`, `pom.xml` `artifactId`, `go.mod` module — (4) the repository folder name. The file-name slug and the diagram title (`{App name} — Architecture & Recovery`) are derived from it; the developer can override both in the draft |
| Skill ref | `skills/arch-diagram/references/evidence-map.md` | new | Table of hosting model → evidence file globs → roles → component types. Adding a hosting model means adding a row |
| Skill ref | `skills/arch-diagram/references/spec-format.md` | new | Spec keys, zone styles, flow kinds, `stack`, `# source:` and `# manual` comment conventions |
| Skill ref | `skills/arch-diagram/references/examples/{kubernetes,azure-app-service,onprem-iis,docker-compose,node-server}.yaml` | new | Made-up applications only (`contoso`, `*.example.com`, RFC 5737 documentation IPs). The Kubernetes example is a sanitised rewrite of the ADO-90 source example with every real name, host and server removed; two new examples cover Docker Compose and Node.js + PM2 |
| Script | `scripts/architecture-diagram.py` | new (moved) + modify | Generic renderer from ADO-90 (it already contains no application names); adds the Must Have 9 type presets; adds `--check` (runs the overlap and routing checks, exit 1 on problems) for the skill's post-render step |
| Command | `_project-deploy/commands/arch-diagram.md` | new | Stub created by `new-skill.sh` |
| Config | `.claude-plugin/plugin.json` | modify | Skill registration (`new-skill.sh`); version 3.27.0 (`bump-version.sh`) |
| Docs | `_project-deploy/CLAUDE.md` §0a | modify | Keywords `ARCH DIAGRAM` and `ARCH DIAGRAM --refresh` |
| Docs | `CHANGELOG.md`, `README.md` | modify | Release entry; skill table row |
| Test | `tests/skill-scenarios/arch-diagram.yaml` | new | Scenarios: Kubernetes, Docker-only fixture, Node.js+PM2 fixture, unknown hosting, secret in env template, refresh with a `# manual` entry |
| Test | `tests/fixtures/arch-diagram/{docker-compose-app,node-pm2-app,aws-ecs-app}/` | new | Small made-up repositories with deployment files only and no real hostnames (Should Have) |
| Test | `tests/architecture-diagram.test.cjs` | new | Runs the Python script on the examples and broken specs through `child_process.execFile`; skips with a notice when Python or matplotlib is absent |

### Constraint Context
| Constraint | Type | Bounds the solution how? |
|---|---|---|
| Plugin scripts are CommonJS (`.cjs`); this adds the first Python script | technical | The Python dependency is accepted by the developer (2026-11-13). The skill must check for Python first and stop with install steps; Node tests must skip cleanly without Python |
| Write Gate (`skills/shared/write-gate-spec.md`) | process | The generated spec is a docs/config artefact in the target application: show it, secret-scan it, write it only after approval |
| No invented facts (same rule as `operations`) | quality | Every item cites evidence or carries `⚠ TODO`; this is what the critic checks |
| No secret values in output | security | Read settings files for key names only; scan the draft before save; flag internal hostnames and IPs |
| Context budget in large repositories | technical | Evidence is read by glob from the evidence map, with a cap on files per role; skipped files are listed in the summary |
| Renderer contract from ADO-90 | technical | Spec keys and behaviour stay backward compatible; specs written for the ADO-90 renderer must still render |
| No application-specific content in the plugin | quality | The skill, references, examples, tests and fixtures never contain a real application's name, organisation, hostnames or IPs; all identity comes from the target repository at run time (`references/app-identity.md`) |

### Change Tier
**T2.** One new skill, one moved and extended script, references, tests and housekeeping. The skill reads the target repository and writes only docs/images files after approval. There are no hooks, no changes to shared ledger schemas and no external network calls. Removing the skill directory and its registration reverses it.

---

## Examples

### Happy Path — Kubernetes application

| Given | When | Then (observable outcome) |
|---|---|---|
| A target repository whose `package.json` `name` is `orders-api` and has no architecture title; `.claude/architecture/architecture-deployment.md` describes a primary and a failover site; k8s manifests (Deployment, Service, Ingress, Secret, PVC) and a pipeline YAML exist; Python + matplotlib + PyYAML installed | Developer runs `/arch-diagram` | The skill reports "Application: orders-api (from package.json name)" and shows a draft spec titled `orders-api — Architecture & Recovery`. It has zones for the primary site, failover site, cloud identity, shared services, CI/CD and users, and every item carries `# source:` (for example `# source: k8s/deployment.yaml:12`). It also shows a TODO list (for example "Database backups — schedule / retention: ⚠ TODO", sourced from the architecture document) and the list of internal hostnames found |
| Draft shown | Developer approves | `docs/architecture/diagram/orders-api.arch.yaml` and `docs/images/orders-api-architecture.png` are written; `--check` reports 0 problems; the skill shows the PNG |
| Draft shown | Developer replies with a different display name ("Orders Platform") | The title becomes `Orders Platform — Architecture & Recovery` and the file names become `orders-platform.arch.yaml` / `orders-platform-architecture.png`; nothing else changes |

### Edge Cases

| Given | When | Then (expected behaviour) |
|---|---|---|
| Repository with only `Dockerfile` + `docker-compose.yml` (api, worker, postgres, redis, nginx) and no architecture docs | `/arch-diagram` | One zone "Docker host" with the compose services as `compose-service`, postgres as `database`, nginx as `reverse-proxy`; flows taken from `depends_on`, ports and env key names; a summary line "no architecture docs — diagram drawn from code only; failover / backups ⚠ TODO" |
| Node.js application run by PM2 behind nginx on a Linux VM (`ecosystem.config.js`, `/etc/nginx` snippet in `deploy/`) | `/arch-diagram` | `linux-server` container holding a `reverse-proxy` and a `process-manager` with one `node-server` child per PM2 app; listen ports cited from `ecosystem.config.js` |
| No recognisable hosting evidence | `/arch-diagram` | Generic `server` box named after the application, with hosting `⚠ TODO`; the summary lists the evidence-map file globs that were searched |
| A saved spec contains an entry marked `# manual` | `/arch-diagram --refresh` | The diff shows added, removed and changed evidence-backed items; the `# manual` entry is kept unchanged; nothing is written until the developer approves |
| Rendering reports a `no clear path` warning or overlaps | Post-render check | The skill proposes one layout change (for example `span: 2` on a crowded zone or a `stack`) with its diff, re-renders after approval, and reports the result |

### Error States

| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| Python or matplotlib not installed | `/arch-diagram` | Stops before reading the repository: "Python 3.10+ with matplotlib and pyyaml is needed: `pip install matplotlib pyyaml`". Nothing is written |
| `.env.example` / `appsettings.json` contains a real-looking secret value | Draft spec built | Values are never copied; if the secret scan still matches the draft, save is blocked: "❌ BLOCKED — secret pattern at spec line N"; the developer must remove it |
| The renderer exits with `spec error:` | Render step | The skill shows the one-line error, fixes the spec it generated (shown as a diff) and asks for approval before re-rendering; it never edits the renderer script |
| The target already has a spec, and the developer runs plain `/arch-diagram` | Start | "A spec already exists at …; run `/arch-diagram --refresh` to update it, or reply OVERWRITE to start again" |

### Permission Boundary (mandatory)

| Given | When | Then (observable outcome) |
|---|---|---|
| Draft spec shown, no approval reply yet | The skill reaches the save step | Nothing is written to `docs/architecture/diagram/` or `docs/images/`; the Write Gate prompt is shown |
| Evidence includes Kubernetes Secret manifests, `.env` or Key Vault references | Evidence collection | Only names are read (secret name, key name, vault name); values are never read into the spec or the summary; `.env` itself is not opened, only `.env.example` / templates |
| `/arch-diagram` running in a target application | Any step | The skill never writes outside the target repository and never modifies application source, deployment manifests or dependency files |

---

## Acceptance

### Acceptance Criteria

- [ ] AC-F1: `/arch-diagram` is registered and runnable from any target project: skill, command stub, `plugin.json` entry, README row and scenario file all exist — verified by `new-skill.sh` output and the plugin preflight
- [ ] AC-F2: The skill stops before evidence collection with install guidance when `python`, `matplotlib` or `pyyaml` is missing, and writes nothing — verified by a scenario with each one missing
- [ ] AC-F3: `scripts/architecture-diagram.py` renders the example specs, and a spec written for the ADO-90 renderer still renders unchanged, and it renders the new presets: `docker-host`, `compose-service`, `node-server`, `process-manager`, `reverse-proxy`, `linux-server`, `container-apps`, `aws-ecs`, `aws-lambda`, `aws-rds`, `s3`, `app-server` — verified by `tests/architecture-diagram.test.cjs`
- [ ] AC-F14 (D-1 Option A): A component or flow with `todo: true` renders visibly unverified — amber dashed border and "⚠ unverified" label for components, grey line for flows — and the legend gains an "Unverified (⚠ TODO)" entry only when such items exist; every item the skill marks `⚠ TODO` also gets `todo: true` — verified by a renderer test and a scenario spec line check
- [ ] AC-F4: `architecture-diagram.py --check` exits 0 when there are no overlaps, no arrow crossing an unrelated box and no `no clear path` warning, and exits 1 listing the problems otherwise — verified by tests with one clean spec and one crowded spec
- [ ] AC-F5: Evidence collection follows `references/evidence-map.md`. Kubernetes, Docker/Compose, Node.js server, Linux VM, Azure PaaS, AWS, IIS/Windows, Java app server, other PaaS and CI/CD rows each map file globs to roles and types; unrecognised hosting falls back to generic boxes with hosting `⚠ TODO` — verified by scenarios (Kubernetes repository, Docker fixture, Node+PM2 fixture, AWS fixture, empty repository)
- [ ] AC-F6: Every zone, component and flow in a generated spec has a `# source: path[:line]` comment or a `⚠ TODO` detail line; the TODO summary lists every `⚠ TODO` — verified by a line check on each verification spec (0 lines without a source)
- [ ] AC-F7: No secret value appears in any draft or saved spec; the secret scan runs before save and blocks it on a match; internal hostnames and IPs are listed for keep or mask before save — verified by the "secret in env template" scenario
- [ ] AC-F8: Nothing is written until the developer approves the draft. After approval, the spec is written to `docs/architecture/diagram/{app}.arch.yaml`, the PNG to `docs/images/{app}-architecture.png`, and `--check` runs — verified by scenario transcript
- [ ] AC-F9: When the post-render check fails, the skill proposes at most one layout revision as a diff, applies it only after approval, and reports the final check result — verified by the crowded-spec scenario
- [ ] AC-F10: `/arch-diagram --refresh` shows a diff against the saved spec, keeps every `# manual` entry, and writes only after approval — verified by the refresh scenario
- [ ] AC-F12: The application name comes from the target repository, in the order given in `references/app-identity.md` (architecture title → `CLAUDE.md` project name → manifest name → folder name). The skill reports which source it used, uses the name for the title and file-name slug, and accepts an override in the draft review — verified by scenarios for each of the four sources and for an override
- [ ] AC-F13: No file added or changed by this ADO contains a real application name, organisation name, hostname or IP. Examples, fixtures and tests use made-up names only — verified by an **allow-list** test in `tests/architecture-diagram.test.cjs` that contains no real names itself: every hostname in `skills/arch-diagram/**` and `tests/fixtures/arch-diagram/**` must end in `example.com`, `example.org`, `.test` or `.invalid` (RFC 2606), and every IPv4 address must be in an RFC 5737 documentation range (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`); any other hostname or IP fails the test
- [ ] AC-F11: The `ARCH DIAGRAM` / `ARCH DIAGRAM --refresh` keywords appear in `_project-deploy/CLAUDE.md` §0a; the CHANGELOG has a 3.27.0 entry; the version is 3.27.0 everywhere `check-version-consistency.js` looks — verified by that script
- [ ] AC-NF1: On a verification repository that already has a hand-made diagram, the run reproduces that diagram's zones, components and flows (Success Metric 1) — verified by a side-by-side review
- [ ] AC-NF2: Evidence collection reads files by evidence-map glob only, reads at most 15 files per role (the cap is set once in `references/evidence-map.md`), excludes `node_modules/`, `bin/`, `obj/`, `dist/`, `.git/` and vendored folders, and lists every matching file it skipped; it never reads the whole tree — verified by the transcript of a run on the largest verification repository
- [ ] AC-NF3: Node test suite still passes on a machine without Python; the Python-dependent tests report "skipped — python/matplotlib not found" — verified by running `npm test` with Python hidden from PATH

### Out of Scope
- We will NOT parse manifests or infrastructure files in code; the skill reads them and the script only draws.
- We will NOT produce SVG, draw.io or Visio output, or vendor icon packs.
- We will NOT change `architect`, `operations` or `go-live`; `/arch-diagram` only reads their output.
- We will NOT edit target applications' Word or PDF documents.
- We will NOT change any consuming application's repository in this ADO; applications that carry their own copy of the renderer remove it in their own follow-up work.

### Assumptions
- Target applications have usually run `architect`, so `.claude/architecture/*.md` exists — **unverified per target**; handled by the code-only fallback (Edge Case 1).
- Developers can install Python 3.10+, matplotlib and PyYAML — **accepted by the developer, 2026-11-13**.
- The renderer behaves as verified in ADO-90 (0 layout and routing problems on three examples; 7–18 s per render) — **verified 2026-11-12**.
- The Write Gate secret-scan patterns in `skills/shared/write-gate-spec.md` cover the spec's YAML format — **unverified**; to be confirmed while implementing Story 2.

### Open Questions
| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Which real repositories should be used to verify the Azure, IIS and Docker / Node.js hosting models? Fixtures cover any model without a repository. | Vivek Rawat | answered — **Answered by the developer (2026-11-13):** verify on the target project the skill runs in, plus the projects listed in the session's `additionalDirectories`. Repository names are recorded in the tracker's verification record only, never in plugin files. A hosting model with no matching repository in that set is verified on the Story 2 fixtures and marked as such |

### Risks & Pre-Mortem
| Risk | Probability | Impact |
|---|---|---|
| The skill invents components that are not deployed | M | H |
| A secret or internal IP leaks into a committed spec or PNG | L | H |
| Context budget exhausted on large repositories | M | M |
| Crowded diagrams on dense applications | M | L |
| Python missing on developer machines | M | L |

**Pre-mortem:** "This shipped and teams stopped trusting the diagrams." The most likely cause is a plausible box with no evidence, such as a DR site drawn from habit, or a spec left stale after a deployment change. Mitigation: AC-F6 (a source on every item, enforced by a line check), the visible TODO summary, and AC-F10 refresh with a diff.

### Dependencies
- Uses: `architect` output; the Write Gate secret-scan pattern (`skills/shared/write-gate-spec.md`); `scripts/new-skill.sh`; `scripts/bump-version.sh`; `scripts/check-version-consistency.js`.
- Source: the generic renderer `architecture-diagram.py` from ADO-90 (verified 2026-11-12); its examples are rewritten with made-up names rather than copied.
- Blocks: follow-up work in the application where the renderer started, which removes its local copy after the plugin release (tracked in that application's ADO-90).

### Irreversibility Flags
None identified. The skill, its references, the script and its registration are additive and can be removed cleanly. Target applications receive only new docs/images files, written after approval.

### D-Blocks

**D-1 — How unverified (`⚠ TODO`) items appear on the rendered PNG**

**Option A — Shown on the diagram, visibly marked**
TODO components get an amber dashed border and a "⚠ unverified" type label; TODO flows are drawn in grey.
Choose this when: the diagram goes into DR plans read by people who never see the spec, so the uncertainty must be visible on the picture itself.

**Option B — Spec and summary only**
The PNG draws TODO items like any other; only the spec comments and the skill's TODO summary carry the warning.
Choose this when: diagrams are always reviewed together with the spec, and a clean picture matters more.

**Recommendation: Option A.**
Repo evidence:
- `operations` puts `⚠ TODO` inline in the document a support engineer reads at 3am, not in a side file.
- The pre-mortem's main risk is trust lost through invisible gaps.

The cost is one new style in the renderer (a `todo: true` component and flow flag), which is small and covered by AC-F3.

**Decision: Option A** — selected by Vivek Rawat, 2026-11-13. TODO components render with an amber dashed border and a "⚠ unverified" type label; TODO flows render in grey; the legend shows an "Unverified (⚠ TODO)" entry when any are present. Spec flag: `todo: true` on a component or flow (set by the skill whenever it writes a `⚠ TODO` line).

---

## Story Breakdown

**Type:** EPIC
**Total SP:** 13

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 — Renderer, scanner and skill scaffold | TBD | Skill scaffold (`new-skill.sh`) + dependency check + `--spec` render mode; move `architecture-diagram.py`; made-up example specs; new type presets; `--check`; D-1 Option A unverified style; `scripts/arch-spec-scan.cjs`; tests with Python-absent skip and the allow-list test (AC-F1, AC-F2, AC-F3, AC-F4, AC-F13, AC-F14, AC-NF3) | 4 | Yes — the renderer is usable with hand-written specs | None | ⏳ Pending |
| 2 — Spec generation | TBD | Application identity; evidence map + spec format refs; evidence collection by role; spec with sources; secret scan + hostname list; draft → save → render → check → one revision; fixture repositories (AC-F5–F9, F12, NF2) | 6 | Yes — `/arch-diagram` produces reviewed diagrams | Story 1 | ⏳ Pending |
| 3 — Refresh and rollout | TBD | `--refresh` with `# manual` kept; keywords; refresh scenarios; CHANGELOG; version 3.27.0; verification runs on the chosen repositories (AC-F10, F11, NF1) | 3 | Yes — release complete | Story 2 | ⏳ Pending |

---

## Sign-Off
| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---
### Revision Log
2026-11-13 — Initial draft from the ADO-8001 plan (saved with SAVE PLAN CONFIRM; Open Question 1 deferred to Story 3 with fixture coverage meanwhile)
2026-11-13 — Critic revision 1 (SAVE ICEA): AC-F13 switched from a deny-list to an RFC 2606 / RFC 5737 allow-list so the test holds no real names; AC-NF2 cap defined (15 files per role, excluded folders listed)
2026-11-13 — Revision 1 (developer feedback): no application name hard-coded anywhere. Added application identity resolution (`references/app-identity.md`, AC-F12), the no-real-names rule and grep test (AC-F13, constraint row), made-up example specs (sanitised Kubernetes example, plus Docker Compose and Node.js examples), and a generic happy path (`orders-api`); success metric, AC-F3, AC-NF1, Out of Scope and Dependencies reworded without application names
2026-11-13 — SAVE TECH: Story Breakdown updated to the Tech Spec sizing (EPIC, 4/6/3 SP; AC-F1/F2 and the scaffold moved to Story 1, fixtures to Story 2); Open Question 1 answered by the developer (target project + additionalDirectories projects)
2026-11-13 — Approved
2026-11-16 — COMPLETE: Stories 1–3 implemented (release 3.27.0). Open: REVISE for AC-F7 / AC-F8 wording, the Tech Spec --stdin row and System Context drift (see tracker Story 3 Known gaps)
