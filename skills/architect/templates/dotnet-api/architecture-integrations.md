<!-- TEMPLATE -->
# Architecture — Integrations & External Dependencies

> Load this file when adding or changing a call to an external system, or when
> reasoning about failure behavior, timeouts, and resilience.
>
> This is *what we depend on* — distinct from `architecture-deployment.md` (our own infra).

## External Dependencies

| Dependency | Kind | Contract (protocol / endpoint) | Called from | Auth |
|------------|------|-------------------------------|-------------|------|

<!-- Kind: REST API · SOAP · message queue · event bus · SMTP · file share · DB link · SDK -->

## Resilience & Failure Behavior

| Dependency | Timeout | Retry / backoff | Circuit breaker | On failure (what happens) |
|------------|---------|-----------------|-----------------|---------------------------|

<!-- Extract from code where present (HttpClient timeouts, Polly policies, named clients).
     "On failure" and SLA/ownership are usually human knowledge — flag if not in code. -->

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
<!--             Example row: | TrackersPhase12 | upstream | service | ../KE.KMS.Trackers.Phase12 | -->
