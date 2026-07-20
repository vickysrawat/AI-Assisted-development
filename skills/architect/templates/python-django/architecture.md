<!-- TEMPLATE -->
# Architecture

> Load this file when adding a new layer, module, middleware, or endpoint,
> or when needing to understand the overall structure.

## Technology Stack

| Category | Technology |
|----------|------------|
| Language / runtime | |
| Framework | |
| Authentication | |
| Data Access / ORM | |
| Database | |
| Migrations | |
| Validation | |
| Logging | |
| API Documentation | |
| Testing | |
| Build tool | |
| CI/CD pipeline | see `architecture-deployment.md` |
| Deployment model | see `architecture-deployment.md` |

## End-to-End Architecture

<!-- Whole-system view. Renders in VS Code (with the Mermaid preview extension),
     Azure DevOps, and GitHub. Only include nodes confirmed from source — never invent. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    User --> API[API]
    API --> Svc[Services]
    Svc --> Repo[Repositories]
    Repo --> DB[(Database)]
    Svc --> Ext[[External Dependency]]
    style User fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style API fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Svc fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Repo fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style DB fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style Ext fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
```

</div>

## Layered View

<!-- Real tiers with dependency direction, derived from actual module/package references
     (not assumed layering). Replaces any former ASCII layer diagram. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart TB
    Presentation --> Application
    Application --> Domain
    Application --> Infrastructure
    Infrastructure --> Domain
    style Presentation fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style Application fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Domain fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style Infrastructure fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
```

</div>

> ⚠ If the layer graph cannot be determined, keep this marker instead of an empty
> diagram — needs manual input.

## App Structure

```
[project root]/
```

## Apps & Responsibilities

## Middleware Chain

```
[in order]
```

## API Endpoints / Views

| Handler | HTTP | Route | Auth | Request | Response |
|---------|------|-------|------|---------|----------|

## Settings of Note

| Section | Binding | Purpose |
|---------|---------|---------|

## Background Jobs

> ⚠ Could not determine — needs manual input
