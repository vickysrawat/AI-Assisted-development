# Spec: Integration Verification

_A **reusable source-analysis capability** invoked by any migration-family skill
(**Upgrade · Rewrite · Replatform**) during source analysis, **before options are presented**.
Defines how to ground-truth verify every external integration's Kind, Transport, and Auth from
source artifacts — and how to classify what the integration does so the options presentation can
surface the right architectural choices._

> **Why before options.** Options present assurance × effort × TCO. Those numbers are wrong if
> integrations are assumed rather than verified. A WCF service misidentified as REST produces the
> wrong effort estimate. A data-access-only WCF service that could be inlined as a project
> never appears as an option at all. Integration verification is the prerequisite that makes the
> options presentation accurate.

---

## Who invokes this — per-skill binding

| Skill | When invoked | Output feeds |
|---|---|---|
| **Rewrite** | During source analysis, **before** presenting options (between Step 1 and Step 2) | options (effort/risk per option) · `migration-feasibility.md` · `target-integration-architecture.md` |
| **Replatform** | During intake (R1), **before** presenting cloud-target options | options (integration handling per option) · `migration-feasibility.md` · `target-integration-architecture.md` |
| **Upgrade** | During gap/risk analysis (Step 3) | gap/risk report integration rows · `migration-feasibility.md` |

The output of this spec — the **Integration Inventory** — is the authoritative list of verified
integrations for the migration. Every downstream document (feasibility, target design, options) reads
from it; none re-derives independently.

---

## Two-tier verification

Verification runs in two tiers. Tier 2 is attempted whenever `additionalDirectories` points at the
service source. Never skip Tier 2 if the source is available — client-side evidence alone cannot
classify what the service does.

### Tier 1 — Client-side (always available)

Read the source app being migrated. Establishes **what the integration is** (Kind, Transport, Auth).

### Tier 2 — Server-side (when `additionalDirectories` provides the service source)

Read the service's own codebase. Establishes **what the integration does** (classification), which
drives the option derivation. Required for option derivation — without it, classification is `unknown`.

---

## Per-Kind discovery — Tier 1 (client-side)

### WCF

**Primary sources (in order):**
1. `Web.config` / `app.config` — `<system.serviceModel>` block:
   - `<bindings>` → binding type = the transport shape
   - `<security mode>` and `<transport clientCredentialType>` = auth scheme
2. Generated proxy class (`Reference.cs`, `*.svcmap`) — operation signatures and endpoint address
3. WSDL file (`.wsdl`) if present — full contract including operations, fault types, and binding details
4. `ServiceReference.ClientConfig` — client-side endpoint name and address

**Binding → transport mapping:**

| Binding type | Transport | Notes |
|---|---|---|
| `basicHttpBinding` | HTTP/HTTPS | No WS-* features; simplest WCF binding |
| `wsHttpBinding` | HTTP/HTTPS | WS-Security, WS-ReliableMessaging support |
| `netTcpBinding` | TCP | High-performance internal; requires open TCP port |
| `netNamedPipeBinding` | Named pipe | Same-machine only |
| `webHttpBinding` | HTTP/HTTPS | REST-style WCF (no SOAP envelope) |
| `customBinding` | varies | Read the binding stack explicitly — no shortcut |

**Auth scheme from `<transport clientCredentialType>`:**

| clientCredentialType | Auth | NTLM vs Kerberos |
|---|---|---|
| `None` | Anonymous | — |
| `Basic` | HTTP Basic | — |
| `Windows` | Windows-integrated | NTLM if no SPN configured; Kerberos if SPN present and domain-joined. Look for SPN in endpoint address or `<identity><servicePrincipalName>` |
| `Certificate` | Client certificate | — |
| `Ntlm` (explicit) | NTLM | Confirmed NTLM |
| `Negotiate` | NTLM or Kerberos | Environment-dependent; surface as `PARTIAL` and ask developer |

---

### REST / HTTP

**Primary sources:**
1. Assembly references → `HttpClient`, `RestSharp`, `Refit`, `Flurl`
2. `appsettings.json` / `web.config` → base URL, API key config key, timeout settings
3. OpenAPI / Swagger file (`.json` or `.yaml`) — full endpoint contract if present
4. Generated typed client class → operation signatures
5. Bearer token acquisition code → auth scheme (OAuth2 client-credentials / API key / etc.)

