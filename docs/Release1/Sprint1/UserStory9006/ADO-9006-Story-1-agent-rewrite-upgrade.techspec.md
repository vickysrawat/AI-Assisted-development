# Tech Spec — Story 1: migration-research-agent (rewrite/upgrade mode)
ADO #9006 · Story 1 of 5 · Release 1 · Sprint 1
Status: DRAFT

---

## Overview

Story 1 creates the `skills/migration-research-agent/` directory and writes the foundational SKILL.md for the rewrite/upgrade discrimination mode. The agent accepts a typed JSON input identifying source and target stack layers (with optional cloud hosting context), runs WebFetch on per-stack canonical lifecycle URLs, and returns a structured JSON bundle containing EoL status, CVE exposure level, ecosystem health signal, hiring trend, and tooling availability for each layer — each with a source URL, retrieved date, and confidence level. Three cloud providers are supported: Azure (learn.microsoft.com/lifecycle/), AWS (docs.aws.amazon.com + RSS), and GCP (cloud.google.com deprecations table + RSS fallback). The agent operates in a single subagent invocation with no codebase access and no MCP dependencies.

This story does NOT include the replatform mode (Story 2) or the calling skill modifications (Stories 4-5). The agent can be reviewed and tested independently after this story ships.

---

## AC Coverage Matrix

### AC -> File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | Agent accepts rewrite/upgrade input; returns per-layer bundle with EoL, CVE, ecosystem, hiring, tooling; 3 cloud providers; WebFetch-only; per-stack lookup strategy | skills/migration-research-agent/SKILL.md | Covered |
| AC-NF1 | Every stated fact (confidence=high or medium) includes source URL and retrieved date | skills/migration-research-agent/SKILL.md | Covered |
| AC-NF2 | WebSearch queries contain only public technology terms — no internal identifiers | skills/migration-research-agent/SKILL.md | Covered |
| AC-NF3 | Agent returns within one subagent invocation; UNKNOWN fallback instead of escalating | skills/migration-research-agent/SKILL.md | Covered |

### File -> AC mapping

| File | ACs satisfied |
|---|---|
| skills/migration-research-agent/SKILL.md | AC-F1, AC-NF1, AC-NF2, AC-NF3 |

**Coverage result:** All 4 ACs covered by SKILL.md. No orphaned file changes.

---

## Files Changed

| File | Change | AC(s) | Notes |
|---|---|---|---|
| `skills/migration-research-agent/SKILL.md` | NEW | AC-F1, AC-NF1, AC-NF2, AC-NF3 | New skill directory + foundational agent SKILL.md — rewrite/upgrade mode only |

### skills/migration-research-agent/SKILL.md — structure

The SKILL.md must contain the following sections in order:

**1. Frontmatter**
```yaml
---
name: migration-research-agent
description: >
  Grounds migration options analysis in cited external facts. Accepts rewrite/upgrade mode
  (source/target stack layers) or replatform mode (source environment + cloud components).
  Returns a structured JSON bundle per layer/component with EoL status, CVE exposure,
  ecosystem health, pricing, SLA, compliance — each with source URL, retrieved date,
  and confidence level. WebFetch-only; no MCP, no IAM, no codebase access.
  Invoked as a subagent from migration skills (rewrite, upgrade, replatform).
---
```

**2. Purpose** — one paragraph: what the agent does, why it exists, what it does NOT do (no codebase access, no MCP, no project-specific TCO).

**3. Invocation Model** — describe how calling skills invoke the agent via the Agent tool as a single subagent call. Include that chained multi-hop subagent calls are not permitted.

**4. Input Schema — rewrite/upgrade mode (discriminated union branch 1)**

```json
{
  "migration_type": "rewrite" | "upgrade",
  "source_layers": [
    { "stack": "<technology name>", "version": "<version>", "cloud_hosted": "azure" | "aws" | "gcp" | null }
  ],
  "target_layers": [
    { "stack": "<technology name>", "version": "<version>" }
  ]
}
```

