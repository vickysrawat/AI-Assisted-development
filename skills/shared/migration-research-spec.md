# Migration Research Spec — Schema, Confidence Rendering, and Invocation Contract
_Spec version: 1.0 · Last changed: 2026-09-26 · Applies to: rewrite, upgrade, replatform skills_

This document is the canonical contract between `skills/migration-research-agent/SKILL.md`
(the agent) and the three migration calling skills (rewrite, upgrade, replatform). It defines
the input schema, output bundle schema summary, confidence rendering rules, invocation pattern,
and the per-provider lookup strategy table that calling skills reference.

This document does NOT define the agent's execution internals, WebFetch strategies, or UNKNOWN
fallback behavior. For those, see `skills/migration-research-agent/SKILL.md` directly.

---

## Section 1 — Purpose

The migration-research-agent grounds the migration options analysis in cited external facts.
Calling skills invoke it once at the options phase, receive a confidence-annotated bundle, and
render the facts using the rendering rules in Section 4. This spec is the single source of truth
for that contract — calling skills read Section 5 for the invocation pattern and Section 4 for
rendering rules. They never reimplement either inline.

---

## Section 2 — Discriminated Union Input Schema

The agent accepts a single JSON input with a mandatory `migration_type` discriminator.

> **`plugin_dir` — required in every task payload.**
> The agent runs in an isolated subagent context where `$PLUGIN_DIR` shell variables are not
> available. The calling skill MUST include the resolved absolute path as `plugin_dir` in the
> JSON so the agent can locate `lookup-urls.json` via the Read tool. Set it from the bash
> context where `$PLUGIN_DIR` is already expanded: `"plugin_dir": "$PLUGIN_DIR"`.

**Mode 1 — rewrite / upgrade:**

```json
{
  "migration_type": "rewrite | upgrade",
  "plugin_dir": "<absolute path to the plugin root — e.g. /home/user/.claude/plugins/ai-assisted-development>",
  "source_layers": [
    {
      "stack": "<generic technology name — e.g. angular, dotnet, react, java, python, nodejs>",
      "version": "<version string — e.g. 15, 6, 18>",
      "cloud_hosted": "azure | aws | gcp | null"
    }
  ],
  "target_layers": [
    { "stack": "<technology name>", "version": "<version string>" }
  ],
  "technology_couplings": [
    {
      "pattern": "<specific technology — e.g. 'WCF', 'MSMQ', 'WindowsAuth', 'COM+', 'MSDTC'>",
      "locations_count": "<integer — number of source files containing this coupling>",
      "resolution_approach": "replace | facade"
    }
  ]
}
```

`technology_couplings` is optional (omit or pass `[]` when no technology couplings were found).
`resolution_approach` per entry drives which recommendation type the agent returns:
- `replace` → fetch replacement component recommendations (new technology replaces the coupling)
- `facade` → fetch coexistence pattern recommendations (Strangler Fig / Anti-Corruption Layer)
- `retain` and `defer` couplings are NOT included in this array — the agent skips them entirely

When present, the agent looks up cloud-native or target-stack replacement/coexistence options for
each pattern and includes them in the bundle as a `CloudComponentRecommendation` entry (Section 3).
Populated from `payload.rewrite.technology_couplings` in the checkpoint (written by Step 1.5 coupling
scan). This enables cloud component grounding without the calling skill re-scanning the source.

**Mode 2 — replatform:**

```json
{
  "migration_type": "replatform",
  "plugin_dir": "<absolute path to the plugin root>",
  "source_environment": {
    "type": "on-prem | cloud",
    "runtime": "<description — e.g. 'IIS/.NET 4.8'>",
    "cloud_provider": "azure | aws | gcp | null"
  },
  "target_environment": {
    "cloud": "azure | aws | gcp",
    "components": [
      { "name": "<component name>", "type": "compute | database | storage | messaging | other" }
    ],
    "region": "<e.g. 'East US', 'us-east-1', 'us-central1'>"
  }
}
```

**Constraint:** `stack` and `name` values must be generic, publicly recognisable technology
names only. No internal project names, class names, namespace prefixes, or org-specific identifiers.

---

