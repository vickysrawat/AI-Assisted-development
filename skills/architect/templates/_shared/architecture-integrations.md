<!-- TEMPLATE -->
# Architecture — Integrations & External Dependencies

> Load this file when adding or changing a call to an external system, or when
> reasoning about failure behavior, timeouts, and resilience.
>
> This is *what we depend on* — distinct from `architecture-deployment.md` (our own infra).

## External Dependencies

| Dependency | Kind | Contract (protocol / endpoint) | Called from | Auth |
|------------|------|-------------------------------|-------------|------|

<!-- Kind: REST API - SOAP - gRPC - message queue - event bus - SMTP - file share - DB link - SDK -->

<!-- Integration map — only include connections confirmed from codebase — never invent -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    App["Application"] -->|"protocol / auth"| Dep1["External Service"]
    App -->|"protocol / auth"| DB[("Database (if external)")]
    style App fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Dep1 fill:#1ABC9C,color:#ffffff,stroke:#0E8472,stroke-width:2px
    style DB fill:#2C3E50,color:#ffffff,stroke:#1a252f,stroke-width:2px
```

</div>

> ⚠ Could not determine — populate from actual API calls, SDK usage, and connection strings

## Resilience & Failure Behavior

| Dependency | Timeout | Retry / backoff | Circuit breaker | On failure (what happens) |
|------------|---------|-----------------|-----------------|---------------------------|

<!-- Extract from code where present (HTTP client timeouts, retry/backoff policies, SDK configs).
     "On failure" and SLA/ownership are usually human knowledge - flag if not in code. -->

## Ownership & SLA

| Dependency | Owning team / vendor | SLA / availability target | Support contact |
|------------|----------------------|---------------------------|-----------------|

> ⚠ Could not determine — needs manual input

## Data Exchanged

> What data crosses each boundary (and any B1–B7 sensitivity — see
> `business-context-severity.md`). Flag PII / privileged data leaving the system.

> ⚠ Could not determine — needs manual input
