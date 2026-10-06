---
name: migration-research-agent
description: >
  Grounds migration options analysis in cited external facts. Accepts rewrite/upgrade mode
  (source/target stack layers) or replatform mode (source environment + cloud components).
  Returns a structured JSON bundle per layer/component with EoL status, CVE exposure,
  ecosystem health, pricing, SLA, compliance — each with source URL, retrieved date,
  and confidence level. Uses WebFetch (external facts) and Read (lookup-urls.json config);
  no MCP, no IAM, no project codebase access.
  Invoked as a subagent from migration skills (rewrite, upgrade, replatform).
---

# migration-research-agent

_Skill version: 1.1 · Last changed: 2026-10-01 · Plugin compatibility: >=3.25.0 · Consent: C_

## Purpose

This agent grounds the migration options analysis in cited external facts so that developers
make informed, defensible migration choices. Given a set of source and target stack layers
(rewrite/upgrade mode) or cloud target components (replatform mode), it returns a structured
bundle of externally verified facts — EoL dates, CVE exposure levels, ecosystem health signals,
pricing ranges, SLA percentages, and compliance certifications — each with a source URL, a
retrieved date, and an explicit confidence level.

This agent does NOT access project source files, internal configuration, or any org-specific
identifiers. It does NOT use MCP connections, cloud accounts, or IAM credentials. It does NOT
calculate project-specific TCO — internal cost data is always a [project-specific] placeholder.
All research is via WebFetch on publicly accessible canonical URLs only.

## Invocation Model

This agent is invoked as a subagent by calling migration skills (rewrite, upgrade, replatform)
via a single Agent tool call:

```
Calling skill:
  Agent tool call with task = <JSON input per the input schema below>
  Receives back:              <JSON bundle per the output schema below>
```

The calling skill makes exactly ONE Agent tool call to this agent. This agent does not spawn
further subagents or chain additional Agent tool calls. If a fact cannot be determined within
this invocation, the agent returns a confidence=UNKNOWN entry with a canonical URL hint and
stops — it does not escalate or retry via a new invocation.

## Input Schema — rewrite/upgrade mode

> DECISION: Discriminated union on `migration_type`
> Options considered:
>   A) Separate URL endpoints per migration family — rejected: agent is a Markdown skill, not
>      an HTTP service; there is no routing layer to split on.
>   B) Discriminated union on `migration_type` — chosen: single entry point, each mode's fields
>      are structurally distinct and self-documenting; calling skills select the branch explicitly
>      before invoking. Keeps the SKILL.md extensible (replatform mode added as Story 2 branch).

This section covers `migration_type: "rewrite"` and `migration_type: "upgrade"`.
The `migration_type: "replatform"` branch is defined in Story 2 (added to this file later).

```json
{
  "migration_type": "rewrite | upgrade",
  "plugin_dir": "<absolute path to the plugin root — passed by the calling skill from $PLUGIN_DIR>",
  "source_layers": [
    {
      "stack": "<technology name — e.g. angular, dotnet, react, java, python, nodejs>",
      "version": "<version string — e.g. 15, 6, 18>",
      "cloud_hosted": "azure | aws | gcp | null"
    }
  ],
  "target_layers": [
    {
      "stack": "<technology name>",
      "version": "<version string>"
    }
  ]
}
```

`stack` must be a generic, publicly recognisable technology name. Never include internal project
names, class names, namespace prefixes, or org-specific identifiers.

`cloud_hosted` signals that the source layer runs in a managed cloud environment. When set,
the agent also returns a `cloud_runtime_support` field for that provider. Set to `null` for
on-premises or unknown hosting.

**Validation — return immediately without processing if:**
- `migration_type` is not "rewrite" or "upgrade":
  ```json
  { "error": "Invalid migration_type for rewrite/upgrade mode. For replatform, use migration_type: 'replatform'." }
  ```
- `source_layers` or `target_layers` is empty:
  ```json
  { "error": "source_layers and target_layers must each contain at least one entry." }
  ```