## Section 3 — Per-Mode Output Bundle Schema

The agent returns a JSON array. Each entry is a confidence-annotated object.

**Mode 1 (rewrite/upgrade) — one entry per layer:**

| Field | Description |
|---|---|
| `layer` | `"stack@version"` — e.g. `"angular@15"` |
| `role` | `"source"` or `"target"` |
| `eol_status` | FactObject — EoL/active status + date |
| `cve_exposure` | FactObject — qualitative level: high / medium / low / UNKNOWN |
| `ecosystem_health` | FactObject — descriptive signal (download trends, release cadence) |
| `hiring_trend` | FactObject — descriptive signal (best-effort; UNKNOWN for niche stacks) |
| `tooling_availability` | FactObject — IDE / CLI / ecosystem support signal |

**Mode 2 (replatform) — one entry per component:**

| Field | Description |
|---|---|
| `component` | Component name as given in the input |
| `cloud` | `"azure"`, `"aws"`, or `"gcp"` |
| `pricing_range` | FactObject — monthly cost range (descriptive string) |
| `sla_percentage` | FactObject — SLA percentage string (e.g. `"99.95%"`) |
| `ga_status` | FactObject — `"GA"` / `"Preview"` / `"Deprecated"` / `"UNKNOWN"` |
| `compliance_certifications` | FactObject — array of cert names found on provider page |
| `egress_cost_signal` | FactObject — per-GB outbound cost (descriptive string) |

**CitationEntry schema (applies to all fields in both modes):**

Every fact the agent returns must carry full citation metadata so calling skills can produce
auditable documents. The cache is never committed — citation fields are the permanent record.

```json
{
  "<field_value_key>": "<the fact — value, status, signal, level, certs[], etc.>",
  "fact_type": "eol_status | cve_exposure | ecosystem_health | hiring_trend | tooling_availability | pricing_range | sla_percentage | ga_status | compliance_certifications | egress_cost_signal",
  "source_type": "vendor | cloud | multi-vendor | community",
  "cloud_provider": "aws | gcp | azure | null",
  "authority": "<primary authority name — e.g. 'Microsoft', 'Eclipse Adoptium', 'Meta (React)', 'AWS'>",
  "applies_to": "<technology + version — e.g. 'dotnet 6', 'Lambda Node.js 18', 'Java 11 (Temurin)'>",
  "claim": "<the fact as a human-readable sentence>",
  "source_url": "<primary source URL — non-null when confidence is high or medium>",
  "canonical_url": "<best URL for a developer to validate manually — always present>",
  "additional_sources": [
    {
      "authority": "<source authority name>",
      "source_url": "<URL>",
      "role": "corroborates | supplements | announcement | context"
    }
  ],
  "conflict_note": "<human-readable explanation when sources disagree — null when absent>",
  "retrieved_date": "<YYYY-MM-DD — always today, even when UNKNOWN>",
  "confidence": "high | medium | low | UNKNOWN",
  "reason": "<why this fact is cited — e.g. 'EoL status drives upgrade urgency in the options analysis'>"
}
```

**`source_type` values and what they mean:**

| Value | Meaning | Examples |
|---|---|---|
| `vendor` | Single authoritative vendor with formal support policy | .NET (Microsoft), Node.js (OpenJS Foundation), Angular (Google) |
| `cloud` | Cloud provider — information fragmented across docs, blogs, policy pages | AWS, GCP, Azure |
| `multi-vendor` | Multiple vendors publish different timelines for the same technology | Java (Oracle/Temurin/Corretto/Zulu), Python (CPython/Conda/distros) |
| `community` | Open-source, no formal EoL/support policy | React, Vue, most npm packages |

When `confidence=UNKNOWN`, the object contains `source_url=null` AND `canonical_url` must be non-null:
`canonical_url` signals "this is where to check manually" without implying the URL was
successfully fetched. Calling skills MUST read `canonical_url` (not `source_url`) when
rendering UNKNOWN facts.

**CloudComponentRecommendation entry (optional — appended to bundle array when `technology_couplings[]` is non-empty):**

When the input includes `technology_couplings[]`, the agent appends one additional entry to the
bundle array with `"type": "coupling_replacements"`. This entry is backward-compatible — callers
that pre-date this field skip entries with an unknown `type`.

