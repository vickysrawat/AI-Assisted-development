# Security Skill — Domain Guidance
_Load this file lazily in the analysis pass — only after language detection and scope reporting._

---

## 3. Domain Guidance

### 3a. Code & Application Security (appsec)

**Review checklist** (apply to any code submitted):
- Injection: SQL, NoSQL, OS command, LDAP, XPath, template injection (CWE-89, 77, 94)
- Broken authentication / session management (OWASP A07, CWE-287, 384)
- Sensitive data exposure: secrets in code, weak crypto, missing TLS (CWE-312, 326, 798)
- IDOR / broken access control (OWASP A01, CWE-639) — **actively scan for these patterns:**

  **Pattern 1 — User identity in URL path or query parameter**
  ```
  // Red flags — identity derived from URL, not from server-side session
  this.http.get(`/api/views/${this.currentUsername}`)
  this.http.get(`/api/data?user=${userId}`)
  this.http.post(`/api/settings/${this.username}`, body)
  ```
  Any route where a username, userId, accountId, or other identity value comes from
  the client (URL param, query string, request body) rather than from the authenticated
  session on the server is an IDOR candidate. Flag as Medium/High depending on data sensitivity.

  **Pattern 2 — Object ID in URL with no ownership check visible**
  ```
  // Red flags — numeric or opaque IDs in URLs
  this.http.get(`/api/matters/${matterId}`)
  this.http.delete(`/api/views/${viewId}`)
  ```
  If the backend endpoint accepts an ID and there's no evidence of server-side ownership
  verification (the ID alone grants access), flag it. Check whether the authenticated user's
  identity is re-verified against the resource, not just the URL parameter.

  **Pattern 3 — /whoami or identity endpoint used as an auth substitute**
  ```
  // Red flag — using identity discovery as if it were authentication
  this.http.get('/whoami').subscribe(user => { this.currentUser = user; });
  // Then using this.currentUser to scope data — but no auth enforcement on the API
  ```
  If the app calls a `/whoami` or `/me` endpoint to discover the current user and then
  uses that value to filter or scope data *client-side*, but the API endpoints themselves
  don't enforce ownership server-side, this is identification masquerading as authorization.

  **Title to use:** "Username in URL path" or "User ID controllable by client" — not
  "IDOR via username parameter". Plain language, not taxonomy.
- Security misconfiguration: debug flags, permissive CORS, verbose errors (OWASP A05)
- Vulnerable dependencies: flag if visible; recommend `npm audit`, `pip-audit`, `trivy`, etc.
- SSRF, XXE, deserialization (CWE-918, 611, 502)
- Business logic flaws

- **Unsafe JSON.parse of untrusted / localStorage data (CWE-20)** — actively scan for:
  ```typescript
  // Red flag — no try/catch around JSON.parse from external source
  const val = JSON.parse(localStorage.getItem('key'));         // throws on corrupt data
  const val = JSON.parse(response.body);                       // throws on malformed response
  ```
  Any `JSON.parse()` call without a try/catch that reads from localStorage, sessionStorage,
  URL params, or an API response is a Medium finding — an app crash with no user-facing
  error message. Fix: wrap in `try { ... } catch { return fallback; }`.

- **Unsafe deserialization applied directly to framework APIs (CWE-502)** — actively scan for:
  ```typescript
  // Red flag — parsed JSON applied directly to grid/framework without schema validation
  this.gridApi.applyColumnState({ state: JSON.parse(v.ColumnState) });   // no validation
  this.gridApi.setFilterModel(JSON.parse(v.FilterModel));                 // no validation
  ```
  JSON from backend storage (saved views, user preferences, persisted state) applied
  directly to framework methods like AG Grid's `applyColumnState`, `setFilterModel`, or
  Angular's `patchValue` without schema validation. A compromised backend or privileged
  user can push a malicious payload affecting all users who load that view.
  Fix: validate object shape (known keys, expected types) before applying.

- **window.prompt / native dialogs for user input (CWE-20 / UX + injection vector)** — scan for:
  ```typescript
  // Red flag — native browser dialog, unsanitized input sent to backend
  const name = prompt('Enter a name:');
  this.http.post('/api/resource', { name: name.trim() });  // only trimmed, not sanitized
  ```
  Native `prompt()`, `confirm()`, and `alert()` are blockable by enterprise browser policies,
  unstyable, and provide no input validation feedback. More critically, if the raw value is
  sent to a backend that stores and later reflects it, this is a stored injection vector.
  Fix: Angular modal/inline input component + maxlength + strip control characters.

