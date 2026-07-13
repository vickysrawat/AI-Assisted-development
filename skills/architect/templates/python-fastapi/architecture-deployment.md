<!-- TEMPLATE -->
# Architecture — Deployment & Operations

> Populated by the architect skill Step 0.5 deployment questionnaire.
> Reviewed and approved by the developer before writing.
> Update with `/update-arch --deployment` to re-run the questionnaire.

---

## Hosting Model

<!-- container | azure-app-service | aws-ecs | kubernetes | bare-asgi | mixed -->
> ⚠ Not yet answered — run the architect skill to populate

## CI/CD Pipeline

| Item | Value |
|---|---|
| Tool | |
| Pipeline file | |
| Organisation | |
| Project | |
| Auto-deploy to staging | |
| Approval gate before production | |
| Work item linking | |

## Environments

| Environment | Purpose | Deployment trigger | Who approves |
|---|---|---|---|
| Local | Development | Manual | Developer |
| | | | |
| Production | | | |

## Authentication

### Provider

> ⚠ Not yet answered

### Identity Provider Configuration

| Item | Value |
|---|---|
| Provider (Entra ID / Auth0 / Keycloak / Cognito / other) | |
| Token validation | |
| Scopes / roles | |
| Service-to-service auth | |
| Frontend token storage (if SPA) | |

## Secrets Management

| Secret type | Storage | Notes |
|---|---|---|
| Connection strings | | |
| API keys | | |
| Client secrets / certs | | |

## Database

| Item | Value |
|---|---|
| Engine | |
| Migration strategy | |
| Backup schedule | |
| RTO | |
| RPO | |

## Runtime Configuration (ASGI)

| Item | Value |
|---|---|
| Python version on server | |
| ASGI server (uvicorn/gunicorn+uvicorn workers) | |
| Worker count / concurrency | |
| Host / port | |
| Health probe path | |

## Container Configuration (if containerised)

| Item | Value |
|---|---|
| Base image (e.g. python:3.12-slim) | |
| Registry | |
| Orchestration | |
| Health probe path | |
| Restart policy | |

## Rollback Procedure

> ⚠ Not yet documented — critical for production readiness

## SPA Authentication (if a SPA frontend is present)

> Only populated if a SPA frontend with authentication was detected.

| Item | Value |
|---|---|
| OAuth2 flow | |
| Route protection | |
| Token attachment to API calls | |
| Silent token refresh | |
| Auth error handling | |
| Post-login redirect | |
| Logout strategy | |

## Known Infrastructure Constraints

> ⚠ Not yet documented

## Non-Functional Requirements & Constraints

<!-- Hybrid: extract detectable signals from code/config (rate limiting, response caching,
     resource limits, health/readiness probes, HSTS/CORS); the targets/SLAs are usually
     human knowledge — captured via the Step 0.5 NFR questions or flagged. -->

| Item | Value |
|---|---|
| Performance target (p95 / throughput) | |
| Expected peak load | |
| Availability / uptime target | |
| Scaling model (vertical / horizontal / autoscale) | |
| Rate limiting | |
| Caching strategy | |
| Compliance frameworks (e.g. SOC 2, GDPR, HIPAA) | |
| Data residency constraints | |

> ⚠ Not yet answered — run the architect skill / `/update-arch --deployment` to populate