Example input (rewrite — Angular 15 + .NET 6 to React 18 + .NET 10):
```json
{
  "migration_type": "rewrite",
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

**5. Per-stack lookup strategy table (rewrite/upgrade mode)**

| Stack | Fact type | Primary URL pattern | Fallback | Confidence |
|---|---|---|---|---|
| dotnet (any version) | EoL/lifecycle | learn.microsoft.com/lifecycle/products/?terms=.NET | — | high |
| dotnet | CVE exposure | learn.microsoft.com/security/updates | — | high |
| angular (any version) | EoL/lifecycle | angular.dev/reference/releases | — | high |
| angular | ecosystem health | npmjs.com/package/@angular/core (weekly downloads) | — | high |
| react (any version) | EoL/lifecycle | react.dev/blog + github.com/facebook/react/releases | — | high |
| java (any version) | EoL/lifecycle | endoflife.date/java | — | high |
| python (any version) | EoL/lifecycle | devguide.python.org/versions/ | endoflife.date/python | high |
| nodejs (any version) | EoL/lifecycle | nodejs.org/en/about/releases | endoflife.date/nodejs | high |
| azure-hosted (cloud context) | runtime support | learn.microsoft.com/azure/app-service/configure-language-{stack} | — | high |
| aws-hosted (cloud context) | runtime support | docs.aws.amazon.com/{service}/latest/dg/{runtime-support-page} | AWS What's New RSS (exact-phrase filter for stack + "end of support") | medium-high |
| gcp-hosted (cloud context) | runtime support | cloud.google.com/{service}/docs/deprecations (Feature/Deprecated date/Shutdown date table) | GCP global RSS + keyword filter | medium-high |
| unknown/niche stack | any | endoflife.date/{stack} | — | UNKNOWN if not found |

**6. Output schema — per-layer bundle (rewrite/upgrade mode)**

Return a JSON array, one entry per source and target layer:
```json
[
  {
    "layer": "<stack@version>",
    "role": "source" | "target",
    "eol_status": {
      "status": "EoL" | "active" | "UNKNOWN",
      "date": "<YYYY-MM-DD or null>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "cve_exposure": {
      "level": "high" | "medium" | "low" | "UNKNOWN",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "ecosystem_health": {
      "signal": "<descriptive string>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "hiring_trend": {
      "signal": "<descriptive string>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    },
    "tooling_availability": {
      "signal": "<descriptive string>",
      "source_url": "<URL>",
      "retrieved_date": "<YYYY-MM-DD>",
      "confidence": "high" | "medium" | "low" | "UNKNOWN"
    }
  }
]
```

**7. Execution steps (rewrite/upgrade mode)**

Step 1: Parse and validate input. Confirm migration_type is "rewrite" or "upgrade". Extract source_layers[] and target_layers[].

Step 2: For each layer (source and target):
  a. Look up the per-stack lookup strategy table to determine primary URL and fallback
  b. Construct a sanitized WebFetch URL using only the stack name and version (no internal identifiers)
  c. WebFetch the primary URL and extract the relevant fact (EoL date, CVE count qualifier, download stats, etc.)
  d. If primary URL returns no authoritative data: try the fallback URL
  e. If fallback also fails: return { "status": "UNKNOWN", "source_url": null, "canonical_url": "<vendor URL>", "retrieved_date": "<today>" }

Step 3: Construct the output bundle (one entry per layer). Include source_url and retrieved_date for every fact. Set confidence level per the table above.

Step 4: Return the completed bundle. Do not re-invoke the agent or spawn additional subagents.

**8. UNKNOWN fallback behavior**

When WebFetch returns no authoritative result within this invocation:
- Set confidence to "UNKNOWN"
- Set source_url to null
- Populate canonical_url with the best available vendor documentation URL
- Never invent or estimate a fact; never state as established without citation

**9. Constraints and invariants**

- No codebase access: this agent has no access to project source files, configuration, or internal identifiers. Any fact requiring internal project data returns [project-specific] as a placeholder.
- Sanitized queries: all WebSearch/WebFetch queries use only publicly recognisable technology terms. No internal class names, file paths, variable names, or org-specific terms (AC-NF2).
- Single invocation: this agent completes all research within one subagent invocation. It does not spawn additional subagents or chained Agent tool calls (AC-NF3).
- Rewrite/upgrade only: this SKILL.md covers the rewrite and upgrade discrimination modes. The replatform mode is defined in Story 2 as an additional discriminated union branch.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| WebFetch returns no authoritative lifecycle data for a stack | confidence=UNKNOWN; canonical_url populated with vendor URL; no stated fact |
| WebFetch returns inconsistent results across primary and fallback URLs | confidence=low; calling skill renders as warning with canonical URL (AC-F3) |
| Stack not in the per-stack lookup strategy table | Default to endoflife.date/{stack} as canonical URL; return UNKNOWN if not found |
| migration_type is not "rewrite" or "upgrade" | Return error: "Invalid migration_type for this mode. For replatform, see replatform mode (Story 2)." |
| Source and target layers list is empty | Return error: "source_layers and target_layers must each contain at least one entry." |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| AC-F1 (SKILL.md core: input schema, lookup strategy, output schema, execution steps, 3 cloud providers) | Author complete agent SKILL.md for rewrite/upgrade mode | 2 |
| AC-NF1 + AC-NF2 + AC-NF3 (citation requirement, query sanitization, single-invocation bound) | Verify by design in SKILL.md structure + query examples | 1 |
| **Total** | | **3** |

**Total SP: 3**
**Type: STORY** — single story, single SKILL.md file, no child ADOs for this story.

---

## Definition of Done

**Implementation**
- [ ] `skills/migration-research-agent/SKILL.md` created with all 9 sections as specified in Files Changed
- [ ] Input schema for rewrite/upgrade mode is a correctly structured discriminated union (migration_type must be "rewrite" or "upgrade")
- [ ] Per-stack lookup strategy table covers: dotnet, angular, react, java, python, nodejs, azure-hosted, aws-hosted, gcp-hosted, unknown/niche
- [ ] Output bundle schema correctly typed: all confidence-annotated fields present; UNKNOWN fallback path documented
- [ ] Execution steps clearly define the WebFetch-first, fallback-second, UNKNOWN-third resolution order
- [ ] No internal identifiers in query examples — verifiable by inspection (AC-NF2)
- [ ] No MCP references anywhere in this SKILL.md

**Quality**
- [ ] Positive verification: given a well-known stack (e.g. Angular 15), agent returns EoL status with source URL and retrieved_date (confidence=high)
- [ ] Negative verification: given an obscure/unlisted stack, agent returns confidence=UNKNOWN with canonical_url hint, not a fabricated fact
- [ ] Single-invocation bound: SKILL.md execution steps contain no Agent tool call invocations (only WebFetch) — no chained subagents
- [ ] Regression: no impact on existing skill files — only new directory/file added

**Review readiness**
- [ ] PR title: [ADO-9006] Story 1 — migration-research-agent SKILL.md (rewrite/upgrade mode)
- [ ] PR description maps SKILL.md to AC-F1, AC-NF1, AC-NF2, AC-NF3
- [ ] ICEA and Story 1 tech spec committed in the feature branch

### Reviewer Checklist

- [ ] All three cloud providers (azure-hosted, aws-hosted, gcp-hosted) present in the per-stack lookup strategy table
- [ ] AWS lifecycle entry shows medium-high confidence (no central EoL portal — RSS + service docs) as documented in ICEA AC-F1 constraint
- [ ] GCP lifecycle entry references the /docs/deprecations structured table as the primary source
- [ ] Every output bundle field has source_url, retrieved_date, and confidence — no field returns a value without a citation
- [ ] UNKNOWN fallback uses canonical_url (not source_url) to signal "check here" without implying the data was fetched
- [ ] No `any` type constructs, no hardcoded values that embed internal project context
- [ ] Execution steps explicitly state: do not spawn additional subagents (AC-NF3)

---

## Open Questions

None.

---

## Request Flow

```
icea-feature invokes /rewrite or /upgrade (calling skill)
  |
  +--> Calling skill options phase (Story 4 — not yet in this story)
         Constructs rewrite/upgrade discriminated union input
         Calls Agent tool --> migration-research-agent/SKILL.md
           |
           +--> Input validation: migration_type must be "rewrite" or "upgrade"
           +--> For each layer in source_layers[] and target_layers[]:
                  Lookup strategy table --> primary URL
                  WebFetch primary URL
                  If no authoritative data: WebFetch fallback URL
                  If fallback fails: set confidence=UNKNOWN, canonical_url={vendor URL}
           +--> Assemble output bundle (one JSON object per layer)
           +--> Return bundle to calling skill (single response, no further Agent calls)
```

---

## Rollback

**Purely additive:** This story creates a new directory (`skills/migration-research-agent/`) and a new file (`SKILL.md`). No existing files are modified.

**Rollback procedure:**
1. Delete `skills/migration-research-agent/SKILL.md` and the directory
2. No other changes to revert — no calling skill modifications in this story
3. Verify: running `/rewrite` or `/upgrade` should function identically to pre-story behavior (agent invocation preamble not yet added in Story 4)

---

## Handover

### QA Team

**What was added:** New `skills/migration-research-agent/SKILL.md` with rewrite/upgrade mode input/output contract and per-stack lookup strategy.

**How to verify manually:**
1. In a Claude Code session, open a test project and run `/rewrite`
2. At the options phase, the agent should be invocable directly for verification:
   Supply the JSON input in the format specified in the Input Schema section
   Verify the returned bundle contains EoL status with source_url, retrieved_date, and confidence for each layer
3. Test with an obscure stack — verify UNKNOWN confidence with canonical_url hint
4. Inspect the SKILL.md for query examples — confirm no internal identifiers visible

**Regression risk:** Minimal — new file only. No existing skill files modified in this story.

### DevOps / Platform Team

No changes. New Markdown file only.

### Future Developer — Follow-on Work

To extend this story's agent with additional stacks: add rows to the per-stack lookup strategy table in this SKILL.md and the corresponding entry in `migration-research-spec.md` (Story 3). Match the table schema exactly (Stack, Fact type, Primary URL pattern, Fallback, Confidence).

---

## Test Cases

> This is a Markdown SKILL.md executed by Claude at runtime. Tests are scenario verifications — manual invocation of the agent with a defined input and observation of the output structure and content.

### Positive Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | Agent — EoL lookup (well-known stack) | rewrite input: angular@15 source layer | Returns eol_status with status="EoL", date present, source_url from angular.dev, retrieved_date=today, confidence=high | AC-F1 |
| P-U2 | Agent — EoL lookup (active target) | rewrite input: dotnet@10 target layer | Returns eol_status with status="active", source_url from learn.microsoft.com/lifecycle, confidence=high | AC-F1 |
| P-U3 | Agent — AWS-hosted cloud context | upgrade input: nodejs@18, cloud_hosted="aws" | Returns aws-hosted cloud context with medium-high confidence; source_url from docs.aws.amazon.com or AWS What's New RSS | AC-F1 |
| P-U4 | Agent — citation completeness | Any input with confidence=high result | Every field with confidence=high has non-null source_url and non-null retrieved_date | AC-NF1 |
| P-U5 | Agent — query sanitization | Any input | WebFetch calls visible in SKILL.md execution steps use only technology names and versions — no class names, file paths, or org-specific terms | AC-NF2 |

### Negative Verification Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | Agent — UNKNOWN fallback | Input with an obscure/unlisted stack name | Returns confidence=UNKNOWN; canonical_url populated with best available vendor URL; no fact stated without citation | AC-F1 (E6) |
| N-U2 | Agent — low-confidence path | Input where WebSearch returns inconsistent results | Returns confidence=low; calling skill renders as warning with canonical URL (not as stated fact) | AC-F1 (E3) |
| N-U3 | Agent — wrong migration_type | Input with migration_type="replatform" sent to rewrite/upgrade mode | Returns error message directing to replatform mode; no partial bundle returned | AC-F1 |
| N-U4 | Agent — single-invocation bound | Any input that cannot be resolved | Agent returns UNKNOWN with canonical_url hint; does NOT spawn a second Agent tool call to retry | AC-NF3 |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | End-to-end rewrite options with agent | (1) Run /rewrite on a test project with Angular 15 + .NET 6 to React 18 + .NET 10 (2) Observe options phase once Story 4 ships | Agent subagent invoked; bundle returned; at least one grounded fact per source/target layer with source URL and retrieved_date in options output | AC-F1, AC-NF1 |
| INT-2 | Single-invocation bound in context | (1) Inspect calling skill output during /rewrite or /upgrade run (2) Count Agent tool calls in session | Exactly one Agent tool call to migration-research-agent — no chained subagent invocations | AC-NF3 |

> NF AC verification:
> AC-NF1 (citation on every stated fact): verified by inspecting any agent output — all `confidence=high` or `confidence=medium` entries must have non-null source_url and retrieved_date.
> AC-NF2 (sanitized queries): verified by static inspection of SKILL.md execution steps and query examples — no internal identifiers present.
> AC-NF3 (single invocation): verified by inspecting SKILL.md execution steps — no Agent tool call appears within the agent's own execution steps; UNKNOWN fallback returns immediately.

---

### Revision Log

2026-09-26 — Story 1 tech spec drafted