- **Direct DOM manipulation bypassing framework security (CWE-749)** — scan for:
  ```typescript
  // Red flag — direct DOM access bypasses Angular's security context
  document.querySelector('.panel').style.width = '0';
  document.getElementById('myEl').innerHTML = someValue;
  (elementRef.nativeElement as HTMLElement).style.display = 'none';
  ```
  `document.querySelector()`, `document.getElementById()`, `.innerHTML` assignment, and
  direct `.style` manipulation bypass Angular's Renderer2 and security sanitization pipeline.
  Angular cannot intercept or sanitize these writes. Fix: use `@ViewChild` with `Renderer2`,
  or template bindings (`[class.collapsed]="!open"`, `[style.display]="..."`).

- **Unscoped data export — full dataset instead of filtered rows (CWE-359)** — scan for:
  ```typescript
  // Red flag — exports full backing array, ignores active user filters
  this.rowData.forEach(row => worksheet.addRow(...));
  // vs. correct:
  this.gridApi.forEachNodeAfterFilterAndSort(node => worksheet.addRow(...));
  ```
  Any export function (CSV, Excel, PDF) that iterates over the full data array (`this.rowData`,
  `this.allItems`) rather than the filtered/visible dataset exports records the user should not
  see based on their current filters. Flag as Low/Medium depending on data sensitivity.
  Also: check for server-side audit logging of export events.

- **No audit logging for sensitive data access or mutations (CWE-778)** — scan for:
  ```typescript
  // Red flag — data access or mutation with no backend logging
  this.http.get('/api/sensitive-data').subscribe(...);  // no server log of who accessed what
  this.http.post('/api/views', body).subscribe(...);    // no audit trail for mutations
  ```
  Systems handling PII, legal data, financial data, health data, or immigration data are
  expected to log: who accessed which data, when exports occurred, and when records were
  created/modified/deleted. The backend should log (timestamp, userId, operation, resource)
  — never the data itself. Flag as Informational/Low; escalate to Medium if a compliance
  framework (HIPAA, SOC2, GDPR) applies.

- **No rate limiting on data-heavy endpoints (CWE-400)** — scan for:
  ```typescript
  // Red flag — preloads all data on startup, re-fetches on every tab switch
  ngOnInit() { this.tabs.forEach(tab => this.loadTabData(tab)); }
  onTabChange() { this.loadData(this.activeTab); }
  ```
  Large dataset endpoints (CSV files, bulk exports, reporting queries) with no caching headers,
  no ETag support, and client-side code that re-fetches on every interaction are DoS candidates.
  Flag as Informational; recommend `Cache-Control`, ETag, and lazy-loading on first access.

- **console.log / console.error in production with sensitive data (CWE-209)** — scan for:
  ```typescript
  // Red flag — error objects logged to console expose internal details
  error: err => console.error('Save view error:', err)   // includes URL, headers, body
  console.log('User data:', this.userData);               // PII in browser console
  ```
  `console.error(err)` with a full HTTP error object exposes response bodies, API URLs,
  headers, and stack traces in the browser DevTools — visible to any user. Violates
  no-console-log project rules. Fix: remove; surface errors via a toast/error service.
  If server-side error tracking is needed, use the backend logger, not the browser console.

**Severity calibration**:

CVSS provides the mathematical baseline. Business context can escalate — never
downgrade — from the CVSS score. Always report both when they differ.

- Critical (CVSS 9.0–10 OR business override): RCE, auth bypass, mass data exfiltration,
  or any finding matching the business override triggers above (privileged data,
  immigration PII, attorney-client content, vulnerable population, breach notification duty)
- High (CVSS 7.0–8.9, no override): Significant data exposure, privilege escalation, SQLi
- Medium (CVSS 4.0–6.9): Stored XSS, IDOR limited scope, information disclosure
- Low (CVSS 0.1–3.9): Best-practice gaps, minor information leakage

**This codebase specifically**: Any finding involving client names, matter numbers,
A-Numbers, hearing dates, or attorney-client communications is Critical by business
severity regardless of CVSS score. Do not let the maths override the context.

