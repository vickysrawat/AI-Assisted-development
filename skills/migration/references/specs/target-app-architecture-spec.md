# Spec: TARGET-APP-ARCHITECTURE.md

_Loaded by migration SKILL.md at Stage 0 end / Stage 1 start._
_Defines the format for the architecture standards document produced before source analysis._
_This document is generated from Stage 0 Q&A answers and carries architecture standards
into Stage 1 for use in all subsequent documents._

---

## Document: TARGET-APP-ARCHITECTURE.md

**Filename:** `ADO-{ADO_ID}-target-app-architecture.md`
**Purpose:** Records the confirmed target application architecture decisions. This is the compact
standards reference that Stage 4 cluster agents use — it must be self-contained and precise.

**When generated:** After Stage 0 TARGET spec confirmed AND Stage 1 architecture docs approved.
This document is updated to reflect the full decisions made during Stage 1.

### Required Sections

**## Authentication**
```
Provider:        {e.g. Entra ID (Azure AD) | Auth0 | Custom JWT | API Key | None}
Flow:            {OAuth 2.0 + OIDC | JWT Bearer | API Key | None}
Multi-tenant:    {Yes / No}
NuGet/package:   {e.g. Microsoft.Identity.Web | none}
Setup pattern:   {exact Program.cs registration — one code block}
Claims mapping:  {e.g. sub → ClaimTypes.NameIdentifier (configure NameClaimType)}
                 {roles → ClaimTypes.Role (configure RoleClaimType = "roles")}
Standard:        All protected endpoints MUST have [Authorize].
                 [AllowAnonymous] requires an inline comment explaining why.
```

**## Infrastructure**
```
Cloud:           {Azure | AWS | GCP | On-premises}
Hosting:         {App Service | AKS | ECS | IIS | Docker | Functions}
Database:        {e.g. Azure SQL — sqlserver provider, connection string via Key Vault}
Caching:         {Redis (IDistributedCache abstraction) | In-memory | None}
Message queue:   {Azure Service Bus | RabbitMQ | None}
```

**## Secrets**
```
Storage:         {Azure Key Vault | AWS Secrets Manager | Environment variables}
Pattern:         IConfiguration reads from Key Vault at startup via DefaultAzureCredential
Standard:        NEVER hard-code secrets. NEVER log secret values. All secrets via {storage}.
Connection str:  {Key Vault secret name: {app-name}-db-connection-string}
```

**## Observability**
```
Logging:         {e.g. Serilog + Azure Application Insights}
Log pattern:     _logger.LogInformation("{Action} completed for {EntityId}", action, id)
                 Correlation ID: propagated via X-Correlation-Id header, logged on every line
Tracing:         {OpenTelemetry | Application Insights | None}
Health endpoint: /healthz — checks: database{, cache}{, external deps}
```

**## API Standards**
```
Versioning:      {URL path: /api/v1/ | Header | None}
Error format:    {RFC 7807 ProblemDetails | Custom envelope}
Rate limiting:   {IP-based | User-based | None}
CORS origins:    {explicit origins list — NEVER AllowAnyOrigin in production}
```

**## Code Standards**
```
Data access:     {Dapper with parameterised SQL | EF Core | JPA}
Async:           All I/O operations MUST be async. NEVER .Result or .Wait().
Null safety:     Nullable reference types enabled (<Nullable>enable</Nullable>).
Logging:         ILogger<T> injected via constructor. Never Console.WriteLine.
```

**## Architecture Pattern**
```
Pattern:         {simplified | four-layer clean architecture}
Rationale:       {one sentence from proportionality check}
Fitness tests:   {NetArchTest included | ArchUnit included | deferred | skipped}
```
