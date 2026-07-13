<!-- TEMPLATE -->
# Architecture — Deployment & Operations

> Populated by the architect skill Step 0.5 deployment questionnaire.
> Reviewed and approved by the developer before writing.
> Update with `/update-arch --deployment` to re-run the questionnaire.

---

## Hosting Model

<!-- IIS | azure-app-service | container | windows-service | mixed -->
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

<!-- Populate from Q7 if Entra ID detected, Q8 if no auth detected -->

### Provider

> ⚠ Not yet answered

### Entra ID (Azure AD) Configuration

| Item | Value |
|---|---|
| Tenant model | |
| App registrations | |
| Token validation | |
| Scopes / roles | |
| Service-to-service (Managed Identity / Client Credentials) | |
| Frontend token storage (MSAL) | |
| Conditional Access policies | |

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

## IIS Configuration (if IIS hosted)

| Item | Value |
|---|---|
| IIS version | |
| Application pool identity | |
| .NET runtime on server | |
| HTTPS binding | |

## Container Configuration (if containerised)

| Item | Value |
|---|---|
| Base image | |
| Registry | |
| Orchestration | |
| Health probe path | |
| Restart policy | |

## Rollback Procedure

> ⚠ Not yet documented — critical for production readiness


## SPA Authentication (Angular / React)

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
