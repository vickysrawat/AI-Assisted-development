# Tech Spec — Story 2: Spec generation (`/arch-diagram`)
ADO #8001 · Story 2 of 3 · Release 3 · Sprint 14
Status: DRAFT · 6 SP · Depends on: Story 1

---

## Overview

This story turns `/arch-diagram` from "render my hand-written spec" (Story 1) into "draw my application". The skill:
1. resolves the application's name from the target repository
2. collects evidence by the evidence-map globs, capped at 15 files per role
3. classifies what it finds by role: compute host, runtime/process, proxy/ingress, data, identity, pipeline, monitoring
4. drafts a spec in which every item has a `# source: path[:line]` comment or a `⚠ TODO` detail with `todo: true`
5. runs `arch-spec-scan.cjs --secrets --hosts --sources` on the draft
6. shows the draft, the TODO summary and the host list, and waits for approval
7. writes the spec, renders with `--check`, and offers at most one layout revision

The skill reads; scripts draw and check. No manifest or IaC parser is written in code (Out of Scope). The LLM reads the files the evidence map names, and the map is the only extension point for new hosting models.

Story 1 contracts used:
- renderer CLI and exit codes
- the `todo` flag
- `arch-spec-scan.cjs`, extended here with `--sources`

---

## AC Coverage Matrix

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F5 | Evidence collection follows evidence-map rows (10 hosting rows); unknown hosting → generic boxes + hosting ⚠ TODO | `skills/arch-diagram/references/evidence-map.md`, `skills/arch-diagram/SKILL.md` Steps 3–4, `tests/fixtures/arch-diagram/*`, `tests/skill-scenarios/arch-diagram.yaml` | ✅ Covered |
| AC-F6 | Every zone / component / flow has `# source:` or `⚠ TODO`; TODO summary lists every TODO | `skills/arch-diagram/references/spec-format.md`, `SKILL.md` Step 5, `scripts/arch-spec-scan.cjs` (`--sources`), `tests/arch-spec-scan.test.cjs` | ✅ Covered |
| AC-F7 | No secret value in draft or saved spec; scan blocks save; hosts listed for keep / mask | `SKILL.md` Steps 3, 6, 7, `scripts/arch-spec-scan.cjs` (`--secrets`, `--hosts`, `--stdin` — built in Story 1), `tests/arch-spec-scan.test.cjs`, `tests/skill-scenarios/arch-diagram.yaml` | ✅ Covered |
| AC-F14 (skill half) | Every item marked `⚠ TODO` also gets `todo: true` | `SKILL.md` Step 5, `scripts/arch-spec-scan.cjs` `checkSources` | ✅ Covered (rendering half in Story 1) |
| AC-F8 | Nothing written before approval; then spec → `docs/architecture/diagram/{app}.arch.yaml`, PNG → `docs/images/{app}-architecture.png`, `--check` runs | `SKILL.md` Steps 7–9 | ✅ Covered |
| AC-F9 | Post-render failure → at most one layout revision as a diff, after approval; report final result | `SKILL.md` Step 10, `references/spec-format.md` § Layout levers | ✅ Covered |
| AC-F12 | App name from target repo by the app-identity order; report source; slug + title; override accepted | `skills/arch-diagram/references/app-identity.md`, `SKILL.md` Step 2 | ✅ Covered |
| AC-NF2 | Glob-only reads, ≤15 files per role, excluded folders, skipped files listed | `references/evidence-map.md` § Read budget, `SKILL.md` Step 3 | ✅ Covered |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| `skills/arch-diagram/SKILL.md` | AC-F5, AC-F6, AC-F7, AC-F8, AC-F9, AC-F12, AC-F14 (skill half), AC-NF2 |
| `skills/arch-diagram/references/evidence-map.md` | AC-F5, AC-NF2 |
| `skills/arch-diagram/references/spec-format.md` | AC-F6, AC-F9 |
| `skills/arch-diagram/references/app-identity.md` | AC-F12 |
| `scripts/arch-spec-scan.cjs` (delta: `--sources`; uses `--secrets`/`--hosts`/`--stdin` from Story 1) | AC-F6, AC-F7, AC-F14 (skill half) |
| `tests/arch-spec-scan.test.cjs` (delta) | AC-F6, AC-F14 (skill half) |
| `tests/skill-scenarios/arch-diagram.yaml` (delta) | AC-F5, AC-F7, AC-F8, AC-F9, AC-F12 |
| `tests/fixtures/arch-diagram/{docker-compose-app,node-pm2-app,aws-ecs-app}/` | AC-F5 |

