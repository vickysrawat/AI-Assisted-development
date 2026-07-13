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

```
[trust-zone diagram or list]
```

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
