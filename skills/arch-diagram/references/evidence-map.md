# Evidence map — which files /arch-diagram reads, and what they become

_Reference for `skills/arch-diagram/SKILL.md` Steps 3–4 · ADO-8001 · AC-F5, AC-NF2_

The skill does not assume a hosting model. It sorts what it finds by **role**, and the hosting
model follows from the roles that have evidence. **Adding a hosting model means adding a row
here**, and a renderer preset if none of the existing types fits.

---

## Roles

| Role | What it answers | Typical diagram types |
|---|---|---|
| compute host | Where does the application run? | `kubernetes`, `aks`, `docker-host`, `linux-server`, `vm`, `iis-server`, `app-service`, `container-apps`, `aws-ecs`, `aws-lambda`, `server` |
| runtime / process | What runs there? | `pod`, `container`, `compose-service`, `node-server`, `process-manager`, `iis-site`, `app-pool`, `windows-service`, `app-server`, `function-app` |
| proxy / ingress | What receives traffic first? | `ingress`, `reverse-proxy`, `load-balancer`, `front-door`, `app-gateway` |
| data | Where is state kept? | `database`, `sql-server`, `azure-sql`, `aws-rds`, `storage`, `s3`, `file-share`, `volume`, `queue`, `backup` |
| identity | Who signs users or services in? | `identity` |
| secrets / config | Where do settings come from? **Names only, never values** | `secret`, `config`, `key-vault` |
| pipeline | How does a change reach production? | `pipeline`, `registry`, `artifact` |
| monitoring | Where do logs and alerts go? | `monitoring`, `app-insights` |
| external / users | Who or what calls in or out? | `users`, `external`, `dns`, `firewall` |

---

## Hosting rows

Globs are relative to the repository root and are listed in priority order. Match file names
case-insensitively (`Web.config` = `web.config`). The globs use no nested `{…}` groups, because
some search tools reject them.

| Hosting | Globs | Evidence → role → type |
|---|---|---|
| Kubernetes / AKS / OpenShift | `**/k8s/**/*.y*ml`, `**/manifests/**/*.y*ml`, `**/helm/**/Chart.yaml`, `**/helm/**/values*.yaml`, `**/kustomization.yaml`, `pipelines/k8s/**/*.y*ml` | `kind: Deployment/StatefulSet` → runtime `pod`; `Service`/`Ingress` → proxy `ingress`; `Secret`/`ConfigMap` → `secret`/`config` (`metadata.name`; Secret keys via `--keys`, never `data:` values); `PersistentVolumeClaim` → data `volume`; `volumeMounts` / `envFrom` → a flow from the ConfigMap / Secret / volume to the pod; `NetworkPolicy` → a detail line or zone note, not a box; cluster from the pipeline's deploy target or the documents → host `kubernetes`/`aks` |
| Docker / Compose / Swarm | `**/docker-compose*.y*ml`, `**/compose*.y*ml`, `**/*stack*.y*ml`, `**/Dockerfile*` | each service → runtime `compose-service`; image `postgres`/`mysql`/`mariadb`/`mssql`/`mongo` → data `database`; `redis`/`rabbitmq` → data `queue`; `nginx`/`traefik`/`caddy`/`haproxy` → proxy `reverse-proxy`; the host itself → `docker-host`; `depends_on`, `*_HOST`, `*_URL` → runtime flows; `ports` → flow labels |
| Node.js server | root `package.json` (`scripts.start`, `main`, `engines`), `**/ecosystem.config.js`, `**/ecosystem.config.cjs`, and the **one entry file** each app names in `main` or its `start` script (**source — consent-gated; listen port only**). Never glob every `index.js` / `index.ts`: in a front-end monorepo they are barrel files | each PM2 app → runtime `node-server` inside a `process-manager`; `env.PORT` → flow label |
| Linux VM / bare metal | `**/*.service`, `**/nginx/**/*.conf`, `**/sites-*/*`, `**/apache*/**/*.conf`, `deploy/**/*.sh` | systemd unit → `process-manager` or `node-server`; `server_name` → proxy `reverse-proxy` (host name goes to the host table); `proxy_pass` → flow to the runtime; the machine → host `linux-server` |
| Azure PaaS | `**/*.bicep`, `**/azuredeploy*.json`, `**/*.tf` with `azurerm_`, `**/host.json`, `**/containerapp*.y*ml` | `Microsoft.Web/sites` / `azurerm_linux_web_app` → `app-service`; functions → `function-app`; `Microsoft.App/containerApps` → `container-apps`; `Microsoft.Sql` → `azure-sql`; `Microsoft.Storage` → `storage`; `Microsoft.KeyVault` → `key-vault`; Front Door / App Gateway → proxy; Application Insights → `app-insights` |
| AWS | `**/template.y*ml` / `**/*.template.json` (CloudFormation), `**/cdk.json` + `lib/**/*.ts`, `**/*.tf` with `aws_`, `**/task-definition*.json`, `serverless.y*ml` | `AWS::ECS::*` / task definition → `aws-ecs` + runtime `container`; `AWS::Lambda::Function` → `aws-lambda`; `AWS::ElasticLoadBalancingV2::*` → `load-balancer`; `AWS::RDS::*` → `aws-rds`; `AWS::S3::Bucket` → `s3`; `AWS::SQS::*` → `queue` |
| On-prem IIS / Windows | `**/web.config`, `**/Web.*.config` (environment transforms; production first), `**/*.SetParameters.xml`, `**/*.pubxml`, `**/parameters.xml`, `deploy/**/*.ps1`, `**/deploy*.ps1`, `**/*Installer*.cs` (source — consent-gated) | `system.webServer` / `system.serviceModel` structure → `iis-site` inside `iis-server`, WCF services, bindings; `applicationPool` → `app-pool`; Windows service installer → `windows-service`. **connectionStrings and appSettings: names only via `--keys`** (it reads XML), never their values; connection-string names → data `sql-server`. Transforms show which endpoints production uses |
| Java app servers | `**/server.xml`, `**/application*.yml`, `**/application*.yaml`, `**/application*.properties`, `pom.xml` / `build.gradle` (packaging only) | runtime `app-server`; `spring.datasource.url` host → data `database` (host to the host table) |
| Other PaaS | `Procfile`, `app.yaml`, `vercel.json`, `netlify.toml`, `fly.toml` | host `service` with `tag:` set to the platform name |
| CI/CD (all hosting) | `azure-pipelines*.y*ml`, `pipelines/**/*.y*ml`, `.azure-pipelines/**/*.y*ml`, `build/**/*.y*ml` (read even though `build/` is otherwise excluded), `.github/workflows/*.y*ml`, `.gitlab-ci.yml`, `Jenkinsfile` | each pipeline → `pipeline`; image push → `registry`; deploy step → `deploy` flow to the compute host; manual approval → detail line |
| Documents (all hosting) | `.claude/architecture/*.md` (root first), `**/.claude/architecture/*.md` (sub-projects of a multi-solution repository), `docs/**/*runbook*.md`, `docs/**/*recovery*.md`, `docs/**/*disaster*.md`, `docs/**/dr-*.md`, `docs/**/*-dr*.md`, `docs/**/*_dr*.md`, `docs/**/*deployment*.md`; also list `docs/**/*.docx` and `docs/**/*.pdf` with those words in the name (not readable — cited only as the reason for a `⚠ TODO`) | **the hosting model** when no deployment file shows it, failover / DR site, backups, firewalls, DNS, user groups, identity provider, monitoring: cited by document line |
| Settings (keys only) | `.env.example`, `.env.template`, `.env.sample`, `appsettings*.json`, `values*.yaml`, `config/*.y*ml` | key **names** suggest flows: `*_DB_*` / `*_HOST` → data, `*_URL` → external, `AZURE_*` / `AWS_*` → cloud services. **Do not open these files**: run `arch-spec-scan.cjs --keys`, which prints key names and line numbers only |