**Example — rewrite (Angular 15 + .NET 6 to React 18 + .NET 10):**
```json
{
  "migration_type": "rewrite",
  "plugin_dir": "/home/user/.claude/plugins/ai-assisted-development",
  "source_layers": [
    { "stack": "angular", "version": "15", "cloud_hosted": null },
    { "stack": "dotnet", "version": "6", "cloud_hosted": null }
  ],
  "target_layers": [
    { "stack": "react", "version": "18" },
    { "stack": "dotnet", "version": "10" }
  ]
}
```

## Per-Stack Lookup Strategy — rewrite/upgrade mode

**URL tables are stored in `$PLUGIN_DIR/skills/shared/migration-knowledge/lookup-urls.json`.**
Read that file at Step 1 (before processing layers) and use its `rewrite_upgrade.stacks[]` and
`rewrite_upgrade.cloud_hosted` entries as the lookup table for this mode. Never hardcode URLs here —
edit `lookup-urls.json` to add or update a URL. The `knowledge-freshness` skill validates and
refreshes stale entries.

Lookup structure in `lookup-urls.json`:
- `rewrite_upgrade.stacks[]` — keyed by `stack` token; each has `facts[]` with `type`, `primary`, `fallback`, `confidence`
- `rewrite_upgrade.cloud_hosted` — keyed by provider (`azure` | `aws` | `gcp`)
- `rewrite_upgrade.hiring_trend.canonical_url` — UNKNOWN fallback canonical URL
- `rewrite_upgrade.fallback_universal` — applied when stack has no matching row

## Output Schema — per-layer bundle (rewrite/upgrade mode)

Return a JSON array. One entry per layer, covering all layers in `source_layers[]` and
`target_layers[]` in order:

```json
[
  {
    "layer": "<stack@version — e.g. angular@15>",
    "role": "source | target",
    "eol_status": {
      "status": "EoL | active | UNKNOWN",
      "date": "<YYYY-MM-DD or null>",
      "source_url": "<URL — non-null when confidence is high or medium>",
      "retrieved_date": "<YYYY-MM-DD — always today>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "cve_exposure": {
      "level": "high | medium | low | UNKNOWN",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "ecosystem_health": {
      "signal": "<descriptive string — e.g. 'Weekly downloads ~3.5M, stable trend (Oct 2026)'>",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "hiring_trend": {
      "signal": "<descriptive string or UNKNOWN>",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "tooling_availability": {
      "signal": "<descriptive string or UNKNOWN>",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    }
  }
]
```

**Field rules:**
- `source_url` MUST be non-null for any fact with `confidence=high` or `confidence=medium`.
  It must be the exact URL fetched — not a homepage approximation.
- `retrieved_date` MUST always be set to today's ISO date (YYYY-MM-DD) on every field,
  including UNKNOWN fields.
- When a fact is UNKNOWN, use this shape — note `canonical_url` replaces `source_url`:
  ```json
  {
    "status": "UNKNOWN",
    "source_url": null,
    "canonical_url": "<best available vendor URL for this fact type>",
    "retrieved_date": "<YYYY-MM-DD>",
    "confidence": "UNKNOWN"
  }
  ```
  `canonical_url` signals "check here manually" without implying the data was fetched.
  This distinction is what allows calling skills to render UNKNOWN facts honestly.
- Never omit a field. If a fact cannot be determined, use the UNKNOWN shape — do not drop
  the field from the entry.
- `cve_exposure.level` is qualitative only: "high" / "medium" / "low" / "UNKNOWN".
  Real-time CVE counts from NVD API are excluded (rate-limit risk — ICEA Out of Scope).

## Execution Steps — rewrite/upgrade mode