```json
{
  "type": "coupling_replacements",
  "technology_coupling_replacements": [
    {
      "pattern": "<technology — e.g. 'WCF', 'MSMQ', 'WindowsAuth', 'EJB'>",
      "target_platform": "azure | aws | gcp | stack-agnostic",
      "resolution_approach": "replace | facade",
      "recommendations": [
        {
          "component": "<cloud service or target technology — e.g. 'Azure Service Bus'>",
          "use_case": "<what WCF pattern this replaces — e.g. 'Async one-way and pub-sub contracts'>",
          "when_to_prefer": "<condition that makes this component the right choice>",
          "tier_guidance": "<tier or configuration note — e.g. 'Standard for low throughput; Premium required for private endpoints and VNET integration'>",
          "coexistence_note": "<for facade resolution_approach only — how the legacy technology and this component coexist>",
          "pattern_name": "<for facade only — architectural pattern: 'Strangler Fig' | 'Anti-Corruption Layer'>",
          "citation": {
            "fact_type": "architectural_pattern",
            "source_type": "cloud | vendor",
            "cloud_provider": "aws | gcp | azure | null",
            "authority": "<e.g. 'Azure Architecture Center', 'AWS Well-Architected Framework'>",
            "applies_to": "<coupling pattern — e.g. 'WCF to Azure migration'>",
            "claim": "<the architectural guidance as a human-readable sentence>",
            "source_url": "<URL to the authoritative architectural guidance page>",
            "canonical_url": "<best URL for a developer to validate>",
            "additional_sources": [],
            "confidence": "high | medium | UNKNOWN",
            "retrieved_date": "<YYYY-MM-DD>"
          }
        }
      ]
    }
  ]
}
```

`resolution_approach` in each replacement entry must match the `resolution_approach` from the
calling skill's `technology_couplings[].resolution_approach` input field:
- `replace` → return replacement component recommendations only
- `facade` → return coexistence recommendations only (with `coexistence_note` + `pattern_name`)
- `retain` / `defer` → agent skips these patterns entirely (no recommendation returned)

If the agent cannot retrieve architectural guidance for a pattern (UNKNOWN): return a single
recommendation entry with `"component": "UNKNOWN"`, `"citation.confidence": "UNKNOWN"`, and
`"citation.canonical_url"` pointing to the provider's architecture docs. Calling skills fall
back to Section 7 offline table for UNKNOWN entries.

---

## Section 4 — Confidence Level Definitions and Rendering Rules

All calling skills MUST apply these rendering rules whenever they include a fact from the
agent bundle in their output. No deviation. No shortcuts. Consistent rendering is what makes
the grounded analysis trustworthy to developers making irreversible migration decisions.

### 4.1 — Inline rendering by confidence tier

| Confidence | Definition | Inline rendering |
|---|---|---|
| `high` | Authoritative vendor documentation found; fact extracted from that page | `{claim} [{authority}, {retrieved_date}]¹` — `¹` resolves to the Citations block entry |
| `medium` | Industry benchmark, survey data, or statistical estimate — not vendor-authoritative | `{claim} (benchmark, {authority}, {retrieved_date})¹` |
| `low` | Data found but inconsistent across sources, or from a non-authoritative source | `⚠ UNVERIFIED: {claim} — see: {canonical_url or source_url}¹` |
| `UNKNOWN` | No authoritative data found within the agent's single invocation | `⚠ NOT FOUND: {fact_type} for {applies_to} — check: {canonical_url}` |

**Stale signal:** when the cache entry age exceeds 30 days, append to every rendered fact:
`[⚠ cached {age}d ago — consider refreshing before decision]`

**CloudComponentRecommendation inline rendering** (for "Coupling addressed" option rows):

| Case | Inline format |
|---|---|
| `replace`, `confidence=high` | `CP-{N} {pattern} → {component} ({tier_guidance}) [{authority}, {retrieved_date}]¹` |
| `replace`, `confidence=medium` | `CP-{N} {pattern} → {component} ({tier_guidance}) (benchmark, {authority}, {retrieved_date})¹` |
| `facade`, `confidence=high` | `CP-{N} {pattern} retained as facade ({pattern_name}); internal path via {component} [{authority}, {retrieved_date}]¹` |
| `UNKNOWN` | `CP-{N} {pattern} → ⚠ NOT FOUND — check: {canonical_url}; see offline fallback (Section 7)` |

