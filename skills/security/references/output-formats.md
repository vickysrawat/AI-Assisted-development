# Security Skill — Output Formats
_Load this file lazily — only after domain detection (§1 Orientation)._

---

## 2. Output Formats

Use the format that fits the task. Mix formats when a task spans domains.


### CRITICAL severity — when to use it

**CVSS is a floor, not a ceiling.** A finding can be Critical even when the CVSS
mathematical score falls below 9.0. The full business override specification is in
`../shared/business-context-severity.md` — that spec is the single source of truth.
The rules below are a summary; the shared spec takes precedence. Business context, data classification, and
regulatory or ethical exposure can all mandate an override. When overriding, you must
state both the CVSS score and the reason for the business severity escalation.

#### Mandatory Critical — always Critical regardless of CVSS score

1. **PII or confidential data in a publicly accessible path** — any file in `public/`,
   `static/`, `wwwroot/`, or `assets/` containing names, IDs, health data, legal data,
   financial data, or credentials. No authentication bypass required — data is directly
   accessible by URL.
2. **Credentials or secrets in source code or committed files** — API keys, passwords,
   private keys, tokens hardcoded anywhere that could be read without auth.
3. **Unauthenticated RCE or SQL injection** — code paths that execute arbitrary commands
   or queries from unsanitized user input with no auth check.
4. **Exposed admin or internal endpoints with no auth** — admin panels, debug endpoints,
   or internal APIs reachable without authentication.

#### Business severity override — escalate to Critical when CVSS < 9.0 but context demands it

Apply a Critical business severity override when **any** of the following are true,
even if the CVSS mathematical score is 7.x or 8.x:

| Override trigger | Why it mandates Critical |
|---|---|
| B1 | **Attorney-client privileged data** | Bar ethics rules. Exposure is a professional conduct violation regardless of whether it was accessed. |
| B2 | **Immigration identifiers (A-Numbers, visa numbers, case IDs)** | Government identifiers for individuals in active proceedings. Exposure can jeopardise live cases, trigger mandatory breach reporting, and endanger vulnerable individuals. |
| B3 | **Hearing dates, filing deadlines, or case status** | Exposure of active case timelines enables interference with legal proceedings. |
| B4 | **Pro bono or vulnerable population data** | Individuals who have no recourse, no legal resources, and face life-altering consequences if their data is used against them. |
| B5 | **Any data subject to mandatory breach notification** | State privacy laws (CCPA, VCDPA, etc.), HIPAA-adjacent data, or bar ethics obligations trigger reporting duties — the notification cost alone justifies Critical. |
| B6 | **Data that could endanger physical safety** | Immigration status, location, or identity data for individuals at risk of harm if identified. |
| B7 | **Real PII in a static-serving directory** (public/, wwwroot/, assets/) | No authentication required — data is directly accessible by URL to anyone who can reach the server. |

When a business override applies, both the mathematical CVSS and the business severity
must be stated in the finding:

```
- **Severity**: Critical (business override)
- **CVSS v3.1**: 7.5 (AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N) — mathematical score
- **Business severity**: Critical
- **Override reason**: Attorney-client privileged data + immigration PII (A-Numbers)
  for individuals in active proceedings. Mandatory breach notification obligations.
  CVSS Adjacent network vector understates risk — VPN/corporate Wi-Fi broadens
  the realistic attack surface to Network scope.
```

Do NOT downgrade these to High because "it's an internal app" or "it requires network
access." The CVSS score is based on potential impact, not assumed access controls.
Do NOT let a 7.5 CVSS score override your judgement when the data is attorney-client
privileged or exposes individuals to physical, legal, or immigration jeopardy.

### 2a. Vulnerability Report (appsec / cloud)

#### Writing style — CRITICAL RULES for both title and description

The goal is a report a developer reads once and acts on immediately.
Every finding has two parts that must both be plain and direct: the **title** and the **description+remediation**.

---

**TITLES — plain English, not taxonomy**

Write the title as if telling a colleague what's wrong in one sentence fragment.
If the title needs more than 6 words, it is probably a description, not a title.
CWE/OWASP IDs belong in the metadata fields — never in the title.

✅ Good titles:
- "No authentication or authorization"
- "Real client PII in public directory"
- "All traffic is plaintext HTTP"
- "Stored XSS via unsanitized cell renderer"
- "No CSRF protection on mutating endpoints"
- "Hardcoded internal server hostname"
- "Incomplete .gitignore"
- "Username exposed in URL path"

