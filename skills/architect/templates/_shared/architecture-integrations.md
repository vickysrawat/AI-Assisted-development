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

> What data crosses each boundary (and any B-series sensitivity — see
> `business-context-severity.md`). Flag PII / privileged data leaving the system.

> ⚠ Could not determine — needs manual input

## Locally-Cloned Dependency Repos

> Repos listed in `additionalDirectories` that graph-sync scans for source-level detail.
> Define direction and tier here — graph-sync uses these values to classify graph nodes
> instead of inferring from folder structure. This table is the committed, team-shared
> source of truth for cross-repo relationship metadata.
>
> **How to populate:** run `/update-arch` after adding a new entry to `additionalDirectories`,
> or add a row manually. The architect skill prompts for direction and tier when it detects
> a new `additionalDirectories` root with no matching row here.

| Repo name | Direction | Tier | Local path |
|-----------|-----------|------|------------|

<!-- Direction : upstream (feeds data into this app) · downstream (this app feeds data out) · sibling (peer service, no clear feed direction) -->
<!-- Tier      : service · ui · repository · shared-library · datastore · domain -->
<!-- Local path: path relative to THIS repo root pointing to the cloned dependency repo  -->
<!--             graph-sync resolves this at runtime against additionalDirectories entries -->
<!--             Example row: | TrackersPhase12 | upstream | service | ../Demo.Phase12 | -->
