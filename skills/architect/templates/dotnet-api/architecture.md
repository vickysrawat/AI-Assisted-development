<!-- TEMPLATE -->
# Architecture

> Load this file when adding a new layer, project, middleware, or endpoint,
> or when needing to understand the overall structure.

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | |
| Authentication | |
| Data Access | |
| Database Driver | |
| Logging | |
| Configuration | |
| API Documentation | |
| Health Checks | |
| Testing | |
| CI/CD pipeline | see `architecture-deployment.md` |
| Deployment model | see `architecture-deployment.md` |

## Solution Structure

```
[solution name]/
```

## End-to-End Architecture

<!-- Whole-system view. Renders in VS Code (with the Mermaid preview extension),
     Azure DevOps, and GitHub. Only include nodes confirmed from source — never invent. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    User --> API[.NET API]
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

<!-- Real tiers with dependency direction, derived from <ProjectReference> edges
     (not assumed Clean Architecture). Replaces the former ASCII layer diagram. -->

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

> ⚠ If the layer graph cannot be determined from project references, keep this
> marker instead of an empty diagram — needs manual input.

## Project Responsibilities

| Project | Responsibility | DI Method | InternalsVisibleTo |
|---------|---------------|-----------|-------------------|

## Middleware Pipeline Order

```
[middleware in order]
```

## API Endpoints

| Controller | HTTP | Route | Auth | Return Type |
|-----------|------|-------|------|-------------|

## Configuration Sections

| Section | Model Class | Purpose |
|---------|-------------|---------|

## Background Jobs

> ⚠ Could not determine — needs manual input
