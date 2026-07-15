# Architecture — Deployment & Operations

## Hosting Model
This is a Claude Code plugin — not a web service. Developers install it locally
via the Claude Code plugin registry. The installed path resolves to
.
There is no server, container, or hosting infrastructure.

## CI/CD Pipeline
| Item | Value |
|---|---|
| Tool | None — manual release process |
| Auto-deploy to staging | No |
| Approval gate before production | No |
| Work item linking | No |

## Environments
| Environment | Deployment trigger |
|---|---|
| Dev | Developer installs directly from source repo |
| Published | Manual publish to KirklandAndEllis marketplace |

## Secrets Management
Only  — stored as a Windows User Environment Variable.
No other secrets. The plugin reads this at runtime; it is never committed to source.
Secret-guard hook () blocks accidental commit to .

## Authentication
| Item | Value |
|---|---|
| Authentication | Not applicable — local plugin, no server endpoints |

## Database
No database. Plugin state is stored in flat files under  and .

## Rollback Procedure
No documented rollback procedure. If a bad version is installed, developers must
manually re-install the previous version from the marketplace.

## Known Infrastructure Constraints
- Plugin path resolution depends on  in -  in the project root must be kept current after plugin upgrades
- All ADO REST API calls require  on the corporate network

## Non-Functional Requirements & Constraints
| Item | Value |
|---|---|
| Performance target | None defined |
| Expected peak load | Single developer session |
| Availability / uptime target | None (local tool) |
| Scaling model | N/A |
| Rate limiting | N/A |
| Caching strategy | File-based cache (, ) |
| Compliance frameworks | None |
| Data residency constraints | None |