The `¹` resolves to the Citations block entry for the architectural guidance, same as other CitationEntry rendering.

**`additional_sources` inline rendering:**
- Non-empty → append after the authority: `[{authority}; also: {source2.authority}, {source3.authority}]`
- For `source_type="multi-vendor"`: always name which vendor the primary claim applies to:
  `{claim} [{authority} — {applies_to}; also: {vendor2}, {vendor3}]¹`
  Example: `.NET 6 EoL: Nov 2024 [Microsoft — dotnet 6; also: .NET Foundation]¹`

**`conflict_note` inline rendering** (only when `conflict_note` is non-null):
`⚠ CONFLICT: {claim} — sources disagree: {conflict_note}. Check: {source_url}¹`

### 4.2 — Source type validation rules

The agent enforces these rules before returning the bundle. Calling skills re-check on receipt
and degrade confidence when violations are detected rather than silently accepting them.
See Section 5 Step 3 for the full integrity check table and the exact violation format to use.

| `source_type` | `additional_sources=[]` + `confidence=high` | `confidence=high` achievable? |
|---|---|---|
| `vendor` | Allowed — single authoritative source is sufficient | Yes |
| `cloud` | WARNING — cloud facts rarely have a single complete source; agent logs a note | Yes, but `additional_sources` expected |
| `multi-vendor` | ERROR — call the fact `confidence=medium` if only one vendor's source is present | Yes, when `additional_sources` covers ≥2 vendors |
| `community` | Allowed — but `confidence` MUST be auto-downgraded to `medium`; no formal policy means high is unverifiable | No — max is `medium` |

### 4.3 — Document-level Citations block (required)

Append a `## Research Citations` block at the end of every options file and design document
that includes facts from the agent bundle. The block must appear even if all facts are `high`
confidence — the retrieved_date and cache age are the permanent audit record.

```markdown
## Research Citations

> Facts in this document were retrieved by the migration-research-agent and cached locally.
> Cache key: `{cache_key}` · Retrieved: `{generated_at}` · Cache age at generation: `{age}d`
> {if age > 30d: ⚠ Cache is stale — facts may have changed. Refresh: delete the cache entry and re-run Step 2.}

| # | Fact type | Applies to | Source type | Authority | Retrieved | Conf. | Source(s) |
|---|---|---|---|---|---|---|---|
| 1 | EoL status | dotnet 6 | vendor | Microsoft | 2026-09-01 | high | [link]({source_url}) |
| 2 | CVE exposure | dotnet 6 | vendor | NIST NVD | 2026-09-01 | medium | [link]({source_url}) |
| 3 | EoL status | Lambda Node.js 18 | cloud (AWS) | AWS | 2026-09-01 | high | [runtimes]({url}); [blog]({url}); [policy]({url}) |
| 4 | EoL status | Java 11 | multi-vendor | Temurin/Oracle/Corretto | 2026-09-01 | high | [Temurin]({url}); [Oracle]({url}); [Corretto]({url}) |
| 5 | EoL status | React 17 | community | Meta (React) | 2026-09-01 | medium | [link]({source_url}) |
```

**Critical rules:**
- NEVER render a `confidence=UNKNOWN` fact without the WARNING prefix. An UNKNOWN fact stated
  as established truth leads to wrong migration decisions at a point of no return.
- For UNKNOWN facts: use `canonical_url` in the rendered warning (not `source_url`, which is null).
- For `high` facts: `source_url` must be non-null — if it is null, treat as UNKNOWN.
- For `multi-vendor` facts: the claim MUST name which vendor's timeline is primary — never
  state "Java 11 is supported until 2027" without "per Temurin" or "per Oracle JDK".
- `[project-specific — requires your input]` is the correct placeholder when a PO framework
  field requires internal data the agent cannot provide. It is not a confidence level.

---

## Section 5 — How Calling Skills Invoke the Agent

