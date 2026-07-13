# Security Skill — Pass 2 Persona Definitions
_Loaded during Pass 2 of the three-pass scan architecture._

---

## Purpose

Pass 2 runs several focused reviews, each anchored to one threat model. Each
persona has ONE job. They catch what flat checklists miss because they reason
about intent, context, and interaction patterns — not just syntax matching.

All personas are subordinate to `../../shared/personas-spec.md` guardrails:
- Lens, not roleplay. Never write in-character.
- Stack-agnostic. Expertise is the project's detected stack.
- Governance subordination. A persona's "experience" is never evidence.
- Never name the persona in findings.

---

## De-duplication gate (mandatory for every persona)

Before each persona begins, inject the Pass 1 findings summary and all prior
persona findings. The instruction is:

```
DO NOT re-report any finding that covers the same file + vulnerability class
combination as a Pass 1 or prior persona finding. Only report findings that
add NEW information.
```

See `../../shared/three-pass-spec.md` § Pass 2 for the full de-duplication
protocol and persona ordering rules.

---

## Persona Roster

### P1. Attacker (Red Team lens)

Lens: "How would I chain weaknesses to get in, move laterally, or exfiltrate?"

Looks for:
- Multi-step exploitation chains (e.g., IDOR + missing auth = full data access)
- Privilege escalation paths (horizontal and vertical)
- Authentication bypass sequences
- TOCTOU / race conditions that create exploitable security windows
- Trust boundary violations between components or services
- Session fixation, token reuse, or replay opportunities
- Logic flaws in authorization flow (order of operations, edge cases)

Does NOT look for:
- Individual injection patterns (covered by Pass 1 SEC-INJ)
- Individual misconfigurations (covered by Pass 1 SEC-CONFIG)
- Cryptographic weakness (covered by Pass 1 SEC-DATA)

Evidence rule: Every chain must cite at least two specific files/functions and
explain how they combine to create the exploitation path. Single-point findings
belong in Pass 1.

Max findings: 5

---

### P2. Data Protection Analyst

Lens: "Where does sensitive data flow unprotected, and what happens when it leaks?"

Looks for:
- PII flowing through components without encryption or masking
- Sensitive data crossing trust boundaries (frontend ↔ backend, service ↔ service)
- Data retention gaps — sensitive data stored longer than necessary
- Logging of sensitive data (even partial: first/last chars, counts)
- Export or reporting functions that over-expose data scope
- Data classification gaps — sensitive data handled without appropriate controls
- Cross-user data leakage through shared caches, sessions, or global state
- Missing data-at-rest encryption for sensitive fields

Does NOT look for:
- Secrets in source code (covered by Pass 1 SEC-DATA)
- Missing TLS (covered by Pass 1 SEC-DATA)
- Console logging (covered by Pass 1 SEC-CONSOLE)

Evidence rule: Every finding must identify the specific data type (e.g., "client
names", "A-Numbers", "case status") and the specific code path where protection
is missing. General "PII is not encrypted" findings without a specific flow are
not acceptable.

Max findings: 5

---

### P3. Access Control Auditor

Lens: "Who can access what they shouldn't, and where are the authorization gaps?"

Looks for:
- Endpoints where authorization is assumed but not enforced
- Role hierarchy gaps (e.g., regular user can access admin functions)
- Object-level authorization failures across service boundaries
- Client-side authorization decisions not backed by server enforcement
- Missing resource ownership checks in multi-tenant contexts
- API endpoints that return more data than the caller's role permits
- Authorization state that drifts (cached roles, stale tokens, lazy re-auth)

Does NOT look for:
- Individual IDOR patterns (covered by Pass 1 SEC-AUTHZ)
- Missing authentication (covered by Pass 1 SEC-AUTH)

Evidence rule: Every finding must name the specific endpoint or function and
explain what role/identity can access it vs. what should be permitted. "The app
lacks authorization" is not a finding — "GET /api/matters/{id} returns data for
any authenticated user regardless of matter assignment" is.

Max findings: 5

---

### P4. Infrastructure Hardener

Lens: "What is misconfigured at the deployment and infrastructure level?"

Looks for:
- Cloud IAM over-privilege (wildcard actions, broad resource scope)
- IaC misconfigurations (Terraform, CloudFormation, CDK, ARM)
- Container security issues (running as root, exposed ports, no resource limits)
- CI/CD pipeline secrets exposure or injection
- Network exposure (open security groups, public endpoints, missing WAF)
- TLS certificate issues (self-signed, expired, weak ciphers)
- Missing deployment hardening (security headers, rate limiting, WAF rules)

Does NOT look for:
- Application-level configuration (covered by Pass 1 SEC-CONFIG)
- Application-level secrets (covered by Pass 1 SEC-DATA)

Activation gate: This persona ONLY activates if infrastructure files are
detected in the scan scope:
- `*.tf`, `*.tfvars` (Terraform)
- `*.yaml` / `*.yml` with cloud provider patterns (CloudFormation, Kubernetes, Helm)
- `Dockerfile`, `docker-compose.yml`
- CI/CD pipeline files (`.github/workflows/`, `azure-pipelines.yml`)
- ARM templates (`*.json` with `$schema` containing `deploymentTemplate`)

If no infrastructure files are in scope, skip this persona entirely and
announce: "P4 (Infrastructure Hardener): skipped — no infrastructure files in scope."

When activated, load `cloud-checks.md` for provider-specific patterns.

Max findings: 5

---

## Output format for Pass 2 findings

Each persona finding follows this format:

```
### P{N}-{seq} — {Plain-language title}

Persona: P{N} ({persona name})
Severity: {Critical | High | Medium | Low}
CVSS v3.1: {score} ({vector}) — if applicable
Business severity: {override if different} — cite B1-B7 trigger
CWE: {CWE-ID} — if applicable

{Plain prose: what the code does, why it's a problem, who is affected.
Reference actual files and functions. 2-4 sentences.}

Evidence:
  {file1}:{function1} — {what it does}
  {file2}:{function2} — {how it connects}

Remediation:
  {specific fix — name the file and function, include corrected code}
```

---

## Adding or removing personas

To add a new persona:
1. Define it in this file following the template above
2. Give it a clear "Looks for" / "Does NOT look for" boundary
3. Update the persona ordering in the SKILL.md
4. Ensure no overlap with existing personas or Pass 1 patterns

To temporarily disable a persona (e.g., for a scan that has no infrastructure
files), use the activation gate pattern shown in P4.
