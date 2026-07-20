<!-- TEMPLATE -->
# Architecture — Security

> Load this file when adding an endpoint, role, or permission, when changing who
> can do what, or when running a security review. Consumed by the security skill.
>
> Auth *mechanics* (Entra ID config, token validation) live in
> `architecture-deployment.md`. This file is the *authorization model* and trust map.

## Trust Boundaries / Zones

> Where trust changes: browser → API, API → DB, API → external service, internal → DMZ.
> Note what is authenticated/validated at each crossing.

<!-- Trust-zone map. Renders in VS Code (Mermaid preview extension), Azure DevOps, and GitHub.
     Only include boundaries confirmed from the codebase — never invent. -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    Browser["Browser / API Client"] -->|"HTTPS — JWT validated"| API[".NET API"]
    API -->|"internal — parameterised SQL"| DB[("Database")]
    API -->|"HTTPS"| Ext[["External Service"]]
    style Browser fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style API fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style DB fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
    style Ext fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
```

</div>

> ⚠ Could not determine — populate from actual auth/transport config

## Authorization Model

| Action / Resource | Role / Policy | Enforced at |
|-------------------|---------------|-------------|

<!-- From code: [Authorize(Roles=…)], [Authorize(Policy=…)], AddAuthorization policies,
     IAuthorizationHandler, resource-based checks. Name the class/method that enforces. -->

## Business Rules Gating Actions

> Rules beyond simple role checks (e.g. "only the matter owner may close it",
> "cross-tenant access denied"). Usually human knowledge.

> ⚠ Could not determine — needs manual input

## Secrets Handling (summary)

> Cross-links `architecture-deployment.md` → Secrets Management. Note here only what
> the *application code* does (KeyVault client, config providers, no secrets in source).

## Sensitive Data Handling

> Which endpoints/tables carry B1–B7 data (see `business-context-severity.md`), and how
> it is protected in transit / at rest / in logs.

> ⚠ Could not determine — needs manual input
