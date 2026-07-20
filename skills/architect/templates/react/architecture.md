<!-- TEMPLATE -->
# Architecture

> Load this file when adding new features, understanding project structure,
> or onboarding to the codebase.

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | |
| Meta-Framework | |
| Routing | |
| State Management | |
| UI Component Library | |
| HTTP Client | |
| Testing | |
| Build tool / CI/CD | see `architecture-deployment.md` |

## End-to-End Architecture

<!-- Whole-system view. Renders in VS Code (with the Mermaid preview extension),
     Azure DevOps, and GitHub. Only include nodes confirmed from source — never invent. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    User --> SPA[Web App]
    SPA -->|HTTPS| API[Backend API]
    API --> DB[(Data Store)]
    SPA --> Ext[[External Service]]
    style User fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style SPA fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style API fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style DB fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style Ext fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
```

</div>

## Layered View

<!-- Real tiers with dependency direction, derived from actual imports/module boundaries
     (not assumed layering). Replaces any former ASCII layer diagram. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart TB
    Components --> Services
    Services --> State[State / Store]
    Services --> Http[HTTP Layer]
    style Components fill:#3498DB,color:#ffffff,stroke:#1a5276,stroke-width:2px
    style Services fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style State fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style Http fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
```

</div>

> ⚠ If the layer graph cannot be determined, keep this marker instead of an empty
> diagram — needs manual input.

## Folder Structure

| Folder | Purpose |
|--------|---------|

## Component Library Inventory

| Component | Purpose |
|-----------|---------|

## API Consumption Map

| Hook / Service | API Endpoint | HTTP Method |
|---------------|-------------|-------------|

## Routing Structure

| Route | Component | Layout | Auth Required |
|-------|-----------|--------|--------------|

## State Management

| Scope | Pattern | Store / Atom |
|-------|---------|-------------|