> DECISION: Sequential per-layer processing (not parallel sub-invocations)
> Options considered:
>   A) Parallel sub-invocations via nested Agent tool calls — rejected: violates the
>      single-invocation constraint (AC-NF3); chaining subagents multiplies token cost
>      and makes the invocation boundary unpredictable.
>   B) Sequential WebFetch calls within one invocation — chosen: simpler, verifiable,
>      respects the single-invocation bound, and is sufficient given that WebFetch is
>      fast relative to LLM thinking time.

**Step 1 — Load URL config, then validate input**

Read `$PLUGIN_DIR/skills/shared/migration-knowledge/lookup-urls.json` using the Read tool.
This is the single source of truth for all WebFetch URLs used in Steps 2b–2g. If the file
cannot be read, return `{ "error": "lookup-urls.json not found — run /setup-sync to restore." }` and stop.

Then parse the input JSON. Apply the validation rules in the Input Schema section.
Return the appropriate error JSON and stop if validation fails.

**Step 2 — Process each layer sequentially**

For each layer in `source_layers[]` (role="source"), then each in `target_layers[]`
(role="target"), in the order given:

> **Citation-capture rule (applies to every substep below):**
> Bind `source_url` for each field **at the WebFetch call site** — the moment the URL is
> fetched, assign it to a local variable and carry it directly into the output field.
> Never defer `source_url` assignment to Step 3. If the primary URL fails and a fallback
> URL is used, rebind `source_url` to the fallback URL actually fetched. If both fail,
> set `source_url=null` and populate `canonical_url` with the primary URL pattern.

  a. Extract `stack` (lowercase) and `version`. Find matching rows in `lookup-urls.json` (`rewrite_upgrade.stacks[]`).

  b. **EoL / lifecycle:**
     - Construct the WebFetch URL from the primary URL pattern. Use only `{stack}` and
       `{version}` as substitution values — no internal identifiers.
     - WebFetch the URL. **Immediately bind** `eol_source_url = <URL just fetched>`.
     - Locate the version in the page content (table, list, or prose).
     - If the page clearly shows this version is past end-of-life: `status="EoL"`,
       extract the stated date.
     - If the page clearly shows this version is actively supported: `status="active"`,
       `date=null`.
     - If primary URL returns no authoritative result for this version: WebFetch the fallback
       URL and rebind `eol_source_url = <fallback URL fetched>`.
     - If both fail: `eol_source_url = null`; use the UNKNOWN shape with `canonical_url` set
       to the primary URL pattern.

  c. **CVE exposure:**
     - Find the `cve_exposure` fact entry for this stack in `lookup-urls.json` (`rewrite_upgrade.stacks[]`).
       If absent, use `rewrite_upgrade.cve_fallback_universal` — substitute `{stack}` with the stack name
       and `{ecosystem}` using: `dotnet`→`nuget` · `java`→`maven` · `spring-boot`→`maven` · `python`→`pip` ·
       `nodejs`/`angular`/`react`→`npm` · unknown stack → omit the ecosystem filter.
     - WebFetch the resolved URL. **Immediately bind** `cve_source_url = <URL just fetched>`.
     - Search for advisories referencing the specific version. Return a qualitative level based
       on volume and severity: "high" (actively exploited or many unpatched), "medium" (some
       CVEs, patches available), "low" (minimal known exposure). Do not return a raw count.
     - If no CVE page found or no version-specific data: `cve_source_url = null`,
       `confidence="UNKNOWN"`.

  d. **Ecosystem health:**
     - Find the `ecosystem_health` fact entry for this stack in `lookup-urls.json`. WebFetch
       the primary URL (npm page, NuGet page, GitHub releases, or PyPI as applicable).
       **Immediately bind** `ecosystem_source_url = <URL just fetched>`.
     - Return a descriptive `signal` string including the metric and the date of retrieval,
       e.g. "Weekly downloads: ~3.5M, stable (npm, 2026-09-26)".
     - If no data found: `ecosystem_source_url = null`, `signal="UNKNOWN"`,
       `confidence="UNKNOWN"`.

  e. **Hiring trend:**
     - This fact is difficult to ground authoritatively in a single WebFetch. Attempt a
       best-effort fetch from a public developer survey (e.g. Stack Overflow Developer
       Survey results page) or a public job aggregator. **Immediately bind**
       `hiring_source_url = <URL just fetched>` if the fetch succeeds.
     - Return a descriptive signal if found.
     - If no authoritative data found within this invocation: `hiring_source_url = null`;
       use the UNKNOWN shape with `canonical_url` set to `rewrite_upgrade.hiring_trend.canonical_url`
       from the loaded `lookup-urls.json`. Never fabricate a trend figure.

  f. **Tooling availability:**
     - Find the `tooling_availability` fact entry for this stack in `lookup-urls.json`.
       WebFetch the URL (official docs page or IDE marketplace). **Immediately bind**
       `tooling_source_url = <URL just fetched>`.
     - Return a descriptive signal, e.g. "First-class support in VS Code, JetBrains. Official
       CLI maintained. No deprecation signals found."
     - If no data found: `tooling_source_url = null`, `confidence="UNKNOWN"`.

  g. **Cloud-hosted runtime support (when `cloud_hosted` is non-null):**
     - Look up the cloud-hosted entry in `lookup-urls.json` (`rewrite_upgrade.cloud_hosted[provider]`).
     - Construct and WebFetch the provider-specific runtime support URL. **Immediately bind**
       `cloud_source_url = <URL just fetched>`.
     - Return a `cloud_runtime_support` field on this layer entry using the same
       confidence-annotated schema as the other fields.
     - AWS runtime support: try the service-specific docs page first, then the What's New
       RSS with an exact-phrase filter for "{stack} {version} end of support". Rebind
       `cloud_source_url` to whichever URL actually returned data.
       Set `confidence="medium-high"` for AWS lifecycle facts regardless of source.
     - GCP runtime support: use the `/docs/deprecations` structured table (Feature /
       Deprecated date / Shutdown date). Set `confidence="high"` for table data;
       `confidence="medium-high"` for RSS fallback. Rebind `cloud_source_url` accordingly.

