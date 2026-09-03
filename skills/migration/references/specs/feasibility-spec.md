# Spec: MIGRATION-FEASIBILITY.md

_Loaded by migration SKILL.md at Stage 2 start._
_Defines the required format for the feasibility assessment document._
_This document is generated AFTER the target architecture is approved (Stage 1 gate)._

---

## Document: MIGRATION-FEASIBILITY.md

**Filename:** `ADO-{ADO_ID}-migration-feasibility.md`
**Purpose:** Assesses what it takes to migrate from the source to the approved target architecture.
Identifies risks, effort, and blockers before any code is written.

**Generated from:** Source analysis + loaded stack/mapping reference files + approved architecture docs.

**Posture-aware (per cluster/project).** Breaking-change analysis MUST branch on each project's
generation (from the source `versions[].generation` spread + `mode.source_version`/`target_version`):
`dotnet-modern`→ **Upgrade** (cumulative net-core removals over `(source, target]` from
`dotnet-upgrade.md`); `dotnet-framework`→ **Re-platform** (parity mapping `dotnet-framework-to-dotnet.md`
— the removal-delta model does NOT apply). A mixed source runs both postures per-cluster. Flag a
≥3-major version delta (Upgrade posture) as a stage-the-upgrade YELLOW/RED. See stage-2 Step 2.0b.

### Honesty Rules (enforced)

- NEVER classify a component as GREEN without verification. UNKNOWN is honest; GREEN is a commitment.
- Every RED item MUST have at least one resolution option. If there is genuinely no path, mark BLOCKER.
- "Compiles" ≠ "behaves identically" — call out behavioral risk on every YELLOW and RED item.
- Dependency verification: run the appropriate outdated-package command. If unavailable, mark UNKNOWN.
- **Integration classification:** an external dependency whose Kind/Transport/Auth is not
  ground-truth-verified (§8 Integration Inventory row still `UNVERIFIED`, per
  `specs/integration-verification-spec.md`) is `UNKNOWN`/RED with a resolution option — never assessed
  on an assumed Kind. Misclassifying an in-process DB as a service (or NTLM as Kerberos) invalidates
  the whole effort estimate for that dependency.

### Behavioral Risk Scale

| Level | Meaning |
|---|---|
| INFORMATIONAL | Different but inconsequential |
| MEDIUM | Different under specific conditions — regression test required |
| HIGH | Different in common paths — explicit mitigation required |
| BLOCKER | Behaviour cannot be preserved under any feasible approach |

Worst-case rule: component rating = worst sub-item rating.

### Required Sections

**## 1. Executive Summary**
- Source → target (one line)
- Tooling BLOCKERs (if any tools are missing from Step 0.2 pre-check)
- Headline counts: N GREEN · N YELLOW · N RED · N BLOCKERS
- Overall verdict: STRAIGHTFORWARD / MODERATE / HIGH-RISK / has BLOCKERS

**## 2. Migrates Cleanly (GREEN)**

Use parity table from loaded mapping reference file (stack-specific GREEN table).

| Component | Source | Target equivalent | Confidence |
|---|---|---|---|
| {e.g. Spring DI} | @Component / @Autowired | .NET built-in DI (constructor injection) | Verified |

Only list items whose target support is verified or trivially standard.

**## 3. Needs Rework (YELLOW)**

Use parity table from loaded mapping reference file (YELLOW table). Add architecture-specific items.

| Component | What changes | Effort | Behavioral risk |
|---|---|---|---|
| {e.g. Spring Security} | SecurityFilterChain → AddAuthentication().AddJwtBearer() | M | MEDIUM |

Architecture-specific additions (derived from approved architecture docs):
- Auth strategy impact: e.g. "Entra ID requires Microsoft.Identity.Web — M effort, LOW risk"
- Hosting impact: e.g. "App Service requires HTTPS redirect + HSTS middleware — S effort, LOW risk"
- Data access impact: e.g. "Dapper requires manual SQL for all JPA method-name queries — L effort, HIGH risk"

**## 4. Will Break (RED)**

Use parity table from loaded mapping reference file (RED table).

For EACH red item:

### {Component name}

**What breaks and why:** {explanation grounded in source code patterns}

**Options:**

| Option | Approach | Tradeoff | One-way door? |
|---|---|---|---|
| A | {approach} | {tradeoff} | {Yes/No} |
| B | {approach} | {tradeoff} | {Yes/No} |

**Recommendation:** Option {X} — {one sentence reason}

**Behavioral risk:** {MEDIUM | HIGH | BLOCKER}

**## 5. Blockers**

Items with NO viable resolution under current constraints.
For each: state the blocker, the constraint it collides with, and what must change.

Include tooling BLOCKERs from Step 0.2 (missing dotnet SDK, missing Java, etc.).

**## 6. Dependency Ledger**

Run appropriate command:
- .NET: `dotnet list package --outdated` at SOURCE_PATH
- Java: `mvn versions:display-dependency-updates -q` at SOURCE_PATH
- Node.js: `npm outdated` at SOURCE_PATH

If command fails or unavailable: classify all unverified packages as UNKNOWN.

| Package | Current ver | Target status | Action |
|---|---|---|---|
| {package} | {ver} | Supported / Replacement: X / Deprecated / UNKNOWN | Upgrade / Replace / Verify |

**External integrations (beyond package versions).** Mirror the Stage 0.6 §8 Integration Inventory —
one row per external dependency, carrying its ground-truth evidence. A row whose `Verification status`
is `UNVERIFIED` is RED/UNKNOWN here (never rated on an assumed Kind):

| Integration | Kind (verified) | Evidence (PROV: config/assembly/WSDL) | Target approach | Verification status | Risk |
|---|---|---|---|---|---|
| {e.g. WallBuilder} | WCF basicHttpBinding/Transport/NTLM | PROV:Web.config#L120 | CoreWCF client / regenerate from WSDL | VERIFIED / UNVERIFIED / DEFERRED(task) | {MEDIUM/HIGH/BLOCKER} |

**## 7. Architecture Alignment**

For each major decision in the approved architecture, assess the migration impact:

| Architecture decision | Migration impact | Notes |
|---|---|---|
| Auth: {chosen strategy} | {e.g. Adds Microsoft.Identity.Web NuGet, OIDC middleware setup} | |
| Data: {Dapper / EF Core} | {e.g. All JPA method-name queries must be rewritten as explicit SQL} | |
| Hosting: {model} | {e.g. Connection strings must use Key Vault reference format} | |
