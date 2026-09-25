# Migration Log — DebtFinanceTracker Rewrite (ADO-9998)
Living document. Updated at every decision point. Never truncated — the full history is the asset.
Source: c:\Users\rawatv\source\repos\KE.KMS.Trackers.Phase12\DebtFinanceTracker (ASP.NET Framework 4.8 · EF6 · WCF clients) · Target: .NET 10 Web API + Angular 18 · Clean Architecture · IIS On-Premises · Skill: Rewrite
Started: 2026-09-21 · ADO: ADO-9998

Session continuation: share this file alongside the design documents and integration inventory.
Future migrations of similar apps: read the ## Lessons section.

---

## Phase 1: Source Analysis

### [FINDING] Source is ASP.NET Framework 4.8 · 10 projects · EF6 · WCF clients

**Discovered:** `migration-source-detect.cjs` detected `dotnet_framework v4.8` as the primary stack across 10 projects. Projects: Adapters · Adapters.Tests · Auditing · Library · Library.Tests · Notification.SchedulerService · Resource · UI.Web · UI.Web.Tests · ValidNullDataTask. Data layer: EF6 (EDMX). Integrations: 14 WCF client endpoints (App.config × 3 + Web.config × 1) with security mode present; 13 direct-DB connection strings across configs. 239 source files. Knowledge graph present; architecture docs present. PROV: migration-source-detect.cjs output.
**Why it matters:** The EF6 EDMX model and WCF client surface both require deliberate re-architecture decisions — no direct equivalents exist in the .NET 10 target stack. WCF clients must be regenerated using System.ServiceModel.* NuGet packages; EF6 EDMX will not migrate and must be replaced with Dapper or EF Core.
**Wrong approach to avoid:** Assuming EF6 EDMX maps to EF Core migrations — EDMX is not supported in .NET 10. Attempting to reference existing WCF NuGet packages that target net48 only will fail at build time.
**Action taken:** Posture resolved as `re-architecture` (framework boundary: aspnet-framework → aspnet-core). Port refused. Design must be authored from scratch in target space.

### [FINDING] Posture resolved as re-architecture

**Discovered:** `rewrite-decompose.cjs posture` returned `re-architecture` — aspnet-framework → aspnet-core crosses a stack boundary. Port refused. Two pre-design questions raised: (1) keep existing architecture or redesign for target platform? (2) keep current platform/topology or adopt target-native services? PROV: rewrite-decompose.cjs posture output.
**Why it matters:** All target design documents must be authored from scratch in target space. No source structure can be carried forward directly; cluster DAG must be a genuine target-space projection, not a copy of the source module graph.
**Wrong approach to avoid:** Decomposing the source graph identically for all options — re-architecture posture requires a reshaped target-space projection per option.
**Action taken:** Posture recorded in checkpoint ledger. Pre-design questions will be answered at APPROVE OPTIONS.

### [INTEGRATION] KirklandData WCF — Tier 1 verification

**Initial state:** PARTIAL — server source not in configured roots; net.tcp MEX expected disabled
**Evidence — Tier 1:** PROV: DebtFinanceTracker.UI.Web/Web.config#248 — `net.tcp://resources.svc.qa.kirkland.com/KirklandData/V1/Service.svc` · contract: `IKirklandData` · binding: netTcpBinding · Windows auth
**Evidence — Tier 2:** Not available — additionalDirectories does not include KirklandData source
**Resolved to:** PARTIAL — HTTPS WSDL endpoint to be verified on VPN before APPROVE DESIGN
**Classification:** data-access-only
**Options derived:** A · keep external (dotnet-svcutil from HTTPS WSDL) · B · inline source (blocked — not in configured roots)
**Option chosen:** A (keep external) — firm-wide service not owned by this application; WCF client via System.ServiceModel.* in LegacyIntegration project
**Wrong approach to avoid:** Attempting net.tcp MEX — all KE production WCF services have MEX disabled on net.tcp endpoints

### [INTEGRATION] DMS — reclassified from REST API to config pass-through

**Initial state:** PARTIAL — previously documented as REST API in architecture docs
**Evidence — Tier 1:** PROV: Web.config#34 — `appSettings["DMSURL"] = "https://kedmssvc.qa.kirkland.com/"` — a URL value in config, not an HTTP client
**Resolved to:** VERIFIED — DMS is an iframe URL from config + SQL stored procedure (spUpdateFileTitleForOldAttachments). No HTTP client.
**Classification:** config pass-through + SQL
**Option chosen:** GET /api/config/dms-url returns the URL; Angular SPA embeds it in an iframe; DMSLinksRemediation → Dapper stored procedure call
**Wrong approach to avoid:** Building an IDmsClient HTTP adapter class — there is no DMS REST API to call from the backend

### [OPTION] Oracle mode selected — 2026-09-21

**Options file:** docs/migrations/ADO-9998/ADO-9998-options.md
**Oracle mode decision:** self-run — developer confirmed a running IIS instance is accessible
**Assurance ceiling:** BAL A (self-run oracle available — golden master capture possible)
**Why chosen:** Running instance available on QA/IIS; behavioral golden master capture will be set up before cluster BAL grading in Step 4
**Wrong approach:** Defaulting to deferred-capture without checking — self-run is available and raises the assurance ceiling from B to A

## Phase 2: Options

## Phase 3: Target Design

## Phase 4: Generation

## Phase 5: Verification

---

## Decisions summary

| Decision | Chosen | Alternatives rejected | Date |
|---|---|---|---|

## Risks accepted

| Risk | Level | Accepted because | Compensating control |
|---|---|---|---|

---

## Lessons

---

## Transferable Patterns