❌ Bad titles:
- "No HTTP Request Authentication — Identity Relies Solely on /whoami"
- "Transport Security Deficiency in API Communication Layer"
- "Insufficient Input Sanitization in DOM Rendering Pipeline"
- "Insecure Direct Object Reference via Username URL Parameter"

---

**DESCRIPTIONS — explain the actual behaviour, not just the category**

The description must answer three questions in plain prose:
1. **What is the code actually doing?** (the specific behaviour)
2. **Why is that a problem?** (the real-world consequence)
3. **Who is affected and how?** (the impact)

Then the remediation must be **specific to this codebase** — not generic OWASP advice.
Name the actual file, function, and fix. Include corrected code.

✅ Good description (from Claude built-in):
> "The app calls `/whoami` to discover the current Windows username and uses it as a
> view-storage key. This is identification, not authentication. There is no token,
> session cookie, or role check enforced — anyone who can reach the server gets full
> read access to all matter, client, immigration, and timekeeper data."
>
> Remediation: "The backend must enforce Windows Integrated Authentication
> (NTLM/Kerberos) or another auth mechanism and return 401/403 for unauthenticated
> requests. The Angular HttpClient config should include `withCredentials: true` so
> the browser sends auth headers."

❌ Bad description:
> "The application lacks proper authentication mechanisms, exposing sensitive data to
> unauthorized access. Authentication is a critical security control per OWASP A07.
> Implement appropriate authentication and session management controls."

The bad version describes a category. The good version describes *this app*, *this endpoint*,
*this consequence*, and *this specific fix*. Always write the good version.

---

**FORMAT**

```
## Vulnerability Report

### [VULN-001] <Plain-language title>
- **Severity**: Critical / High / Medium / Low / Informational
- **CVSS v3.1**: <mathematical score> (<vector string>)
- **Business severity**: <Critical / High / Medium — omit if same as CVSS severity>
- **Override reason**: <only present when business severity differs from CVSS severity>
- **CWE**: CWE-<id> — <name>
- **OWASP Top 10**: <category if applicable>
- **Location**: <file:line>

<Plain prose: what the code is doing, why it's a problem, who is affected.
Reference the actual file, function, or variable by name. 2–4 sentences.>

Evidence:
<Minimal code snippet showing the flaw — actual code from the file, not pseudocode>

Remediation:
<Specific fix for this codebase. Name the file and function. Include corrected code.
Not generic advice — tell the developer exactly what to change.>
```
Group findings by severity (Critical → Informational). End with an **Executive Summary**
table: | Finding | Severity | Status |

### 2b. Hardened / Remediated Code
Provide the full corrected code block with inline comments prefixed `// SECURITY:` explaining
each change. Follow with a **Changes Summary** list.

### 2c. Threat Model
Use STRIDE categories. Structure:
1. **System Description** — assets, trust boundaries, data flows (reference uploaded diagram if present)
2. **Threat Enumeration** — table: | ID | STRIDE Category | Threat | Affected Component | Likelihood | Impact |
3. **Mitigations** — per threat ID
4. **Residual Risk** — what remains after mitigations
5. **Priority Roadmap** — top 5 items to address, ordered by risk

### 2d. Incident Response
Adapt to phase:
- **Triage**: IOCs, affected scope, initial containment steps
- **Investigation**: log queries, forensic artefacts to collect, timeline reconstruction
- **Containment/Eradication**: concrete commands/actions
- **Recovery**: restoration steps, monitoring to re-enable
- **Post-Mortem**: root cause, detection gap, remediation, lessons learned

### 2e. Compliance Mapping
Table format:
| Control ID | Control Name | Framework | Current Status | Gap | Recommended Action |

Supported frameworks: SOC2 TSC, ISO 27001:2022 Annex A, NIST CSF 2.0, NIST 800-53 Rev5,
CIS Controls v8, PCI-DSS v4, HIPAA Security Rule.

### 2f. Step-by-Step Recommendations
Numbered list. Each step: what to do, how to do it (command/config if applicable), why it matters.

### 2g. Weekly Security Summary (HTML)
Load `references/weekly-summary-template.md` for the full HTML template and data input format.

The summary is a self-contained HTML file combining:
- Overall security health score and RAG status
- Open vulnerability breakdown by severity and remediation trend
- Compliance posture snapshot
- Incident activity for the week
- Findings by owner / team workload
- Risk trend (improving / stable / degrading) with week-on-week delta
- Top actions required with owner and due date

Always generate the summary as a complete, self-contained `.html` file ready to open in a browser
or embed in a portal. Do not produce a markdown version unless explicitly asked.

---
