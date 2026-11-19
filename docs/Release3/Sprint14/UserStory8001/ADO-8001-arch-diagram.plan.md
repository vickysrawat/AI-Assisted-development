# Feature Plan — /arch-diagram: Architecture / Recovery Diagram Generated from the Codebase
ADO #8001 · Release R3 · Sprint S14
Status: 💾 Saved — open questions accepted (SAVE PLAN CONFIRM, 2026-11-13)
Branch: `feature/ADO-8001-arch-diagram` (from `origin/main` 11bea2f)

---

## Problem Statement

Teams are asked for a technical recovery / architecture diagram (for DR plans, runbooks, go-live and audit reviews), and today each team draws it by hand or hard-codes it in a script.
- ADO-90 produced a generic, spec-driven renderer (`architecture-diagram.py`). It lays out boxes automatically and routes the arrows itself.
- The spec, though, still has to be written by hand. A team that has neither a spec nor an example cannot produce a diagram at all.

The information is already there. The plugin's `architect` skill writes `.claude/architecture/*.md`, and the repository holds deployment files: k8s manifests, Dockerfiles and compose files, Bicep/ARM/Terraform, `web.config`, PM2/systemd units and pipelines. Nothing turns that evidence into a diagram.

**Success:** running `/arch-diagram` in any plugin-instrumented application produces a reviewed spec and a PNG. Every component and flow in the spec can be traced to a file, or is marked `⚠ TODO`. On a verification repository that already has a hand-made diagram, a run must reproduce that diagram's zones, components and flows without a hand-written spec. Nothing in the plugin names a specific application: the name, title, file names and hosts all come from the target repository.

## Story

As a developer or tech lead of any application using the plugin, I want `/arch-diagram` to read my codebase and architecture documents and draw my application's architecture and recovery diagram, so that I get an accurate, evidence-backed diagram without hand-writing a layout or a spec, whatever the hosting model.

## Personas

- **Developer:**
  - Owns an application hosted on Kubernetes, Docker, a Node.js server, a Linux VM, Azure or AWS PaaS, or on-prem IIS.
  - Goal: produce the diagram the DR plan or runbook asks for.
  - Frustration: drawing it by hand in Visio or draw.io, which goes stale as soon as the deployment changes.
  - Success: one command, a review of the draft, a PNG.
- **Tech Lead / Architect:**
  - Reviews DR plans and go-live packs across several applications.
  - Goal: diagrams that match what is actually deployed and look consistent across teams.
  - Frustration: diagrams that show components nobody can find in the code.
  - Success: every box and arrow cites a file; gaps are shown as `⚠ TODO`, never invented.

## Feature Priority (MoSCoW)

**Must Have:**
1. **Skill and command.** Scaffold `skills/arch-diagram/SKILL.md` with `scripts/new-skill.sh`, which also creates:
   - the command stub in `_project-deploy/commands/`
   - the `plugin.json` registration
   - `tests/skill-scenarios/arch-diagram.yaml`
   - a README row

   The skill runs on the infrastructure model tier.