**Step 3 — Completeness check (not citation assignment)**

> `source_url` for every field was already bound at its WebFetch call in Step 2.
> Step 3 is a schema completeness check only — do NOT reassign `source_url` here.

Verify each entry in the constructed JSON array:
- Every entry has all required fields (eol_status, cve_exposure, ecosystem_health,
  hiring_trend, tooling_availability).
- Every `retrieved_date` field is set to today's YYYY-MM-DD date.
- Every confidence=high or confidence=medium fact has a non-null `source_url` (bound in Step 2).
- Every UNKNOWN fact has `source_url=null` and a non-null `canonical_url`.

**Step 4 — Return**

Return the completed JSON bundle as the single response. Do not make any further Agent
tool calls. Do not spawn additional subagents. All UNKNOWN entries are already annotated
with canonical URLs — the calling skill renders them using the confidence rendering rules
defined in `skills/shared/migration-research-spec.md` (Story 3).

## UNKNOWN Fallback Behaviour

When a WebFetch returns no authoritative result for a specific fact:

1. Set `confidence="UNKNOWN"` for that specific field only. Other fields on the same
   layer entry may still have high/medium confidence if their own WebFetch succeeded.
2. Set `source_url=null`.
3. Populate `canonical_url` with the best available vendor documentation URL for that
   fact type — so the developer knows exactly where to check manually.
4. Set `retrieved_date` to today's date.
5. Never invent, estimate, or extrapolate a fact value. An invented fact is worse than
   an honest UNKNOWN — it leads to wrong migration decisions at a point of no return.
6. Do not retry by invoking another subagent. The UNKNOWN entry is the correct terminal
   state for an unresolvable fact within this invocation. The calling skill surfaces it
   to the developer as a warning with the canonical URL.

## Constraints and Invariants