Follow these steps exactly. Do not reimplement the invocation pattern inline in a calling skill.

**Step 1 — Construct the typed input JSON**

At the start of the relevant phase (options analysis for rewrite/replatform; gap+risk report for
upgrade), construct the discriminated union input JSON per Section 2. Select the mode matching
the calling skill:
- rewrite → `migration_type: "rewrite"`
- upgrade → `migration_type: "upgrade"`
- replatform → `migration_type: "replatform"`

Use only generic technology names and cloud provider names. Never include internal project
identifiers, class names, file paths, or org-specific terms.

Always include `"plugin_dir": "$PLUGIN_DIR"` in the task JSON. The `$PLUGIN_DIR` variable is
available in the calling skill's bash context and resolves to the plugin root absolute path.
The agent needs this to locate `lookup-urls.json` via the Read tool — shell variables are not
available inside an isolated subagent context.

**Step 2 — Invoke the Agent tool (exactly ONE call)**

```
Agent tool call:
  task: <the constructed JSON input — the full JSON as the task description>
  Receives back: <JSON bundle per Section 3>
```

Make exactly ONE Agent tool call. The agent handles all WebFetch calls internally.
Do NOT invoke the agent multiple times for different fact types within the same run.
Do NOT chain multiple agent calls to compensate for UNKNOWN results — they are correct
terminal states, not errors to retry.

**Step 3 — Receive and validate the bundle (integrity check)**

> **Applies to both live and cached bundles.** When the rewrite skill loads a bundle from the
> machine-level cache (cache hit path), it bypasses Step 2. The integrity check below MUST
> still run — load the bundle from cache, then immediately apply this step before any analysis.

**Error check first:** if the returned object has an `error` field (agent validation failure or
missing lookup-urls.json), surface the message to the developer and stop — do not proceed.

**Integrity check — run on every entry in the returned array.** This step compensates for the
fact that SKILL.md instructions are advisory (the LLM may skip steps under token pressure).
Enforcement happens here, at the consumption boundary. Surface any violation as a
`⚠ Research integrity warning` *before* using the bundle — do not silently accept a bad bundle.

| Check | On violation |
|---|---|
| All required fields present per Section 3 schema (mode-specific) | Flag missing field — treat entry as UNKNOWN for that field |
| All `retrieved_date` values equal today's ISO date (`YYYY-MM-DD`) | Flag as stale — append `[⚠ stale — retrieved_date mismatch]` to every affected fact |
| Every `confidence=high` or `confidence=medium` fact has non-null `source_url` | Degrade to UNKNOWN — render using UNKNOWN rules (Section 4); do not present as grounded |
| Every non-null `source_url` starts with `https://` | Degrade to `confidence=low` — suspect URL shape signals a hallucinated or incorrectly bound value |
| Every `confidence=UNKNOWN` fact has non-null `canonical_url` | Flag as incomplete UNKNOWN — note "no check URL available" in the rendered warning |
| `source_type="multi-vendor"` entries have `additional_sources[]` with ≥ 2 distinct vendor entries | Degrade to `confidence=medium` — a single-vendor claim on a multi-vendor technology is not authoritative |
| `source_type="community"` entries do not have `confidence=high` | Degrade to `confidence=medium` — community packages have no formal support policy (Section 4.2) |

**Violation format** — inline before the affected fact in the options/report output:

```
⚠ Research integrity warning — [{layer or component}] {field}: {violation description}
   Action: {what was done — e.g. "confidence degraded to UNKNOWN", "rendered with UNKNOWN rules"}
```

Do not stop the workflow for integrity violations — surface them and continue with degraded
confidence for affected facts. A partial bundle is more useful than no bundle, provided every
degraded fact is visibly flagged.

**Step 4 — Apply confidence rendering (Section 4) — mandatory**

For every fact you include in the options analysis or report from the agent bundle, apply the
confidence rendering rules in Section 4. This step is not optional.

**Step 5 — Populate PO framework sections from the bundle**

For each PO framework section in the calling skill's options output:
- Use agent bundle facts where they can ground the analysis (cite with Section 4 rendering rules)
- Mark internal-data fields as: `[project-specific — requires your input]` — never guess
- Mark agent UNKNOWN fields with the WARNING rendering (Section 4) — never drop them silently

