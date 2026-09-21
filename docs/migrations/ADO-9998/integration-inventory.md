# Integration Inventory — DebtFinanceTracker (ADO-9998)

_Generated: 2026-09-21 · Skill: rewrite · Source: Tier 1 (config evidence only)_

---

## External integrations (consumed by DebtFinanceTracker)

| # | Service | Endpoint | Binding | Contract | Classification | Status | Target approach |
|---|---|---|---|---|---|---|---|
| 1 | KirklandData | net.tcp://resources.svc.qa.kirkland.com/KirklandData/V1/Service.svc | netTcpBinding / Windows | IKirklandData | data-access-only | PARTIAL — HTTPS WSDL to verify | keep external · dotnet-svcutil from HTTPS WSDL |
| 2 | Security Manager | net.tcp://managers.svc.qa.kirkland.com/Security/v1/Service.svc | netTcpBinding / Windows | ISecurityManager | business-logic | PARTIAL — HTTPS WSDL to verify | keep external · dotnet-svcutil from HTTPS WSDL |
| 3 | Admin Security Manager | net.tcp://managers.svc.qa.kirkland.com/Security/v1/Admin/Service.svc | netTcpBinding / Windows | IAdminSecurityManager | business-logic | PARTIAL — HTTPS WSDL to verify | keep external · dotnet-svcutil from HTTPS WSDL |
| 4 | Filer | net.tcp://utilities.svc.qa.kirkland.com/Filer/v1/Service.svc | netTcpBinding / Streamed / Windows | IFiler | mixed | PARTIAL — MEX likely disabled; manual contract from source evidence | keep external · manual proxy authoring |
| 5 | Notification Sender | net.tcp://engines.svc.qa.kirkland.com/Notification/Sender/v1/Service.svc | netTcpBinding / Windows | INotificationSender | business-logic | PARTIAL — HTTPS WSDL to verify | keep external · dotnet-svcutil from HTTPS WSDL |
| 6 | NotificationGenerator (Tracker) | net.tcp://engines.svc.qa.kirkland.com/notification/Generator/Tracker/v1/Service.svc | netTcpBinding / Windows | ITrackerNotificationGenerator | business-logic | PARTIAL — HTTPS WSDL to verify | keep external · dotnet-svcutil from HTTPS WSDL |
| 7 | DMS | https://kedmssvc.qa.kirkland.com/ (appSettings:DMSURL) | config pass-through + SQL SP | n/a — iframe URL only | config pass-through | VERIFIED | GET /api/config/dms-url · iframe in Angular SPA · DMSLinksRemediation → Dapper SP |
| 8 | SQL Server (primary) | NCUSSQLSSID001.kirkland.com · DebtFinanceTracker DB | Windows Auth | Dapper (target) | data-access-only | VERIFIED | Dapper + parameterised SQL in target |
| 9 | SQL Server (ELMAH) | NCUSSQLSSID001.kirkland.com · AppLogging DB | Windows Auth | Serilog SQL sink | data-access-only | VERIFIED | Serilog SQL sink in target |
| 10 | SQL Server (session state) | NCUSSQLSSID001.kirkland.com | Windows Auth | ASP.NET Session | data-access-only | VERIFIED | Distributed cache / SQL session in target |

---

## Internal services exposed by DebtFinanceTracker (will be replaced by target API)

| Service | Binding | Note |
|---|---|---|
| DealFunctions.svc (webHttpBinding) | HTTPS / Windows | Replaced by ASP.NET Core Web API controllers |
| LookupService.svc (webHttpBinding) | HTTPS / Windows | Replaced by ASP.NET Core Web API controllers |
| SecurityAuditing.svc (netTcpBinding) | Windows | Absorbed into target auditing infrastructure |

---

## Auth model (Tier 1)

- `<authentication mode="Windows"/>` + `<deny users="?"/>` — full Windows Auth, no anonymous access
- `KERoleProvider` from `KE.Security` — role-based access via Security Manager WCF
- All WCF clients use `clientCredentialType="Windows"` (Kerberos/NTLM via App Pool identity)

---

## PARTIAL rows requiring resolution before APPROVE DESIGN

All 5 WCF external clients (services 1–6 except DMS) are PARTIAL — auth scheme and contract details need verification via HTTPS WSDL (on VPN) or manual proxy authoring (Filer).
These are advisory at APPROVE OPTIONS but become a hard block at APPROVE DESIGN.