**Citation at fetch site.** `source_url` for every output field MUST be bound at the WebFetch
call site in Step 2 — the moment the URL is fetched, not during Step 3 assembly. Step 3 is a
completeness check only. Deferring `source_url` assignment to assembly risks URL drift (where
the URL recorded no longer matches the page that produced the fact). If a fallback URL is used,
rebind `source_url` to the fallback URL actually fetched. If both URLs fail, set
`source_url=null` and populate `canonical_url`.

**No codebase access.** This agent has no access to project source files, build outputs,
configuration files, internal environment variables, or org-specific identifiers. Any
question that requires internal project data returns a `[project-specific]` placeholder,
not an attempted guess.

**Sanitized queries.** All WebFetch URLs are constructed from publicly recognisable
technology terms only — the stack name (e.g. "angular", "dotnet"), the version string,
and the cloud provider name. No internal class names, file paths, variable names, team
names, project names, or org-specific terms appear in any URL or search query. This
constraint is verifiable by inspection of the URL construction steps in the Execution
Steps section above.

**Single invocation.** This agent completes all research within the single subagent
invocation initiated by the calling skill. It does not call the Agent tool, does not spawn
further subagents, and does not chain additional tool calls to compensate for failed lookups.
A failed lookup resolves to UNKNOWN — not to a retry via a new invocation.

**All three migration modes supported.** This SKILL.md defines all three discriminated union
branches: `migration_type: "rewrite"` and `"upgrade"` (rewrite/upgrade mode sections above),
and `migration_type: "replatform"` (replatform mode sections below). Any input with an
unrecognised `migration_type` returns the validation error defined in each mode's Input Schema.

**No MCP dependencies.** This agent does not use the BigQuery MCP, any cloud-provider
MCP, or any tool that requires authentication, a billing-enabled cloud account, or IAM
permissions. WebFetch on public canonical URLs is the only data access mechanism.

---

## Input Schema — replatform mode (discriminated union branch 2)

This section covers `migration_type: "replatform"`. For rewrite/upgrade mode, see the sections
above.

```json
{
  "migration_type": "replatform",
  "plugin_dir": "<absolute path to the plugin root — passed by the calling skill from $PLUGIN_DIR>",
  "source_environment": {
    "type": "on-prem | cloud",
    "runtime": "<description — e.g. 'IIS/.NET 4.8', 'EC2/Node.js 18'>",
    "cloud_provider": "azure | aws | gcp | null"
  },
  "target_environment": {
    "cloud": "azure | aws | gcp",
    "components": [
      {
        "name": "<component name — e.g. 'Azure App Service Standard S2', 'Cloud Run'>",
        "type": "compute | database | storage | messaging | other"
      }
    ],
    "region": "<e.g. 'East US', 'us-east-1', 'us-central1'>"
  }
}
```

**Validation — return immediately without processing if:**
- `target_environment.cloud` is not "azure", "aws", or "gcp":
  ```json
  { "error": "target_environment.cloud must be 'azure', 'aws', or 'gcp'." }
  ```
- `target_environment.components` is empty:
  ```json
  { "error": "target_environment.components must contain at least one entry." }
  ```

**Example — IIS on-prem to Azure App Service Standard S2 + Azure SQL MI:**
```json
{
  "migration_type": "replatform",
  "plugin_dir": "/home/user/.claude/plugins/ai-assisted-development",
  "source_environment": { "type": "on-prem", "runtime": "IIS/.NET 4.8", "cloud_provider": null },
  "target_environment": {
    "cloud": "azure",
    "components": [
      { "name": "Azure App Service Standard S2", "type": "compute" },
      { "name": "Azure SQL Managed Instance General Purpose 4 vCores", "type": "database" }
    ],
    "region": "East US"
  }
}
```

## Per-Provider Lookup Strategy — replatform mode