---

## Section 6 — Per-Provider Lookup Strategy (calling skill reference)

This table summarises the confidence levels calling skills should expect per provider. The
authoritative URL lookup table is `$PLUGIN_DIR/skills/shared/migration-knowledge/lookup-urls.json`
— edit that file to add or update URLs; do not hardcode them here. Confidence levels in this
table must stay in sync with the `confidence` fields in `lookup-urls.json`. If they diverge,
`lookup-urls.json` is the authoritative source.

**Source type by technology** — reference when constructing CitationEntry:

| Technology | `source_type` | `cloud_provider` | `additional_sources` expectation |
|---|---|---|---|
| .NET, Angular, Node.js | `vendor` | null | Optional — single source sufficient at `high` |
| Java (JDK) | `multi-vendor` | null | Required — must include ≥2 vendor sources at `high` |
| Python | `multi-vendor` | null | Required — CPython + distro sources |
| React, Vue, npm packages | `community` | null | Optional — max confidence is `medium` |
| AWS services | `cloud` | `"aws"` | Expected — AWS docs + blog + policy pages |
| GCP services | `cloud` | `"gcp"` | Expected — product docs + deprecation table |
| Azure services | `cloud` | `"azure"` | Expected — docs + SLA + lifecycle pages |

**Cloud provider lifecycle lookup confidence:**

| Provider | `source_type` | Pricing | SLA | Compliance | Lifecycle |
|---|---|---|---|---|---|
| Azure | `cloud` | High — azure.microsoft.com/pricing | High — /support/legal/sla/ | High — learn.microsoft.com/azure/compliance/ | High — learn.microsoft.com/lifecycle/ |
| GCP | `cloud` | High — cloud.google.com/{service}/pricing | High — /sla | High — /security/compliance | High — /docs/deprecations structured table; medium-high — RSS fallback |
| AWS | `cloud` | High — aws.amazon.com/{service}/pricing | High — /legal/service-level-agreements/ | High — /compliance/services-in-scope/ | Medium-high — service-specific docs + RSS; no central EoL portal |

**Note — BigQuery MCP excluded:** Requires a billing-enabled GCP project + bigquery.jobs.create
IAM, which cannot be assumed for a developer running a migration evaluation. WebFetch on
cloud.google.com/{product}/docs/deprecations achieves equivalent confidence (high) for GCP
lifecycle data without any authentication.

---

## Section 7 — Offline Fallback Table for Cloud Component Recommendations

Used when the agent returns `confidence=UNKNOWN` for a `technology_coupling_replacements` entry.
These entries have `confidence: "medium"` (not live-fetched) and carry the spec's last-changed
date as the retrieved date. Always show the stale signal: `[⚠ offline reference — {spec_date}]`.
Never use this table when the agent successfully retrieved live data.

_Spec last-changed: 2026-09-28 · Update this table when architectural guidance changes significantly._

### WCF

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| Azure | replace | Azure Service Bus | Async one-way, pub-sub, duplex | Standard for <1K msg/s; Premium for private endpoints, VNET, geo-redundancy | learn.microsoft.com/azure/service-bus-messaging |
| Azure | replace | gRPC (ASP.NET Core) | Synchronous request-reply contracts | No tier — hosted in ASP.NET Core | learn.microsoft.com/aspnet/core/grpc |
| Azure | replace | Azure Functions (Service Bus trigger) | Event-driven background processing replacing WCF one-way | Consumption or Premium plan | learn.microsoft.com/azure/azure-functions |
| Azure | facade | WCF + Azure Service Bus (Strangler Fig) | External callers retained on WCF; internal async via Service Bus | Standard sufficient for most facade patterns; Premium if VNET isolation needed | learn.microsoft.com/azure/architecture/patterns/strangler-fig |
| AWS | replace | Amazon SQS | Async one-way, decoupled messaging | Standard for at-least-once; FIFO for ordering guarantees | docs.aws.amazon.com/sqs |
| AWS | replace | gRPC (via ALB or API Gateway) | Synchronous request-reply | No managed tier — deploy to ECS/EKS | docs.aws.amazon.com/apigateway |
| GCP | replace | Pub/Sub | Async one-way, pub-sub | No tier — serverless, per-message pricing | cloud.google.com/pubsub/docs |
| GCP | replace | gRPC (via Cloud Endpoints) | Synchronous request-reply | No tier — deploy to Cloud Run or GKE | cloud.google.com/endpoints/docs |
| stack-agnostic | replace | gRPC | Any synchronous WCF request-reply | No managed tier required | grpc.io |

