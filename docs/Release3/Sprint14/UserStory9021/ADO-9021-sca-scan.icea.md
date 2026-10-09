# ICEA — Security Skill: SCA Dependency Vulnerability Scan
ADO #9021 · Release R3 · Sprint S14
Status: ✅ Approved
Type: STORY (estimated 8 SP)
Prepared: 2026-10-08

---

## Intent

Add a dedicated Software Composition Analysis (SCA) Pre-Scan step to the security skill that detects known CVE vulnerabilities in the project's declared package dependencies (npm, pip, .NET NuGet) and writes fingerprinted `SEC-DEP` findings to the security ledger — making dependency vulnerabilities discoverable, dismissible, and enforceable via checkin Check D, consistent with the existing IaC Scan Pre-Scan step architecture (ADO-9016).

---

## Context

### Background

OWASP A06:2021 (Vulnerable and Outdated Components) is among the most exploited attack categories. The security skill currently has no mechanism to surface known-CVE packages — developers only discover them via manual `npm audit` or post-deploy tooling.

The IaC Scan Pre-Scan step (ADO-9016) established the pattern for pre-scan steps: detect files → gate on reference doc → invoke sub-agent → validate-findings.cjs → merge to ledger. The SCA step follows the same architecture but targets package dependency manifests instead of IaC files.

### Affected modules

| Layer | Module | Change |
|---|---|---|
| L0 Skill | skills/security/SKILL.md | Insert SCA Pre-Scan section after IaC scan, before Pass 1 |
| L0 Reference | skills/security/references/sca-scan.md | New: tool integration spec + OSV.dev fallback + severity normalization |
| L1 Script | scripts/validate-sca-findings.cjs | New: batch validator (same pattern as validate-iac-findings.cjs) |
| L1 Test | tests/validate-sca-findings.test.cjs | New: standalone test file |
| L3 Manifest | .claude/rules/_deploy-manifest.json | Add reference_files entry for sca-scan.md |
| L0 Skill | skills/setup-status/SKILL.md | Add Section 1c-quin: sca-scan.md existence and staleness check |

### Sub-agent invocation design

The SCA sub-agent has two paths:

**Primary (CLI tool available and exits successfully):**
- Node.js: `npm audit --json`
- Python: `pip audit --format=json`
- .NET: `dotnet list package --vulnerable`

**Fallback (CLI tool absent OR exits non-zero with no parseable output):**
- Parse package manifest to extract package name and version pairs
- Query OSV.dev batch API via WebSearch: one request per ecosystem (npm/PyPI/NuGet)
- Normalize CVE response into 8-field finding schema
- Emit advisory noting fallback was used

### Finding schema — SEC-DEP

| Field | Value |
|---|---|
| fingerprint | FP followed by 8 lowercase hex characters |
| id | SEC-DEP |
| file | Package manifest path (e.g. package.json, requirements.txt) |
| line | 1 (line number not meaningful for dependency declarations) |
| severity | Critical / High / Medium / Low |
| rule | CVE identifier (e.g. CVE-2021-23337) or GHSA identifier |
| evidence | Package name at version followed by vulnerability description |
| fix | Upgrade instruction (e.g. Upgrade to lodash at fix version) |

### Severity normalization

| Source | Source value | Schema value |
|---|---|---|
| npm audit | critical | Critical |
| npm audit | high | High |
| npm audit | moderate | Medium |
| npm audit | low | Low |
| pip/dotnet CVSS 9.0+ | — | Critical |
| pip/dotnet CVSS 7.0–8.9 | — | High |
| pip/dotnet CVSS 4.0–6.9 | — | Medium |
| pip/dotnet CVSS below 4.0 | — | Low |
| OSV.dev CRITICAL | — | Critical |
| OSV.dev HIGH | — | High |
| OSV.dev MEDIUM | — | Medium |
| OSV.dev LOW | — | Low |

### Stack scoping

| Manifest file | Ecosystem | Tool | Fallback |
|---|---|---|---|
| package.json | npm | npm audit --json | OSV.dev npm |
| requirements.txt / pyproject.toml / setup.py | PyPI | pip audit --format=json | OSV.dev PyPI |
| *.csproj | NuGet | dotnet list package --vulnerable | OSV.dev NuGet |
| pom.xml | Maven | advisory stub only — Sprint 14 | deferred |

---

## Examples

### Example 1 — Node.js project: npm audit detects lodash vulnerability

**Setup:** Repo contains package.json with lodash at version 4.17.15.

**Trigger:** Developer runs `/security`.

**SCA Pre-Scan output:**
```
SCA Scan: detected package.json (npm)
SCA Scan: npm audit --json → 1 finding(s)
SCA Scan: validate-sca-findings.cjs → VALID 1
SCA Scan: 1 finding written to ledger (SEC-DEP)
```

**Ledger entry written:**
```
| SEC-DEP | FP-a1b2c3d4 | package.json | 1 | High | CVE-2021-23337 | lodash@4.17.15 — Command injection via template | Upgrade to lodash@4.17.21 | Open |
```

**Outcome:** Developer runs `/fix FP-a1b2c3d4` and the upgrade instruction is applied. `checkin` Check D blocks the PR until the finding is resolved or dismissed.

---

### Example 2 — Python project: pip audit absent, WebSearch fallback activates

**Setup:** Repo contains requirements.txt with requests==2.27.1. Developer environment has pip 21.x (pip audit unavailable).

**Trigger:** Developer runs `/security`.