2. **Bundled renderer.** Move the generic `architecture-diagram.py` (ADO-90) to `scripts/architecture-diagram.py`. Add example specs to `skills/arch-diagram/references/examples/` that use made-up applications only (`contoso`, `example.com`); the source examples are rewritten, not copied. Before it does anything else, the skill checks for `python`, `matplotlib` and `pyyaml`. If one is missing, it stops with install steps. None of them is ever added to the target application's dependency files.
3. **Hosting-agnostic evidence collection.** The skill sorts what it finds by **role**: compute host, runtime/process, proxy/ingress, data, identity, pipeline, monitoring. It does not assume a hosting model. `skills/arch-diagram/references/evidence-map.md` maps evidence files to roles and component types, and adding a new hosting model means adding a row. It ships with these rows:

   | Hosting | Evidence files |
   |---|---|
   | Kubernetes / AKS / OpenShift | k8s manifests, Helm, Kustomize |
   | Docker / Compose / Swarm | `Dockerfile`, `docker-compose*.yml`, stack files |
   | Node.js server | `package.json` start script and `engines`, PM2 `ecosystem.config.js`, listen port |
   | Linux VM / bare metal | systemd units, nginx/Apache config, deploy scripts |
   | Azure PaaS | Bicep, ARM, Terraform, App Service / Functions / Container Apps settings |
   | AWS | CloudFormation, CDK, Terraform, ECS task definitions, `serverless.yml` |
   | On-prem IIS / Windows | `web.config`, `.pubxml`, msdeploy parameters, Windows service installers |
   | Java app servers | Tomcat `server.xml`, Spring `application*.yml` |
   | Other PaaS | `Procfile`, `app.yaml`, `vercel.json` / `netlify.toml` |
   | CI/CD | Azure Pipelines, GitHub Actions, GitLab CI, Jenkinsfile |

   For every hosting model the skill also reads:
   - `.claude/architecture/*.md` (deployment, integrations, security)
   - runbook and DR documents
   - app settings and env templates, **keys only**

   If the hosting model is not recognised, the skill still draws generic `server` / `container` boxes and marks the hosting `⚠ TODO`.
4. **Spec with evidence for every item.**
   - Every zone, component and flow carries a `# source: path[:line]` comment.
   - Items with no evidence get a `⚠ TODO: …` detail line and appear in a TODO summary.
   - Items in the architecture documents but not in code (failover site, DBA backups, firewalls, DNS) cite the document.
   - Nothing is invented.
5. **Data safety.**
   - Secret values, connection strings, tokens and passwords never go into the spec.
   - A secret scan of the draft spec runs before it is saved, and a finding blocks the save.
   - Internal hostnames and IPs are listed for the developer to keep or mask before saving.
6. **Draft, then save, then render.**
   - The skill shows the draft spec, the TODO summary and the hostname list.
   - On approval it writes `docs/architecture/diagram/{app}.arch.yaml` and renders `docs/images/{app}-architecture.png`.
   - It then checks the result automatically: no overlapping boxes, no arrow crossing an unrelated box, no `no clear path` warning, and the image viewed. If a check fails, it proposes layout changes (`span`, `columns`, `stack`) once, with the developer's confirmation.
7. **Refresh mode.** `/arch-diagram --refresh` re-collects the evidence and shows a diff against the saved spec. Entries the developer marked `# manual` are kept and never overwritten.
8. **Housekeeping.**
   - Keyword `ARCH DIAGRAM` / `ARCH DIAGRAM --refresh` added to `_project-deploy/CLAUDE.md` §0a.
   - A CHANGELOG entry.
   - Version bump to 3.27.0 (`scripts/bump-version.sh`).
9. **Renderer type presets for more hosting models.** Add these presets to `architecture-diagram.py`:
   - `docker-host`, `compose-service`
   - `node-server`, `process-manager`, `reverse-proxy`
   - `linux-server`
   - `container-apps`
   - `aws-ecs`, `aws-lambda`, `aws-rds`, `s3`
   - `app-server`

   An unknown type still renders as a plain box, labelled with the spec's `tag`.

10. **No hard-coded application identity.** The skill takes the application name from the target repository in this order: architecture-document title, then the project name in `CLAUDE.md`, then the manifest name (`package.json`, `*.csproj`, `pyproject.toml`, `pom.xml`, `go.mod`), then the folder name. It reports which source it used. The title and file names are derived from that name, and the developer can override them in the draft. No plugin file contains a real application name, organisation, hostname or IP, and a grep test enforces this.
11. **Unverified items visible on the diagram (D-1 Option A, 2026-11-13).** Components marked `⚠ TODO` get an amber dashed border and a "⚠ unverified" label; flows marked `⚠ TODO` are drawn in grey; the legend shows an "Unverified" entry when there are any.