### MSMQ

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| Azure | replace | Azure Service Bus | Drop-in MSMQ replacement — durable queuing, at-least-once | Standard for basic queuing; Premium for sessions and large messages | learn.microsoft.com/azure/service-bus-messaging/service-bus-queues-topics-subscriptions |
| AWS | replace | Amazon SQS | Durable message queuing | Standard or FIFO | docs.aws.amazon.com/sqs |
| GCP | replace | Pub/Sub | Durable message queuing | Serverless | cloud.google.com/pubsub |
| stack-agnostic | replace | RabbitMQ | Self-hosted durable queuing | No cloud tier — self-managed | rabbitmq.com |

### Windows Auth / NTLM / Kerberos

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| Azure | replace | Microsoft Entra ID (formerly Azure AD) | Modern identity provider replacing Windows Auth | P1 for MFA/Conditional Access; P2 for Identity Protection/PIM | learn.microsoft.com/entra/identity |
| Azure | facade | Entra ID + Windows Auth facade | External AD clients retained; internal services use Entra ID tokens | Entra ID P1 minimum; managed identity for service-to-service | learn.microsoft.com/azure/architecture/patterns/anti-corruption-layer |
| AWS | replace | Amazon Cognito | User identity and OAuth2/OIDC | No tier — per-MAU pricing | docs.aws.amazon.com/cognito |
| AWS | replace | AWS IAM Identity Center | Enterprise SSO, workforce identity | Included with AWS Organizations | docs.aws.amazon.com/singlesignon |
| GCP | replace | Google Cloud Identity | Workforce identity, SSO | No tier — per-user pricing | cloud.google.com/identity |
| stack-agnostic | replace | OpenID Connect (any provider) | Protocol-level replacement for Windows Auth | Depends on chosen IdP | openid.net/connect |

### Java EE / Jakarta EE (EJB, @Stateful, @Stateless, @MessageDriven)

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| Azure | replace | Azure Container Apps (Spring Boot) | Stateless EJB → Spring @Service beans | Consumption or Dedicated | learn.microsoft.com/azure/container-apps |
| AWS | replace | ECS/EKS (Spring Boot) | Stateless EJB → Spring @Service beans | Fargate or EC2 launch type | docs.aws.amazon.com/ecs |
| GCP | replace | Cloud Run (Spring Boot) | Stateless EJB → Spring @Service beans | Serverless — per-request pricing | cloud.google.com/run |
| stack-agnostic | replace | Spring Boot @Service / @Component | Direct EJB → Spring equivalent | No cloud tier — run anywhere | spring.io/projects/spring-boot |
| Any | replace (async) | Cloud-native messaging (see MSMQ table) | @MessageDriven EJB → event-driven consumer | Per messaging platform | — |

### ASP.NET HttpContext.Current (static access)

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| stack-agnostic | replace | IHttpContextAccessor (.NET 8) | Thread-safe HTTP context access; DI-injected | No tier — .NET runtime built-in | learn.microsoft.com/aspnet/core/fundamentals/http-context |

### ASP.NET Web Forms (CodeBehind, Page_Load)

| Target platform | Resolution | Component | Use case | Tier guidance | Canonical URL |
|---|---|---|---|---|---|
| Azure | replace | Blazor Server or Razor Pages (.NET 8) | Server-rendered UI replacing Web Forms | Azure App Service — Standard/Premium | learn.microsoft.com/aspnet/core/blazor |
| stack-agnostic | replace | Razor Pages (.NET 8) | Page-centric server rendering closest to Web Forms model | No tier — .NET runtime built-in | learn.microsoft.com/aspnet/core/razor-pages |