**Auth detection:**
- `Authorization: Bearer` header in code → OAuth2 / JWT
- `X-Api-Key` / `X-API-Key` header in code → API key
- No auth header, internal URL → anonymous or network-level auth
- Certificate reference in config → mutual TLS

---

### Direct Database

**Primary sources:**
1. DI registrations (`Program.cs` / `Startup.cs`) → `AddDbContext<>`, `AddDapper`, `services.AddSingleton<IDbConnection>`
2. `appsettings.json` / `web.config` → connection string → provider prefix reveals DB type:
   - `Data Source=` / `Server=` (SQL Server)
   - `Host=` (PostgreSQL)
   - `Data Source=*.db` (SQLite)
   - `mongodb://` (MongoDB)
3. ORM/access library from assembly:
   - `Microsoft.EntityFrameworkCore.*` → EF Core
   - `Dapper` → Dapper + raw SQL
   - `System.Data.SqlClient` / `Microsoft.Data.SqlClient` → ADO.NET
4. `*.edmx` file → EF 6 / Database-First model

**Auth from connection string:**
- `Integrated Security=True` / `Trusted_Connection=True` → Windows auth / service account
- `User ID=` / `Password=` → SQL auth (flag: credentials must move to Key Vault)
- No credentials + managed identity config → MSI (already cloud-aware)

---

### Message Queue

**Primary sources:**
1. Assembly references:
   - `Azure.Messaging.ServiceBus` → Azure Service Bus
   - `RabbitMQ.Client` → RabbitMQ
   - `MassTransit` → abstraction layer (look at transport config for the underlying broker)
   - `NServiceBus` → abstraction layer (same)
   - `System.Messaging` → legacy MSMQ
2. `appsettings.json` → connection string key, queue/topic name, subscription name
3. Consumer / producer class → message types handled

---

### gRPC

**Primary sources:**
1. `.proto` files in the project → service contract and message types
2. Assembly references → `Grpc.Net.Client`, `Google.Protobuf`, `Grpc.Core`
3. `appsettings.json` → service address
4. Generated client stub → operation signatures and channel config

---

## Per-Kind discovery — Tier 2 (server-side)

Tier 2 is available when `additionalDirectories` includes the service's source repository or folder.
Read the service's own codebase to classify what it does.

### WCF service — what to read

1. `[ServiceContract]` interface → full operation list and signatures
2. Implementation class (`[ServiceBehavior]`) → what each operation actually does:
   - DB calls only (`DbContext`, `SqlConnection`, `Dapper` queries) → `data-access-only`
   - Business rules, validations, orchestration without DB → `business-logic`
   - Both → `mixed`
3. Service's own `Web.config` → its own external dependencies (does it call OTHER services?)
4. Service's own assembly references → ORM, external clients, messaging

### REST service — what to read

1. Controller classes → routes and actions
2. Service/repository layer → same data-access vs. business-logic classification
3. Its own `appsettings.json` → its external dependencies

---

## Classification (requires Tier 2)

| Classification | Definition | Signal in implementation |
|---|---|---|
| `data-access-only` | Only reads/writes data; no independent business rules | Methods consist of DB calls; no branching business logic; no external service calls beyond its own DB |
| `business-logic` | Implements business rules, validation, or orchestration independent of data access | Complex branching, calculations, workflow, or calls to other services |
| `mixed` | Both data access and business logic in the same service | Has both DB calls AND business-rule branching in the same operations |
| `unknown` | Tier 2 not available | `additionalDirectories` does not include this service's source |

---

## Option derivation (from classification)

Once classified, derive the architectural options for this integration. These options are surfaced in
the **options presentation** — each high-level target option states how it handles each integration.

| Classification | Options to present |
|---|---|
| `data-access-only` | **A · Inline as project** — service code becomes a class library in the new solution; network call eliminated; code adapted to match new data-access pattern (Dapper etc.) · **B · Wrap as NuGet package** — code packaged and versioned; reusable across apps; still owned by this team · **C · Keep as external service** — migrate the client call only (WCF proxy → REST/CoreWCF); service continues to run as-is |
| `business-logic` | **A · Keep as external service** — migrate the client call only; service continues independently · **B · Rewrite the service itself** — only if the service is small, in scope, and has a single consumer |
| `mixed` | **A · Keep as external service** (safest) · **B · Extract the data-access part** (inline/NuGet), keep business-logic part as an external service · **C · Rewrite the service** (full scope; highest effort) |
| `unknown` | Present all options above; flag that classification requires Tier 2 evidence; recommend obtaining service source access before committing to an option |