**Coverage result:** all 7 Story 2 ACs covered (plus the skill half of AC-F14, owned by Story 1), no orphaned file changes ✅

> **Moved from the ICEA's Story 3 row:** the three fixture repositories are built here, because AC-F5's scenarios need them. Story 3 keeps the refresh scenario and the verification runs.

---

## DO NOT rules (apply to every file in this spec)

- DO NOT open `.env` or any file the evidence map marks *keys-only* for values. Read key **names** from `.env.example` / `appsettings*.json` / `values.yaml`. Never copy a value into the spec or the chat summary.
- DO NOT invent a component, zone or flow. Without a file or document line behind it, an item is `⚠ TODO` + `todo: true`.
- DO NOT read outside the evidence-map globs. DO NOT read more than 15 files per role. DO NOT descend into `node_modules/`, `bin/`, `obj/`, `dist/`, `build/`, `.git/`, `vendor/`, `packages/`, `.venv/`, `venv/`.
- DO NOT write anything before the developer approves the draft.
- DO NOT write outside `docs/architecture/diagram/` and `docs/images/` in the target repository.
- DO NOT edit `scripts/architecture-diagram.py` to make a spec render. Fix the spec.
- DO NOT hard-code any application, organisation or host name in the skill or its references. Placeholders only (`{app}`, `contoso`, `*.example.com`).

---

## Files Changed

