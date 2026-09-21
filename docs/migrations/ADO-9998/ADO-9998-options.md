# Rewrite Options — DebtFinanceTracker (ADO-9998)

_Generated: 2026-09-21 · Skill: rewrite · Status: Awaiting APPROVE OPTIONS_

---

## Source

| Item | Value |
|---|---|
| Stack | ASP.NET Framework 4.8 · Web Forms + MVC 5 + Web API 2 · EF6 (EDMX) · Unity DI · KERoleProvider |
| Auth | Windows Authentication (IIS) · KE.Security WCF · App Pool identity for all WCF outbound calls |
| Integrations | 5 WCF external (keep external) · 1 WCF Streamed Filer (manual proxy) · DMS config pass-through · SQL Server (Windows Auth) |
| Files | 239 |
| Modules | 10 projects |
| Posture | `re-architecture` — aspnet-framework → aspnet-core crosses a stack boundary; port refused |
| Oracle mode | `self-run` — running IIS instance confirmed available |
| Assurance ceiling | BAL A for all options (self-run oracle; golden master capture possible) |

---

## Option A — .NET 10 + Razor Pages *(Structural continuity)*

| Attribute | Value | Basis |
|---|---|---|
| Target stack | ASP.NET Core 10 Razor Pages + minimal API · C# · Dapper · MSDI · Serilog | estimate:target-projection |
| Posture | re-architecture | computed |
| Clusters | 5 (Core Domain · LegacyIntegration · Web · Background Services · Tests) | estimate:target-projection |
| Wave schedule | 4 waves — Wave 1: Core; Wave 2: LegacyIntegration; Wave 3: Web + BgSvc (parallel); Wave 4: Tests | estimate:target-projection |
| Effort | Medium-low | estimate:source-analysis |
| Onboarding cost | Low — single deployment unit; IIS hosting retained; C# skills fully applicable | estimate:team-profile |
| Recurring run-cost | Low — same IIS hosting model; no new infrastructure | estimate:hosting |
| Assurance ceiling | BAL A (self-run oracle) | computed |
| UI migration | Web Forms (.aspx) → Razor Pages; code-behind → PageModel; jQuery retained | estimate:source-analysis |
| WCF handling | Regenerate proxies via dotnet-svcutil (HTTPS WSDL); isolate in LegacyIntegration project | estimate:source-analysis |

**DAG basis:** INFERRED — target-space projection from source structure; no target app exists yet

**Summary:** Lowest structural change — .aspx code-behind maps directly to Razor Pages PageModel. Windows Auth native on ASP.NET Core + IIS. DealFunctionsController (Web API) becomes a minimal API alongside Razor Pages in the same project. EF6 EDMX replaced with Dapper. Unity DI replaced with MSDI. Highest risk element: the dynamic SectionBuilder/WallBuilder field rendering pattern must be re-expressed as partial pages or tag helpers — idiomatic but requires deliberate design.

---

## Option B — .NET 10 Web API + Angular 18 *(Full decoupling)*

| Attribute | Value | Basis |
|---|---|---|
| Target stack | ASP.NET Core 10 Web API · Angular 18 SPA · C# + TypeScript · Dapper · MSDI · Serilog | estimate:target-projection |
| Posture | re-architecture | computed |
| Clusters | 7 (Core Domain · LegacyIntegration · API · Angular Frontend · Background Services · Tests-BE · Tests-FE) | estimate:target-projection |
| Wave schedule | 5 waves — Wave 1: Core; Wave 2: LegacyIntegration; Wave 3: API + BgSvc (parallel); Wave 4: Frontend + Tests-BE (parallel); Wave 5: Tests-FE | estimate:target-projection |
| Effort | High — two separate applications; TypeScript; two test suites; dual CI/CD pipeline | estimate:source-analysis |
| Onboarding cost | High — Angular toolchain (Node/npm, Angular CLI, TypeScript, RxJS); CORS + Windows Auth configuration | estimate:team-profile |
| Recurring run-cost | Medium — two deployment units (API + SPA static site); potential CDN cost | estimate:hosting |
| Assurance ceiling | BAL A (self-run oracle; two independent golden masters required) | computed |
| UI migration | Web Forms → Angular components; server-side rendering → SPA client-side rendering | estimate:source-analysis |
| WCF handling | Same as Option A for backend; API exposes JSON to Angular | estimate:source-analysis |

**DAG basis:** INFERRED — two-track (backend + frontend) decomposition

**Summary:** Highest architectural quality and long-term maintainability. Clean API contract. Highest effort and risk. Windows Auth over CORS (withCredentials + Negotiate) is non-trivial. Dynamic section rendering (SectionBuilder/WallBuilder) requires an Angular runtime component factory — the most complex expression of this pattern across all three options. No Angular footprint visible in the source team's current stack (jQuery 3.7.1, Bootstrap 5.3.3, server-rendered markup).

---

## Option C — .NET 10 + Blazor Server *(C#-native UI)*

