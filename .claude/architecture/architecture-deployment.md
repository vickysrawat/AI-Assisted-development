# Architecture — Deployment & Operations

## Hosting Model
Developer-local plugin — this is a Claude Code plugin distributed via local
marketplace (install.cjs). It runs on developer machines; there is no hosted server,
container, or IIS process.

## CI/CD Pipeline
| Item | Value |
|---|---|
| Tool | Azure DevOps Pipelines |
| Pipeline file | azure-pipelines.yml |
| Organisation | {ADO_ORG} |
| Project | {ADO_PROJECT} |
| Triggers | main/dev branches, PRs to main/dev, v* tag pushes |
| Stages | CI (branches/PRs): validate + test + coverage + audit · ReleaseValidation (tag): same + version/tag consistency checks |
| Auto-deploy to staging | N/A — no hosted environment |
| Approval gate before production | N/A |
| Work item linking | Not configured |

## Release Flow
Developer runs `npm run bump:patch|minor|major` → `npm run release` → `git push origin main && git push origin v{N}`. Pipeline ReleaseValidation stage fires on tag push and validates version consistency across plugin.json, plugin-manifest.json, and the git tag.

## Environments
| Environment | Deployment trigger |
|---|---|
| Local (developer machine) | install.cjs from marketplace |

## Secrets Management
N/A — no production secrets. The plugin reads environment variables from the developer's shell (e.g. `AZURE_DEVOPS_PAT`) at runtime, never stores them.

## Authentication
| Item | Value |
|---|---|
| Authentication | Intentionally unauthenticated — this is a local developer tool. The ADO PAT for API calls is supplied by the developer via env var; no auth framework is embedded in the plugin itself. |

## Database
None.

## Rollback Procedure
Re-install a previous version: developer re-runs `node install.cjs` pointing to a prior marketplace version, or reverts the `plugin-path.txt` to the previous cache entry. No data loss risk (all state is file-based in the target project's `.claude/` folder).

## Known Infrastructure Constraints
Node.js 20+ required (pipeline uses Node 20; install.cjs enforces this at runtime).
Windows (Git Bash) and Linux/macOS are supported.

## Non-Functional Requirements & Constraints
| Item | Value |
|---|---|
| Performance target | Not formally defined |
| Expected peak load | Single-user, interactive CLI sessions |
| Availability / uptime target | N/A — local tool |
| Compliance frameworks | None defined |
| Data residency constraints | All data stays on developer's local machine / target git repo |