**SCA Pre-Scan output:**
```
SCA Scan: detected requirements.txt (PyPI)
SCA Scan: pip audit not available — falling back to OSV.dev query (WebSearch)
SCA Scan: OSV.dev (PyPI) → 1 finding(s)
SCA Scan: validate-sca-findings.cjs → VALID 1
SCA Scan: 1 finding written to ledger (SEC-DEP)
```

**Outcome:** Identical result to CLI path. Finding is fingerprinted, ledger-written, actionable regardless of tool availability.

---

### Example 3 — No package manifests found

**Setup:** Repo has no package.json, requirements.txt, pyproject.toml, *.csproj, or pom.xml.

**Trigger:** Developer runs `/security`.

**SCA Pre-Scan output:**
```
SCA Scan: skipped — no package manifests found in scope
```

**Outcome:** Sub-agent is not invoked. Pass 1 proceeds immediately. Step completes in under 1 second.

---

### Example 4 — Maven pom.xml detected (Sprint 14 stub)

**Setup:** Repo contains pom.xml.

**Trigger:** Developer runs `/security`.

**SCA Pre-Scan output:**
```
SCA Scan: detected pom.xml (Maven) — automated Maven SCA deferred to Sprint 15.
  Manual review recommended: run mvn dependency:tree and check against osv.dev.
```

**Outcome:** Sub-agent is not invoked for Maven. Other stacks present in the same repo are scanned normally.

---

## Acceptance Criteria

### Assumptions

| # | Assumption |
|---|---|
| A1 | npm dev-dependencies are included in the scan by default (no --omit dev flag); this is the safer default and is documented in sca-scan.md |
| A2 | pip audit (PyPI) is the primary Python tool; safety is noted as an alternative in sca-scan.md |
| A3 | checkin Check D treats all security ledger IDs uniformly with no ID allowlist — SEC-DEP findings will be picked up automatically without changes to the checkin skill (confirmed by ADO-9016) |
| A4 | OSV.dev batch API accepts one request per ecosystem; rate limiting is unlikely for typical manifests (<200 packages per ecosystem) |

### Functional

| AC | Description |
|---|---|
| AC-F1 | SCA Pre-Scan step positioned after IaC Scan Pre-Scan step, before Pass 1, in skills/security/SKILL.md |
| AC-F2 | Manifest detection covers: package.json (npm), requirements.txt / pyproject.toml / setup.py (pip), *.csproj (.NET NuGet) |
| AC-F3 | pom.xml detected → advisory stub emitted ("automated Maven SCA deferred to Sprint 15"); sub-agent not invoked for Maven |
| AC-F4 | Skip message if no package manifest found; sub-agent not invoked; step completes in under 1 second |
| AC-F5 | Sub-agent primary path: CLI tool invoked (npm audit --json / pip audit --format=json / dotnet list package --vulnerable) when available on PATH and exits successfully |
| AC-F6 | Sub-agent fallback path: activates when CLI tool is absent OR exits with non-zero status and produces no parseable output; parses manifest for package-at-version pairs and queries OSV.dev batch API via WebSearch; advisory emitted noting fallback was used |
| AC-F7 | All SCA findings emitted with ID SEC-DEP; no other ID values accepted |
| AC-F8 | Findings produce FP-fingerprinted ledger entries with Status: Open; 8 required fields: fingerprint, id, file, line, severity, rule (CVE-ID or GHSA-ID), evidence, fix |
| AC-F9 | fix field is required in validated batch; /fix FP-id resolves SEC-DEP findings using the upgrade instruction in the fix field |
| AC-F10 | /dismiss FP-id works on SEC-DEP findings; correct ledger format ensured |
| AC-F11 | checkin Check D fails on any OPEN SEC-DEP finding in the security ledger (per Assumption A3 — no code change to checkin skill required) |
| AC-F12 | validate-sca-findings.cjs validates JSON batch; 8 required fields enumerated; VALID_IDS contains only SEC-DEP; all-or-nothing semantics |
| AC-F13 | Missing-field or invalid batch: entire batch rejected; raw output written to .claude/logs/sca-scan-YYYY-MM-DD.md; advisory raised; zero ledger writes |
| AC-F14 | tests/validate-sca-findings.test.cjs passes with 4 named test cases: valid batch accepted, missing-field batch rejected, empty array accepted, non-JSON string rejected |
| AC-F15 | sca-scan.md documents: CLI invocation + output JSON schema for npm/pip/dotnet; OSV.dev batch API fallback format + ecosystem identifiers + response parsing; severity normalization table |
| AC-F16 | Each sca-scan.md section header carries Source, Last-validated, and Stale-after metadata |
| AC-F17 | Severity normalization enforced: npm moderate maps to Medium; CVSS 9.0+ maps to Critical; CVSS 7.0–8.9 maps to High; CVSS 4.0–6.9 maps to Medium; CVSS below 4.0 maps to Low |
| AC-F18 | npm dev-dependencies are included in the scan by default; documented in sca-scan.md (Assumption A1) |
| AC-F19 | _deploy-manifest.json reference_files array entry added for sca-scan.md (enables REFRESH RULES tooling) |
| AC-F20 | setup-status Section 1c-quin: if sca-scan.md missing then red; reads Last-validated and Stale-after; amber at 90 days, red at 180 days |

### Non-functional

| AC | Description |
|---|---|
| AC-NF1 | Skip path (no manifests found) completes in under 1 second; sub-agent not invoked |
| AC-NF2 | validate-sca-findings.cjs validates 50 findings in under 500ms |