| Attribute | Value | Basis |
|---|---|---|
| Target stack | ASP.NET Core 10 Blazor Server · C# · Dapper · MSDI · Serilog | estimate:target-projection |
| Posture | re-architecture | computed |
| Clusters | 5 (Core Domain · LegacyIntegration · Blazor App · Background Services · Tests) | estimate:target-projection |
| Wave schedule | 4 waves — Wave 1: Core; Wave 2: LegacyIntegration; Wave 3: Blazor + BgSvc (parallel); Wave 4: Tests (xUnit + bUnit) | estimate:target-projection |
| Effort | Medium | estimate:source-analysis |
| Onboarding cost | Low–medium — stays C# throughout; bUnit for component testing; SignalR connection model | estimate:team-profile |
| Recurring run-cost | Low-medium — single deployment unit; SignalR per-user connection adds server memory overhead | estimate:hosting |
| Assurance ceiling | BAL A (self-run oracle; bUnit component tests count toward behavioral coverage) | computed |
| UI migration | Web Forms → Blazor components; code-behind event handlers → EventCallback; ViewState → component state | estimate:source-analysis |
| WCF handling | Same as Option A | estimate:source-analysis |

**DAG basis:** INFERRED — same shape as Option A; Blazor App cluster replaces Web cluster

**Summary:** Stays in C# (no TypeScript). Blazor's DynamicComponent is the best structural fit for SectionBuilder/WallBuilder metadata-driven field rendering — the component model was designed for exactly this pattern. Reactive component lifecycle (OnInitializedAsync, EventCallback, StateHasChanged) is a larger conceptual shift from Web Forms code-behind than Razor Pages PageModel. SignalR per-user connection is a new operational dependency requiring WebSocket support on IIS and sticky sessions if load-balanced.

---

## Comparison Summary

| | Option A — Razor Pages | Option B — Web API + Angular | Option C — Blazor Server |
|---|---|---|---|
| Clusters | 5 | 7 | 5 |
| Waves | 4 | 5 | 4 |
| Effort | Medium-low | High | Medium |
| Assurance ceiling | BAL A | BAL A | BAL A |
| Deployment units | 1 | 2 | 1 |
| Stays C# throughout | Yes | Backend only | Yes |
| Frontend skills needed | C# / HTML / jQuery | TypeScript + Angular | C# + Blazor |
| Windows Auth complexity | None | High (CORS + Negotiate) | None |
| Dynamic UI mapping | Good (partial pages / tag helpers) | Complex (runtime component factory) | Best (DynamicComponent — first-class) |
| SectionBuilder pattern fit | Good | Complex | Best |
| Source team skill overlap | High | Low (no Angular) | Medium |

---

## Judge Analysis

_Judge: [SA] Rafael Mendes — posture, options, architecture._
_Triggered: automatically (close call between A and C on dynamic UI fit)_

**Key finding — the SectionBuilder/WallBuilder pattern is the deciding factor.**
The source's core UI abstraction is runtime metadata-driven field rendering. Every option must express this idiomatically:
- **Option A (Razor Pages):** tag helpers + partial views driven by field metadata. Server-side, idiomatic, lowest risk. The developer already understands server-rendered form pages — this is the closest mental model.
- **Option C (Blazor):** `DynamicComponent` renders field components from a registry keyed by field type. More expressive for field-level interactivity (conditional show/hide, real-time validation), but the reactive model (StateHasChanged, cascading parameters) is a genuine learning investment.
- **Option B (Angular):** `ViewContainerRef.createComponent()` with a component registry. Technically achievable but the most architecturally complex — requires careful lazy-loading, type registration, and standalone component patterns. No Angular footprint in the source team.

**Per-option verdict:**
- **Option A — RECOMMENDED** for this migration. Lowest risk, highest behavioral fidelity, same Windows Auth model. Trade-off: no clean API contract for future consumers (acceptable for an internal firm application with no known external API consumers).
- **Option C — Conditional.** Select only if the team explicitly commits to learning the Blazor component model. Do not select as a "safe middle ground" — it is a genuine architectural investment, not a compromise.
- **Option B — Not recommended** without Angular expertise on the team. Three compounding risks (CORS+Negotiate, runtime component factory, dual CI/CD pipeline) make this the wrong choice unless staffed for it.

**Recommendation scorecard:**

| Criterion | Weight | Option A | Option B | Option C |
|---|---|---|---|---|
| Behavioral fidelity risk | High | Low | High | Medium |
| Windows Auth complexity | High | None | High | None |
| Dynamic UI mapping fit | High | Good | Complex | Best |
| Team skill overlap | Medium | High | Low | Medium |
| Deployment complexity | Medium | Low | High | Low-medium |
| Overall fit | — | **Strong** | Conditional | Moderate |

---

## Pre-design questions (answer with APPROVE OPTIONS)

1. **Architecture:** Keep flat layer structure or redesign as Clean Architecture (Domain · Application · Infrastructure · Presentation)?
2. **Hosting:** Retain IIS + Windows Auth on-premises, or migrate to Azure App Service?
3. **Notification Worker:** Deploy as standalone Windows Service (Option 1A) or as IHostedService inside the API (Option 1B)?

---

## PARTIAL integration rows (advisory now; hard-block at APPROVE DESIGN)

| Service | Status | Required before design gate |
|---|---|---|
| KirklandData | PARTIAL | HTTPS WSDL verification on VPN |
| Security Manager | PARTIAL | HTTPS WSDL + role code confirmation |
| Admin Security Manager | PARTIAL | HTTPS WSDL verification |
| Filer | PARTIAL | Manual proxy authoring from source evidence (MEX disabled) |
| Notification Sender | PARTIAL | HTTPS WSDL verification |
| Notification Generator | PARTIAL | HTTPS WSDL verification |

---

_To proceed: `APPROVE OPTIONS ADO-9998 [A | B | C]` with answers to the pre-design questions above._