**URL tables are stored in `$PLUGIN_DIR/skills/shared/migration-knowledge/lookup-urls.json`.**
Use the file already read in Step 1. Use its `replatform.providers` object, keyed by provider
(`azure` | `aws` | `gcp`), each containing `facts[]` with `type`, `primary`, `fallback`,
`confidence`. Use `replatform.slug_map[cloud]` to derive the `{service}` URL slug from the
component display name (lowercase match on display-name keys; fallback: lowercase + replace
spaces with hyphens + strip provider prefix — e.g. "Azure App Service Standard S2" → "app-service").
Never hardcode URLs here — edit `lookup-urls.json` to add or update a URL.

For each component in `target_environment.components[]`, find the matching provider entry in
`replatform.providers[target_environment.cloud]`, derive the slug from `replatform.slug_map`,
and construct WebFetch URLs using only the component name and cloud provider name — no internal
project identifiers.

## Output Schema — per-component bundle (replatform mode)

Return a JSON array. One entry per component in `target_environment.components[]` in order:

```json
[
  {
    "component": "<component name as given in input>",
    "cloud": "azure | aws | gcp",
    "pricing_range": {
      "value": "<e.g. '~$150-$200/month (Standard S2, East US)'>",
      "source_url": "<URL — non-null when confidence is high or medium>",
      "retrieved_date": "<YYYY-MM-DD — always today>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "sla_percentage": {
      "value": "<e.g. '99.95%'>",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "ga_status": {
      "status": "GA | Preview | Deprecated | UNKNOWN",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "compliance_certifications": {
      "certs": ["SOC2", "HIPAA", "FedRAMP"],
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    },
    "egress_cost_signal": {
      "signal": "<e.g. '$0.087/GB outbound after first 100 GB/month (East US)'>",
      "source_url": "<URL or null>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high | medium | low | UNKNOWN"
    }
  }
]
```

**Field rules (identical to rewrite/upgrade mode):**
- `source_url` must be non-null for `confidence=high` or `confidence=medium` facts.
- `retrieved_date` must be today's ISO date on every field, including UNKNOWN fields.
- UNKNOWN fields use the UNKNOWN shape: `source_url=null`, non-null `canonical_url`, today's `retrieved_date`.
- `compliance_certifications.certs` may be an empty array `[]` if the component is not listed
  in the compliance page; set `confidence=low` in that case (page found, component absent).
- Never omit a field. Never invent a value.

## Execution Steps — replatform mode

**Step 1 — Load URL config, then validate input**

Read `$PLUGIN_DIR/skills/shared/migration-knowledge/lookup-urls.json` using the Read tool.
Each migration mode reads it independently — there is no shared state between the rewrite/upgrade
and replatform branches within a single invocation. If the file cannot be read, return
`{ "error": "lookup-urls.json not found — run /setup-sync to restore." }` and stop.

Parse the input JSON. Confirm `migration_type` is "replatform". Apply the replatform validation
rules above. Return the appropriate error JSON and stop if validation fails.

**Step 2 — Process each component sequentially**

For each component in `target_environment.components[]` in order:

> **Citation-capture rule (applies to every substep below):**
> Bind `source_url` for each field **at the WebFetch call site** — the moment the URL is
> fetched, assign it to a local variable and carry it directly into the output field.
> Never defer `source_url` assignment to Step 3. If the primary URL fails and a fallback
> URL is used, rebind `source_url` to the fallback URL actually fetched. If both fail,
> set `source_url=null` and populate `canonical_url` with the primary URL pattern.

  a. Extract the component `name` and `type`. Determine the provider from
     `target_environment.cloud`. Find the matching rows in `lookup-urls.json`
     (`replatform.providers[cloud]`). Derive the `{service}` URL slug from the component name
     using `replatform.slug_map[cloud]` — lowercase the component name and find the longest
     matching key. If not in the map, apply the fallback rule: lowercase + replace spaces with
     hyphens + strip the cloud provider prefix (e.g. "Azure App Service Standard S2" → "app-service").

  b. **Pricing range:**
     - Construct the WebFetch URL using the provider's pricing URL pattern. Substitute the
       component name or its equivalent service slug (e.g. "app-service" for Azure App Service).
       Use only the component name — no internal project identifiers.
     - WebFetch the pricing page. **Immediately bind** `pricing_source_url = <URL just fetched>`.
     - Extract the monthly cost range for the stated tier and region.
     - Return a descriptive `value` string: `"~$X-$Y/month ({tier}, {region})"`.
     - If no pricing data found: `pricing_source_url = null`; UNKNOWN shape with `canonical_url`
       = the pricing page URL.

  c. **SLA percentage:**
     - WebFetch the SLA page for this component and provider. **Immediately bind**
       `sla_source_url = <URL just fetched>`.
     - Extract the stated SLA percentage (e.g. "99.95%").
     - If no SLA page or no percentage found: `sla_source_url = null`; UNKNOWN shape.

  d. **GA status:**
     - **Azure:** WebFetch learn.microsoft.com/lifecycle/ for the component. **Immediately bind**
       `ga_source_url = <URL just fetched>`. Check retirement/preview status.
       Return "GA", "Preview", or "Deprecated".
     - **GCP:** WebFetch cloud.google.com/{product}/docs/deprecations. **Immediately bind**
       `ga_source_url = <URL just fetched>`. Find the component in the Feature / Deprecated date /
       Shutdown date table. Present with shutdown date → "Deprecated". Present with only deprecated
       date → check if actively GA'd separately. Not in table → "GA" (verify with main product
       page). Fallback: GCP blog RSS; rebind `ga_source_url` to the RSS URL if used.
     - **AWS:** WebFetch the service-specific docs page. **Immediately bind**
       `ga_source_url = <URL just fetched>`. Fallback: What's New RSS with exact-phrase filter for
       "{component} end of support"; rebind `ga_source_url` to the RSS URL if used.
       AWS lifecycle: always confidence=medium-high regardless of source.
     - Return `status="GA" | "Preview" | "Deprecated" | "UNKNOWN"`.

  e. **Compliance certifications:**
     - WebFetch the compliance page for the provider. **Immediately bind**
       `compliance_source_url = <URL just fetched>`.
     - Find the component in the services-in-scope list. Extract certification names
       (SOC2, HIPAA, FedRAMP, ISO 27001, PCI-DSS, etc.).
     - Return `certs` as an array of certification names found on the page.
     - If the compliance page exists but the component is not listed: `certs=[]`, `confidence=low`.
     - If the compliance page cannot be fetched: `compliance_source_url = null`; UNKNOWN shape.

  f. **Egress cost signal:**
     - WebFetch the pricing page (same URL as step b). Reuse `pricing_source_url` — no separate
       bind needed; this field shares the same source as `pricing_range`.
     - Find the "outbound data transfer", "egress", or "data transfer" pricing section.
     - Return a descriptive `signal` string including the per-GB rate and any included free tier.
     - Egress costs are frequently embedded in pricing pages — look for bandwidth/transfer sections.
     - If no egress data found on the pricing page: UNKNOWN shape.

**Step 3 — Completeness check (not citation assignment)**

> `source_url` for every field was already bound at its WebFetch call in Step 2.
> Step 3 is a schema completeness check only — do NOT reassign `source_url` here.

Verify each entry in the constructed JSON array:
- All five fields (pricing_range, sla_percentage, ga_status, compliance_certifications,
  egress_cost_signal) are present on every entry.
- All `retrieved_date` fields are today's date.
- All `confidence=high` or `confidence=medium` facts have non-null `source_url` (bound in Step 2).
- All UNKNOWN facts have `source_url=null` and non-null `canonical_url`.

**Step 4 — Return**

Return the completed per-component bundle as the single response. Do not make any further Agent
tool calls. Do not spawn additional subagents. UNKNOWN entries are already annotated — the calling
skill renders them using the confidence rendering rules in `skills/shared/migration-research-spec.md`.
