# Feature Plan — Security Skill: SCA Dependency Vulnerability Scan
ADO #9021 · Release R3 · Sprint S14
Status: ✅ Approved

---

## Problem Statement

The security skill scans source code (Pass 1–3) and IaC files (Pre-Scan IaC), but has no mechanism to detect known CVEs in the project's declared package dependencies. Developers can ship code that depends on packages with known high/critical severity vulnerabilities without any automated detection at development time. Dependency vulnerabilities are the most common entry point for supply-chain attacks (OWASP A06:2021) and are cheapest to fix before they reach production. Success: after this sprint, `/security` surfaces at least one SEC-DEP finding in any project with a known-vulnerable dependency in its manifest.

## Story

As a developer running /security, I want the scan to also check my declared dependencies (npm, pip, .NET, Maven) for known CVE vulnerabilities, so that I can discover and remediate vulnerable packages before they reach production.

## Personas

- **Developer:** writes features against the plugin-instrumented codebase · uses /security before PRs · goal: ship clean code · frustration: discovering a vulnerable lodash in code review · success: SEC-DEP finding surfaces alongside SEC-INJ and SEC-CONFIG findings, fixable with one /fix command.
- **Tech Lead:** reviews PRs · goal: no known-CVE packages merged to main · frustration: raw npm audit JSON output is hard to triage · success: SEC-DEP findings in the ledger are fingerprinted, dismissible, and block checkin Check D like other findings.

## Feature Priority (MoSCoW)

**Must Have:**
- Stack detection (package.json → npm, requirements.txt/pyproject.toml → pip, *.csproj → dotnet)
- Sub-agent invocation scoped to detected manifests + sca-scan.md
- SEC-DEP finding ID with 8-field schema aligned to existing iac-findings schema
- CLI tool primary path: npm audit --json / pip audit --format=json / dotnet list package --vulnerable
- WebSearch fallback path: parse manifest + query OSV.dev batch API when CLI tool absent
- validate-sca-findings.cjs (all-or-nothing batch validator, same pattern as validate-iac-findings.cjs)
- tests/validate-sca-findings.test.cjs (≥4 named test cases)
- sca-scan.md: CLI invocation specs + OSV.dev fallback query format + severity normalization table
- Graceful skip if no package manifest found (skip msg, <1s, no sub-agent)
- _deploy-manifest.json reference_files entry for sca-scan.md
- setup-status Section 1c-quin: sca-scan.md existence + staleness check

**Should Have:**
- Severity normalization: npm "moderate" → Medium; CVSS bands for pip/dotnet
- Finding deduplication: one SEC-DEP per (package@version, CVE-ID) pair per run
- Maven (pom.xml) advisory stub: detect + emit "Maven SCA deferred to Sprint 15" message

**Could Have:**
- SBOM-style package inventory summary at end of Pre-Scan output

**Won't Have (Sprint 14):**
- Automatic remediation (npm audit fix, pip install --upgrade)
- License compliance scanning
- Private registry support
- Maven automated CVE scan (OWASP Dependency-Check) — deferred Sprint 15

## Release Plan

- **MVP (Sprint 14):** npm + pip + .NET SCA scan, SEC-DEP findings, validate-sca-findings.cjs, WebSearch fallback, graceful skip, setup-status check
- **V2 (Sprint 15):** Maven automated scan, SBOM output, license compliance

## Assumptions (all resolved)

| # | Assumption | Resolution |
|---|---|---|
| 1 | npm dev-dependencies included by default | Accepted — include all (no --omit dev); documented in sca-scan.md |
| 2 | pip audit as primary Python tool | Accepted — pip audit --format=json; safety noted as alternative in sca-scan.md |
| 3 | Maven pom.xml: detect + emit advisory only | Accepted — detect pom.xml, emit advisory stub, sub-agent not invoked |
| 4 | OSV.dev batch API as WebSearch fallback | Accepted — one request per ecosystem (not per package) to stay within latency budget |

## Risks

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | npm audit output schema changes across Node versions | L | M | sca-scan.md documents exact JSON paths per tool + version; sub-agent normalizes |
| 2 | pip audit not installed (pip < 22.0) | M | L | WebSearch fallback activates; advisory emitted |
| 3 | OSV.dev API returns 429 (rate limit) on large manifests | L | M | Batch query per ecosystem; retry once; skip with advisory on second failure |
| 4 | dotnet --vulnerable requires NuGet feed access | L | M | Documented in sca-scan.md; fail gracefully with advisory if network unavailable |

## Pre-mortem

Most likely failure: sub-agent normalizes npm audit JSON incorrectly (npm v10 changed the shape of advisories.*.via[]). validate-sca-findings.cjs catches schema errors but the log output gives no clue what field mapping broke. Mitigation: sca-scan.md must document the exact JSON paths per tool + Node/pip/dotnet version, and the sub-agent prompt must reference those paths explicitly.

## Dependencies

| # | Dependency | Owner | Blocking |
|---|---|---|---|
| 1 | ADO-9016 (IaC Scan step — architectural pattern) | complete | No |

## Open Questions (all resolved at plan save)

| # | Question | Resolution |
|---|---|---|
| 1 | npm dev-deps included? | Yes — include all by default; --omit dev available as future option |
| 2 | pip audit vs safety? | pip audit as primary; safety as alternative noted in sca-scan.md |
| 3 | Maven stub or skip entirely? | Stub — detect pom.xml, emit advisory, no sub-agent |
| 4 | OSV.dev batch scope? | One request per ecosystem via WebSearch/WebFetch; not per package |