**Option A (inline as project) — cascade effects:**
- `target-component-architecture.md` gains a new component (the inlined library)
- `target-data-architecture.md` absorbs the data-access patterns from the service
- `target-integration-architecture.md` records the integration as "eliminated — inlined"

**Option B (NuGet package) — cascade effects:**
- `target-component-architecture.md` notes a package dependency
- `migration-feasibility.md` gains a packaging effort item (YELLOW)
- `target-integration-architecture.md` records the integration as "replaced — NuGet package"

**Option C/A (keep as external service) — cascade effects:**
- `target-integration-architecture.md` records the new client approach (WCF proxy → REST/CoreWCF/MSI)
- `target-security-architecture.md` covers the auth change (NTLM → Bearer/MSI)

---

## Verification states

| State | Meaning | Effect |
|---|---|---|
| `VERIFIED` | Kind, Transport, and Auth confirmed from source artifacts with a PROV citation | Rated at evidence-based risk in feasibility and options |
| `PARTIAL` | Some evidence found but ambiguity remains (e.g. `Negotiate` auth, `customBinding`) | **Blocks APPROVE OPTIONS** — developer must resolve before options are presented |
| `UNVERIFIED` | No evidence found in Tier 1 or Tier 2 | RED / UNKNOWN in feasibility — never assessed on an assumption |

**PROV citation format:** `PROV: {relative-file-path}#{line-or-section}` — e.g.
`PROV: src/Web.config#L45, src/Services/DealDataService.cs#L12`

Every `VERIFIED` row must have at least one PROV citation. No citation = `PARTIAL` at best.

---

## Integration Inventory — output format

Written to `docs/migrations/{MIGRATION_ID}/integration-inventory.md`. This is the authoritative
source for all downstream documents.

```markdown
# Integration Inventory — {Migration Name}
Verified: {date} | Source: {source app path} | Tier 2 available: {Yes — {service paths} | No}

| Integration | Kind | Transport | Auth | Classification | Recommended option | Verification | Evidence (PROV) |
|---|---|---|---|---|---|---|---|
| DealDataSvc | WCF | basicHttpBinding | NTLM | data-access-only | A · inline as project | VERIFIED | Web.config#L45, Reference.cs#L12 |
| PaymentGateway | REST | HTTPS | Bearer (OAuth2) | business-logic | A · keep external | VERIFIED | appsettings.json#L23 |
| NotificationQueue | Message Queue | Azure Service Bus | MSI | N/A | A · keep external | VERIFIED | appsettings.json#L31 |
| ReportingEngine | WCF | wsHttpBinding | Negotiate | unknown | present all options | PARTIAL | Web.config#L78 — auth ambiguous: Negotiate may be NTLM or Kerberos; confirm with infra team |
```

**PARTIAL rows** must include a resolution note explaining what is ambiguous and what information
the developer must supply. The row is not promoted to `VERIFIED` until the developer confirms.

---

## Hard rules

- NEVER present options before the Integration Inventory is complete — integrations with `PARTIAL` or
  `UNVERIFIED` status produce inaccurate effort and TCO estimates.
- NEVER classify an integration on an assumed Kind, Transport, or Auth — evidence required.
- ALWAYS attempt Tier 2 before falling back to `PARTIAL` — if `additionalDirectories` includes the
  service source, Tier 2 is REQUIRED, not optional.
- EVERY `VERIFIED` row must carry a PROV citation — no citation means the row is `PARTIAL`.
- `PARTIAL` rows BLOCK `APPROVE OPTIONS` — they must be resolved by the developer before the options
  presentation proceeds.
- `UNVERIFIED` rows are RED in the feasibility assessment — never carry forward as assumed GREEN or YELLOW.
- Option derivation REQUIRES classification — classification REQUIRES Tier 2 — if Tier 2 is
  unavailable, surface as `unknown` and recommend obtaining service source access.
- The Integration Inventory is a single-writer artifact — downstream documents (feasibility, target
  design) read from it; they NEVER re-derive independently.
- For `Negotiate` auth: NEVER assume NTLM or Kerberos — surface as `PARTIAL` and require developer
  confirmation. The distinction is infrastructure-dependent and getting it wrong changes the
  target auth approach.