**Language-specific notes**: Load `$PLUGIN_DIR/skills/security/references/language-notes.md` when the user provides code
in Python, JavaScript/Node, Java, Go, C/C++, Ruby, C#, ASP.NET (Framework / Core / 6+ / Web API),
WCF, Entity Framework, other ORMs (Dapper, NHibernate), or SQL (SQL Server, PostgreSQL, MySQL).

### 3b. Cloud & Infrastructure Security

**Focus areas by provider**:
- AWS: IAM least-privilege, S3 bucket policies, Security Groups, GuardDuty, CloudTrail,
  Secrets Manager vs. hardcoded creds, public exposure via Resource Policies
- GCP: IAM roles, VPC firewall rules, GCS bucket ACLs, Cloud Audit Logs, CMEK
- Azure: RBAC, NSGs, Key Vault, Defender for Cloud, Storage Account public access
- IaC (Terraform/CDK/CloudFormation): flag `*` in IAM policies, open 0.0.0.0/0 SGs,
  unencrypted storage, missing logging

**CIS Benchmark mapping**: Map findings to CIS Benchmark control IDs when applicable.

### 3c. Threat Modeling & Architecture Review

**Default methodology**: STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure,
Denial of Service, Elevation of Privilege).

**Process**:
1. Identify assets and trust boundaries from the description or diagram.
2. Enumerate data flows across boundaries.
3. Apply STRIDE to each flow and component.
4. Score each threat: Likelihood (1–5) × Impact (1–5) = Risk Score.
5. Propose mitigations and map to NIST CSF functions (Identify/Protect/Detect/Respond/Recover).

**When to suggest PASTA**: For complex, multi-tier applications where attacker motivation
and business impact need explicit modelling.

### 3d. Incident Response & Forensics

**Triage questions to ask** (if not provided):
- What systems/services are affected?
- When was the anomaly first observed?
- Are credentials, data, or services believed to be compromised?
- What logs are available (SIEM, CloudTrail, endpoint EDR, network)?

**Containment-first principle**: Always lead with immediate containment actions before
deep investigation steps.

**Common log sources and queries**:
- AWS CloudTrail: `eventName`, `sourceIPAddress`, `userAgent`, `errorCode`
- Linux auth: `/var/log/auth.log` — failed logins, sudo escalation
- Web server: 4xx/5xx spikes, unusual UA strings, path traversal patterns
- Windows: Event IDs 4624/4625 (logon), 4688 (process), 7045 (service install)

### 3e. Compliance & Policy

**Framework quick-reference**:
- **SOC2 TSC**: CC6 (Logical access), CC7 (System operations), CC8 (Change mgmt), A1 (Availability)
- **ISO 27001:2022**: Annex A controls (93 controls across 4 themes)
- **NIST CSF 2.0**: Govern / Identify / Protect / Detect / Respond / Recover
- **CIS Controls v8**: IG1/IG2/IG3 implementation groups
- **PCI-DSS v4**: 12 requirements; focus on req 6 (secure dev), 8 (auth), 10 (logging)
- **HIPAA**: Technical safeguards — access control, audit controls, integrity, transmission security

**Gap analysis approach**: For each control, assess: Fully Met / Partially Met / Not Met / Not Applicable.
Always pair gaps with a prioritised remediation action and estimated effort (Low/Medium/High).

### 3f. Weekly Security Summary

Load `$PLUGIN_DIR/skills/security/references/weekly-summary-template.md` for the full HTML template, data input schema,
and generation instructions.

**Trigger phrases**: "generate weekly summary", "weekly security report", "security digest",
"manager briefing", "security health report", "weekly rollup".

**Minimum data needed** (ask the user if not provided):
- Week date range (e.g., 19 May – 25 May 2025)
- Open vulnerability counts by severity (Critical / High / Medium / Low) — this week and last week
- New findings opened this week
- Findings closed/remediated this week
- Active incidents (count, status)
- Compliance posture (per framework: % controls met)
- Findings by owner or team (optional but recommended)
- Top 3–5 priority actions with owner and due date

If the user provides raw notes, a spreadsheet paste, or a previous report, extract the data
from it before generating. Do not invent numbers — use "N/A" or "Not provided" for missing fields.

---