**Should Have:**
- A small made-up fixture repository for each hosting model without a real verification repository (Docker-only, Node.js+PM2, AWS ECS), used by the scenario test.

**Could Have:**
- A `--from-docs-only` flag that drafts from `.claude/architecture/*.md` alone, for a quick first diagram.

**Won't Have:**
- No parsing of manifests or infrastructure files in code. The skill reads them; the script only draws.
- No SVG, draw.io or Visio output and no vendor icon packs. Output is PNG only. *(Amended 2026-11-19: ADO-82 adds bundled Azure Architecture Icons; the PNG-only decision stands. See `docs/Release3/Sprint15/UserStory82/ADO-82-arch-diagram-icons.plan.md`.)*
- No changes to the `architect`, `operations` or `go-live` skills. `/arch-diagram` only reads their output.
- No editing of target applications' Word or PDF documents.
- No changes to any consuming application's repository inside this ADO (see Dependencies).

## Release Plan

- **Story 1 — Renderer in the plugin:** move the script and examples, add the type presets, and add the dependency check. This story can ship on its own.
- **Story 2 — Spec generation:** evidence map, evidence collection, spec with sources, data safety, draft → save → render.
- **Story 3 — Refresh and rollout:** refresh mode, keyword, scenario test and fixtures, CHANGELOG, version bump, verification runs.

## Assumptions

- Target applications that use the plugin have run `architect`, so `.claude/architecture/*.md` exists. If it doesn't, the skill falls back to code-only evidence and says so.
- Developers can install Python 3.10+, matplotlib and PyYAML locally. **Accepted by the developer, 2026-11-13.**
- `architecture-diagram.py` behaves as verified in ADO-90:
  - 0 layout problems and 0 arrow-routing problems on three examples
  - 7–18 s per render

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| The skill invents components that aren't deployed | M | H | Every item must cite a source or be `⚠ TODO` (Must Have 4); the critic checks for items without a source |
| A secret or internal IP leaks into a committed spec or PNG | L | H | Secret scan blocks the save; hostname list reviewed before save (Must Have 5) |
| Large monorepos exhaust the context budget during evidence collection | M | M | Read evidence files by glob from the evidence map, not the whole tree; cap reads per role and record what was skipped |
| A dense application gives a crowded or unroutable diagram | M | L | Post-render checks plus one layout revision; the renderer falls back to a straight line with a warning |
| Python is missing on a developer machine | M | L | Dependency check stops early with install steps |

## Pre-mortem

"This shipped and teams stopped trusting the diagrams." The most likely cause is a plausible-looking box with no evidence behind it, such as a DR site drawn from habit, or a spec that went stale after a deployment change. Mitigation: a source on every item, a visible TODO list, and refresh mode with a diff.

## Dependencies

- Uses: `architect` output (`.claude/architecture/*.md`) and the Write Gate secret-scan pattern (`skills/shared/write-gate-spec.md`).
- Source: the generic renderer `architecture-diagram.py` from ADO-90. Its examples are rewritten with made-up names.
- Follow-up in the application where the renderer started (its ADO-90), after the plugin release: remove that application's local copy and use `/arch-diagram` instead. Agreed with the developer on 2026-11-13.

## Open Questions (accepted at plan save — SAVE PLAN CONFIRM)

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Which real repositories should be used to verify the Azure, on-prem IIS and Docker / Node.js hosting models? Fixtures cover any model without a repository. | Vivek Rawat | open — candidates to be proposed from the additional directories (`KE.Web`, `KE.KMS.Trackers.Phase12`, `KE2/_Platform/...`) before Story 3 |

---
### Revision Log
2026-11-13 — Plan drafted and saved (SAVE PLAN ADO-8001 CONFIRM). Hosting-agnostic scope added at developer request (Docker, Node.js server and others in addition to Kubernetes, Azure and IIS).
2026-11-13 — Revised at developer request: no application name hard-coded (Must Have 10); D-1 decided as Option A (Must Have 11); application-specific wording removed throughout.