| # | File | Layer | Change |
|---|---|---|---|
| 1 | `skills/arch-diagram/SKILL.md` | Skill | Add Steps 0 and 2–10 (generation mode) around Story 1's Step 1 and `--spec` mode |
| 2 | `skills/arch-diagram/references/app-identity.md` | Skill ref | New. Name-resolution order, slug rule, title format, override |
| 3 | `skills/arch-diagram/references/evidence-map.md` | Skill ref | New. Role table, 10 hosting rows, docs row, read budget, exclusions |
| 4 | `skills/arch-diagram/references/spec-format.md` | Skill ref | New. Keys (from Story 1), `# source:` / `# manual` / `todo` conventions, zone templates per hosting model, layout levers |
| 5 | `scripts/arch-spec-scan.cjs` | Script (delta) | Add `--sources` (AC-F6 line check) and `checkSources(text)` export |
| 6 | `tests/arch-spec-scan.test.cjs` | Test (delta) | `--sources` positive and negative cases |
| 7 | `tests/skill-scenarios/arch-diagram.yaml` | Test (delta) | Kubernetes, Docker, Node+PM2, AWS, empty-repo, secret-in-template, existing-spec, approval-gate, identity ×4 + override, crowded-render scenarios |
| 8 | `tests/fixtures/arch-diagram/docker-compose-app/` | Fixture | `docker-compose.yml` (api, worker, postgres, redis, nginx), `Dockerfile`, `.env.example` with one realistic-looking fake value under `SESSION_SIGNING_SECRET=` (a key form the commit gate's `password=` / `api_key` patterns do not match, but `arch-spec-scan` does), `package.json` `name: "contoso-orders"` |
| 9 | `tests/fixtures/arch-diagram/node-pm2-app/` | Fixture | `package.json`, `ecosystem.config.js` (2 apps, ports), `deploy/nginx/site.conf` (`server_name app.contoso.example.com`), `deploy/systemd/pm2.service` |
| 10 | `tests/fixtures/arch-diagram/aws-ecs-app/` | Fixture | `infra/task-definition.json`, `infra/template.yaml` (CloudFormation: ALB, ECS service, RDS, S3), `.github/workflows/deploy.yml` |

### AC Traceability

See the AC Coverage Matrix. Each SKILL.md step heading carries its AC tags, for example `### Step 3 — Collect evidence (AC-F5, AC-NF2)`.

---

## Skill — skills/arch-diagram/SKILL.md (generation mode)

| Step | What it does | AC |
|---|---|---|
| 0 | Parse args: none → generate · `--spec <file>` → Story 1 render mode · `--refresh` → Story 3. Then run the Step 1 dependency check (Story 1) **first**, so nothing in the repository is read before it passes (ICEA Error State 1) | AC-F2 |
| 1a | Existing spec: if `docs/architecture/diagram/*.arch.yaml` exists and no flag is given, stop: "A spec already exists at …; run `/arch-diagram --refresh` to update it, or reply OVERWRITE to start again" | AC-F8 |
| 2 | Resolve identity per `app-identity.md`; print `Application: {name} (from {source})` | AC-F12 |
| 3 | Collect evidence: for each evidence-map row, `Glob` its patterns (exclusions applied); keep ≤15 per role in the map's priority order; list the rest as skipped. Read `.claude/architecture/*.md` and runbook / DR docs (`docs/**/*{runbook,recovery,dr}*.md`). Keys-only files → key names only. If no architecture docs exist, print "no architecture docs — diagram drawn from code only" | AC-F5, AC-F7, AC-NF2 |
| 4 | Classify by role → choose zone template and component types from `spec-format.md`. No hosting row matched → one `server` box named after the app, `todo: true`, detail `⚠ TODO: hosting not found — searched: {globs}` | AC-F5 |
| 5 | Draft spec in memory. Every zone, component and flow line has `# source: path[:line]` (code) or `# source: .claude/architecture/{file}.md:{line}` (documents). If neither exists: `details: ["⚠ TODO: {what is unknown}"]` + `todo: true`. Build the TODO summary from every `⚠ TODO` | AC-F6 |
| 6 | Pipe the in-memory draft to `node "$PLUGIN_DIR/scripts/arch-spec-scan.cjs" --stdin --secrets --hosts --sources --json`. Nothing is written to disk. Secret match → `❌ BLOCKED — secret pattern ({label}) at spec line N`. No approval path; the skill removes the value and re-scans. Source gaps → fix before showing. Hosts → table "keep / mask" | AC-F6, AC-F7 |
| 7 | Show: identity line, draft spec, TODO summary, host table, skipped-files list. Then the Write Gate prompt with both target paths. Accept `APPROVE`, a display-name override ("call it X"), host mask choices, or edits. An override re-derives title and slug only | AC-F8, AC-F12 |
| 8 | On approval: write `docs/architecture/diagram/{slug}.arch.yaml` | AC-F8 |
| 9 | Render: `python "$PLUGIN_DIR/scripts/architecture-diagram.py" <spec> docs/images/{slug}-architecture.png --check`; show PNG (Read tool) | AC-F8 |
| 10 | Exit 1 with `spec error:` → show line, propose a spec fix as a diff, re-render after approval. Exit 1 with `check:` → propose **one** layout revision (`span`, `columns`, `stack`, `row`) as a diff; apply and re-render only after approval; report the final `check:` result whatever it is, with no second revision | AC-F9 |

**No scratch file.** The draft lives only in the conversation until Step 8. The scanner reads it through `--stdin`, so a blocked secret, a SKIP or an aborted run leaves nothing on disk (AC-F8).

---

## Skill refs

### references/app-identity.md (AC-F12)

| Order | Source | How read |
|---|---|---|
| 1 | `.claude/architecture/architecture.md` | First `# ` heading, stripping suffixes such as "— Architecture" |
| 2 | `CLAUDE.md` | Name in `## 1. PROJECT OVERVIEW` first sentence (the subject before "is a"), or a `Project:` line |
| 3 | Manifest | `package.json` `name` → `*.csproj` `<AssemblyName>` or file name → `pyproject.toml` `[project].name` → `pom.xml` `<artifactId>` → `go.mod` `module` last path segment |
| 4 | Folder | Repository root folder name |

- **Slug:** lower-case; non-alphanumeric runs become `-`; trimmed; a scoped npm name `@scope/x` gives `x`.
- **Title:** `{Name} — Architecture & Recovery`.
- **Override:** the developer gives a display name in Step 7, and the slug is re-derived from it.

### references/evidence-map.md (AC-F5, AC-NF2)

**Roles:** compute host · runtime/process · proxy/ingress · data · identity · secrets/config (names only) · pipeline · monitoring · external/users.

| Hosting | Globs (priority order) | Roles → types |
|---|---|---|
| Kubernetes / AKS / OpenShift | `**/k8s/**/*.y*ml`, `**/manifests/**/*.y*ml`, `**/helm/**/{Chart,values}*.yaml`, `**/kustomization.yaml` | host → `kubernetes`/`aks`, `namespace`; runtime → `pod`/`container`; proxy → `ingress`; config → `secret`/`config` (names); data → `volume` |
| Docker / Compose / Swarm | `**/docker-compose*.y*ml`, `**/compose*.y*ml`, `**/Dockerfile*`, `**/*stack*.y*ml` | host → `docker-host`; runtime → `compose-service`; data → `database`/`volume`; proxy → `reverse-proxy` (nginx/traefik/caddy images) |
| Node.js server | `package.json` (`scripts.start`, `engines`), `**/ecosystem.config.{js,cjs}`, `**/{server,app,index}.{js,ts}` (listen port only) | runtime → `node-server`; process → `process-manager` |
| Linux VM / bare metal | `**/*.service`, `**/nginx/**/*.conf`, `**/apache*/**/*.conf`, `deploy/**/*.sh` | host → `linux-server`; proxy → `reverse-proxy`; process → `process-manager` |
| Azure PaaS | `**/*.bicep`, `**/azuredeploy*.json`, `**/*.tf` (azurerm), `**/host.json`, `**/containerapp*.y*ml` | host → `app-service`/`function-app`/`container-apps`; proxy → `front-door`/`app-gateway`; data → `azure-sql`/`storage`; secrets → `key-vault`; monitoring → `app-insights`; identity → `identity` |
| AWS | `**/template.y*ml` (CloudFormation), `**/cdk.json` + `lib/**/*.ts`, `**/*.tf` (aws), `**/task-definition*.json`, `serverless.yml` | host → `aws-ecs`/`aws-lambda`; proxy → `load-balancer`; data → `aws-rds`/`s3`; queue → `queue` |
| On-prem IIS / Windows | `**/web.config`, `**/*.pubxml`, `**/parameters.xml`, `**/*Installer*.cs`, `**/*.ps1` (deploy) | host → `iis-server`/`vm`; runtime → `iis-site`/`app-pool`/`windows-service`; data → `sql-server`/`file-share` |
| Java app servers | `**/server.xml`, `**/application*.{yml,yaml,properties}`, `pom.xml` / `build.gradle` (packaging) | runtime → `app-server`; data → `database` |
| Other PaaS | `Procfile`, `app.yaml`, `vercel.json`, `netlify.toml`, `fly.toml` | host → `service`; tag = platform name |
| CI/CD | `azure-pipelines*.yml`, `pipelines/**/*.yml`, `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile` | pipeline → `pipeline`; `registry`/`artifact`; deploy flows |
| Documents (all hosting) | `.claude/architecture/*.md`, `docs/**/*{runbook,recovery,dr,deployment}*.md` | failover site, backups, firewalls, DNS, users; cited by doc line |
| Settings (keys only) | `.env.example`, `.env.template`, `appsettings*.json`, `values*.yaml` | data/identity/external flows from key names (`*_DB_*`, `*_URL`, `AZURE_*`) |

**Read budget:** `MAX_FILES_PER_ROLE = 15`, defined once here. When a role has more matches, take files in glob priority order, then the shortest path first. Every match not read is listed under "Skipped (cap)" in Step 7. Exclusions: the folders in the DO NOT rules plus anything matched by `.gitignore`.

### references/spec-format.md (AC-F6, AC-F9)

Its contents:
- **Spec keys:** link to the renderer docstring (Story 1).
- **Comment conventions:**
  - `# source: path[:line]` as a trailing comment on the item's first line
  - `# manual` (Story 3) on an item the developer owns
  - `todo: true`, paired with a `⚠ TODO: …` detail
- **Zone templates per hosting model:**
  - primary / failover site
  - cloud identity / shared services / CI-CD / users
  - Docker host
  - Linux server
- **Layout levers for the Step 10 revision:**
  - `span` (widen a crowded zone)
  - `columns` (reflow children)
  - `type: stack` (stack a database above its backup)
  - `row` (move a zone down)

### `--sources` line check — scripts/arch-spec-scan.cjs delta (AC-F6)

```js
// checkSources(text) → [{line, item}] for every item without a source.          // AC-F6
// Item start = /^\s*-\s+(?:id:|name:|from:|\{)/ inside zones:, components:, children:, flows:
// An item passes if its start line contains "# source:" or "# manual",
//   or the item block contains "todo: true" AND a "⚠ TODO" detail.
// Also flags an item that has "⚠ TODO" without "todo: true" (keeps AC-F14 visible).
```

---

## Domain Exceptions — app/exceptions.py
Not applicable. There is no FastAPI app. Skill failures are user-visible messages (see Error Handling).

## Dependency Wiring — app/dependencies.py
Not applicable.

## FastAPI Router — app/routers/{feature}.py
Not applicable. No endpoints.

## Pydantic Schemas — app/schemas/{feature}_schema.py
Not applicable. The spec contract is the renderer docstring plus `spec-format.md`.

## Service Layer — app/services/{feature}_service.py
Not applicable.

## Repository Layer — app/repositories/{feature}_repository.py
Not applicable. No persistence.

---

## API Changes

No HTTP API. CLI delta: `arch-spec-scan.cjs --sources`, an additive flag.

### DB / persistence changes

No DB changes in this story.

---

## Auth & Security

| Location | Concern | Mitigation |
|---|---|---|
| Step 3 settings read | Secret values in env templates | Key-names-only rule; `.env` never opened; values never enter the draft |
| Step 6 | Secret slipped into the draft anyway | `--secrets` blocks the save with no approval path; the value is removed and the draft re-scanned |
| Step 6 / 7 | Internal hosts in a committed PNG | `--hosts` table; developer chooses keep or mask per host; masked values become `{role}-host` |
| Step 6 | Unapproved draft on disk | Scanner reads `--stdin`; no scratch file exists in any exit path |
| Step 8 / 9 | Writes outside allowed paths | Only `docs/architecture/diagram/{slug}.arch.yaml` and `docs/images/{slug}-architecture.png` |
| All steps | Executing target-repo code | Nothing from the target repository is run; only the two plugin scripts run |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Spec already exists, no flag | Stop: "--refresh or OVERWRITE" message (Step 1a) |
| No architecture docs | Continue code-only; summary line "no architecture docs — diagram drawn from code only; failover / backups ⚠ TODO" |
| No hosting evidence | Generic `server` box, `todo: true`, globs searched listed |
| Secret pattern in draft | `❌ BLOCKED — secret pattern ({label}) at spec line N`; value removed; re-scan; nothing written |
| Developer replies SKIP | Nothing written (the draft was never on disk) |
| Renderer `spec error:` | One-line error shown; spec fix proposed as diff; re-render after approval |
| `--check` problems after the one revision | Final problem list reported; PNG kept; no further automatic revision |
| Evidence cap hit | "Skipped (cap): N files" list shown in Step 7 |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F12 | app-identity ref + Step 2 | 1 |
| AC-F5, AC-NF2 | evidence-map ref + Steps 3–4 + 3 fixtures | 2 |
| AC-F6, AC-F7 | spec-format ref + Steps 5–6 + `--sources` | 2 |
| AC-F8, AC-F9 | Steps 7–10 + scenarios | 1 |
| **Total** | | **6** |

**Type: STORY slice of EPIC ADO-8001.**

---

## Definition of Done

**Implementation**
- [ ] SKILL.md Steps 0–10 present, each with its AC tags
- [ ] Three references written; no real names (AC-F13 test from Story 1 stays green with the new fixtures)
- [ ] `arch-spec-scan.cjs --sources` implemented and tested

**Quality**
- [ ] `npm test` green
- [ ] Each fixture run: `arch-spec-scan --sources` reports 0 gaps; `--check` → `check: ok`
- [ ] Secret-in-template scenario: the fake secret from `docker-compose-app/.env.example` never appears in the draft, chat or saved spec

**Review readiness**
- [ ] PR title: `[ADO-8001] /arch-diagram — Story 2: spec generation from the codebase`
- [ ] PR maps files to ACs

### Reviewer Checklist

**Security:**
- [ ] Keys-only rule stated in SKILL.md Step 3 and in evidence-map.md
- [ ] Step 6 runs before Step 7 shows the draft; there is no approval path past a secret match
- [ ] The skill never opens `.env`

**Evidence integrity:**
- [ ] No step lets the LLM add an item without `# source:` or `todo: true` (enforced by `--sources`)
- [ ] Unknown hosting falls back to `server` + TODO, not a guessed model

**AC coverage:**
- [ ] AC tags on each SKILL.md step; scenario IDs reference AC IDs

**Regression:**
- [ ] Story 1 `--spec` mode unchanged

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| — | None for this story (the epic's ❓[1] affects Story 3 only) | — | — | — |

---

## Request Flow

```
/arch-diagram
 → Step 0 args → Step 1 deps ── missing → stop (nothing read)
 → Step 1a existing spec? ── yes → "--refresh or OVERWRITE" stop
 → Step 2 "Application: contoso-orders (from package.json name)"
 → Step 3 Glob by evidence map (≤15/role) → Read files; keys-only for settings
 → Step 4 classify → zone template
 → Step 5 draft (# source / ⚠ TODO + todo: true) → TODO summary
 → Step 6 arch-spec-scan --stdin --secrets --hosts --sources
        ├─ secret → ❌ BLOCKED, remove, re-scan
        └─ clean → host table
 → Step 7 show draft + TODO + hosts + skipped → Write Gate prompt
        ├─ SKIP → stop (nothing on disk)
        └─ APPROVE (± name override, masks)
 → Step 8 write docs/architecture/diagram/{slug}.arch.yaml
 → Step 9 render --check → show PNG
 → Step 10 exit 1 → one revision diff → approval → re-render → report final result
```

---

## Rollback

Additive. Revert the Story 2 commit(s); Story 1 `--spec` mode keeps working. Specs and PNGs already written in target repositories are plain docs files and stay valid. They render with the Story 1 renderer.

---

## Handover

### QA Team
- Copy each fixture to a scratch folder, `git init` it, and run `/arch-diagram`. For each run, check:
  - the identity line
  - a source on every item
  - the TODO list
  - the host table
  - that nothing is written before approval
  - the final PNG
- Repeat the Docker fixture with a display-name override.
- Run once in a real Kubernetes repository and compare with any existing diagram. This is formal AC-NF1 territory and is recorded in Story 3.

### DevOps / Platform Team
None. No pipeline, environment or infrastructure change.

### Future Developer — adding a hosting model
1. Add a row to `evidence-map.md`.
2. Add a zone template to `spec-format.md` if the layout differs.
3. Add presets in Story 1's script if needed.
4. Add a fixture under `tests/fixtures/arch-diagram/` and a scenario.

---

## Test Cases

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | `checkSources` | spec where every item has `# source:` | `[]` | AC-F6 |
| P-U2 | `checkSources` | item with `todo: true` + `⚠ TODO` detail, no source | passes | AC-F6 |
| P-U3 | `checkSources` | item with `# manual` | passes | AC-F6 |
| P-U4 | scenario: Docker fixture | `/arch-diagram` | zone "Docker host"; api / worker `compose-service`, postgres `database`, nginx `reverse-proxy`; flows from `depends_on`; code-only notice | AC-F5 |
| P-U5 | scenario: Node+PM2 fixture | `/arch-diagram` | `linux-server` → `reverse-proxy` + `process-manager` → 2 `node-server`; ports cited from `ecosystem.config.js:{line}` | AC-F5 |
| P-U6 | scenario: AWS fixture | `/arch-diagram` | `aws-ecs`, `load-balancer`, `aws-rds`, `s3`, pipeline from GitHub Actions; each cited | AC-F5 |
| P-U7 | scenario: identity sources | four repos (arch title / CLAUDE.md / manifest / folder only) | identity line names each source | AC-F12 |
| P-U8 | scenario: override | reply "call it Orders Platform" | title `Orders Platform — Architecture & Recovery`; slug `orders-platform` | AC-F12 |
| P-U9 | scenario: approval | APPROVE | both files written at the announced paths; `check: ok` | AC-F8 |
| P-U10 | scenario: clean draft | Node+PM2 fixture (no secrets) | scan passes; host table lists `app.contoso.example.com` with keep / mask; developer picks **mask** → saved spec shows `proxy-host` in its place | AC-F7 |
| P-U11 | scenario: one revision succeeds | crowded spec where `span: 2` fixes the overlap | revision diff → approve → re-render → final `check: ok` reported | AC-F9 |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | `checkSources` | component with no source and no `todo` | 1 gap with line number | AC-F6 |
| N-U2 | `checkSources` | `⚠ TODO` detail without `todo: true` | flagged | AC-F6, AC-F14 |
| N-U3 | scenario: empty repo | `/arch-diagram` | generic `server` box, `todo: true`, globs listed | AC-F5 |
| N-U4 | scenario: secret in template | Docker fixture `.env.example` with a fake value | value absent from draft and chat; if injected into the draft, `❌ BLOCKED … line N`; nothing written | AC-F7 |
| N-U5 | scenario: no reply / SKIP | draft shown, SKIP | no file under `docs/architecture/diagram/`, `docs/images/` or `temp/` | AC-F8 |
| N-U6 | scenario: existing spec | plain `/arch-diagram` | "--refresh or OVERWRITE" message; nothing read or written | AC-F8 |
| N-U7 | scenario: crowded render | spec that fails `--check` | exactly one revision diff proposed; after approval, re-render; final result reported; no second revision | AC-F9 |
| N-U9 | scenario: identity fall-through | `architecture.md` exists but has no `# ` title; `package.json` `name: "@contoso/orders-web"` | identity from package.json; slug `orders-web` | AC-F12 |
| N-U8 | scenario: renderer `spec error:` | draft with a dangling flow endpoint | error line shown; fix diff proposed; renderer script untouched | AC-F9 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | End-to-end Kubernetes | Run in a repository with k8s manifests + architecture docs | primary / failover zones, sources everywhere, TODO list, host table, PNG with `check: ok` | AC-F5–F8 |
| INT-2 | Read budget | Run on the largest available repository | ≤15 files read per role (count Read calls in transcript); "Skipped (cap)" list present; no excluded-folder reads | AC-NF2 |

> NF AC verification:
> AC-NF2 (read budget): verified by INT-2. Count Read tool calls per role in the session transcript, and confirm the skipped-files list and that no path under an excluded folder was read.

---

### Revision Log
2026-11-13 — Critic revision 1:
- dependency check moved before the existing-spec check
- no scratch file; the scanner reads `--stdin`
- AC-F7 matrix rows completed
- AC-F14 skill half cited
- fixture fake secret uses a key form the commit gate tolerates
- positive rows added for AC-F7 and AC-F9; negative row added for AC-F12

2026-11-13 — Story 2 spec drafted. Fixtures moved here from the ICEA's Story 3 row because AC-F5 scenarios need them; `arch-spec-scan.cjs --sources` added as the deterministic AC-F6 line check.