**Not recognised:** if no hosting row has evidence, draw one `server` box named after the
application with `todo: true` and the detail `⚠ TODO: hosting not found — searched: {the globs
above}`. Do not guess a hosting model.

---

## Read budget (AC-NF2)

`MAX_FILES_PER_ROLE = 15`. This is the only place the cap is set.

- Search with the globs above only. Never list or read the whole tree.
- Skip these folders everywhere: `node_modules/`, `bin/`, `obj/`, `dist/`, `build/` (except the
  CI/CD row's `build/**/*.y*ml`), `.git/`, `vendor/`, `packages/`, `.venv/`, `venv/`, `target/`,
  `.next/`, `coverage/`, `.claude/` (except `.claude/architecture/`), and anything `.gitignore`
  (or `.tfignore` in a TFVC repository) excludes.
- When a role has more than 15 matches, read them in this order: paths for production (`prod`,
  `production`, `prd`, `live`) first, then glob priority order, then shortest path first. List
  every match not read under **Skipped (cap)** in the Step 7 summary.
- Every file is read once and counts once, toward the role of what it holds, not toward the
  row or rows its path matches (`pipelines/k8s/deployment.yaml` matches the Kubernetes and the
  CI/CD rows but counts once, as runtime). Kubernetes `Namespace` and `NetworkPolicy` count as
  host; `Deployment` / `StatefulSet` as runtime; `Service` / `Ingress` as proxy;
  `PersistentVolumeClaim` as data; `Secret` / `ConfigMap` as config. A file holding several
  kinds counts toward the role of its first kind. Documents count as their own group, with the
  same cap.
- `.env` itself is never opened or cited. Templates (`.env.example`, `.env.template`, `.env.sample`,
  `appsettings*.json`, `values*.yaml`, `config/*.y*ml`) are not opened either. Their key names and
  line numbers come from `arch-spec-scan.cjs --keys`.
- Files marked *source — consent-gated* above are read only after the Step 3 consent prompt
  (Category B, `../../shared/source-file-consent.md`), and only for the one fact named.

---

## Searching large repositories

The Glob tool cannot skip folders and can time out in a large repository (it walks
`node_modules`). Then list candidates with a pruned `find` (names only, no contents), one row at a
time, for example:

```bash
find . \( -name node_modules -o -name bin -o -name obj -o -name dist -o -name .git -o -name vendor \
          -o -name packages -o -name .venv -o -name venv -o -name target -o -name .next -o -name coverage \) -prune \
       -o -type f \( -iname 'web.config' -o -iname 'web.*.config' -o -iname '*.pubxml' -o -iname '*.setparameters.xml' \) -print
```

Keep the list in the conversation; do not write it to a file.
