# SCA Dependency Vulnerability Scan — Reference
Source: npm audit docs / pip audit / dotnet NuGet Audit / OSV.dev API v1
Last-validated: 2026-10-08
Stale-after: 90

## Coverage Map

| Ecosystem | Manifest | CLI Tool | Fallback |
|---|---|---|---|
| npm | package.json | `npm audit --json` | OSV.dev WebSearch |
| PyPI | requirements.txt / pyproject.toml / setup.py | `pip audit --format=json` | OSV.dev WebSearch |
| NuGet (.NET) | *.csproj | `dotnet list package --vulnerable --format json` | OSV.dev WebSearch |
| Maven (Java) | pom.xml | *(deferred Sprint 15 — stub advisory only)* | *(deferred Sprint 15)* |

---

## npm

Source: npm audit docs
Last-validated: 2026-10-08
Stale-after: 90

### Invocation

```bash
npm audit --json
```

Include dev-dependencies by default (do NOT pass `--omit dev`). Dev-dep vulnerabilities can affect the build pipeline and should be visible.

### JSON paths (npm v6)

```
.advisories[*].id                                    — advisory ID (numeric)
.advisories[*].title                                 — short description
.advisories[*].severity                              — "critical" | "high" | "moderate" | "low"
.advisories[*].cves[0]                               — CVE ID (use as rule; fall back to "NPM-{id}" if empty)
.advisories[*].recommendation                        — remediation text (basis for fix field)
.advisories[*].findings[0].paths[0].split(">").pop() — package name
.advisories[*].findings[0].version                  — installed version
.advisories[*].patched_versions                      — target fix version
```

### JSON paths (npm v7+)

> **Breaking change (npm v7+):** The `advisories` key was removed. Use `vulnerabilities` instead.

```
.vulnerabilities                          — object keyed by package name
.vulnerabilities[name].name              — package name
.vulnerabilities[name].severity          — "critical" | "high" | "moderate" | "low"
.vulnerabilities[name].via[*].cve        — CVE ID (may be absent — use via[*].url if missing)
.vulnerabilities[name].via[*].title      — short description
.vulnerabilities[name].via[*].range      — vulnerable version range
.vulnerabilities[name].fixAvailable.version — fix version (when fixAvailable is an object)
```

Implementer version check: run `npm --version` and compare major version to determine which JSON shape to parse.

---

## pip (PyPI)

Source: PyPI pip audit
Last-validated: 2026-10-08
Stale-after: 90

### Invocation

```bash
pip audit --format=json
```

Reads requirements.txt / pyproject.toml / setup.py. All declared dependencies are audited by default.

### JSON paths

```
.[*].name                  — package name
.[*].version               — installed version
.[*].vulns[*].id           — GHSA or CVE ID (use as rule field)
.[*].vulns[*].description  — short description (use in evidence field)
.[*].vulns[*].fix_versions[0] — first available fix version
```

---

## dotnet (NuGet)

Source: .NET NuGet Audit
Last-validated: 2026-10-08
Stale-after: 90

### Invocation

```bash
dotnet list package --vulnerable --format json
```

Scans all *.csproj files in scope. Reads from the NuGet.org advisory feed.

### JSON paths

```
.projects[*].frameworks[*].topLevelPackages[*].id
  — package name
.projects[*].frameworks[*].topLevelPackages[*].resolvedVersion
  — installed version
.projects[*].frameworks[*].topLevelPackages[*].vulnerabilities[*].severity
  — "Critical" | "High" | "Moderate" | "Low"
.projects[*].frameworks[*].topLevelPackages[*].vulnerabilities[*].advisoryUrl
  — advisory URL (extract CVE identifier from URL when present)
```

---

## Maven (Java) — Sprint 14 Stub

Source: N/A (deferred)
Last-validated: 2026-10-08
Stale-after: 90

Maven SCA is deferred to Sprint 15. When pom.xml is detected and no supported manifests are present, emit the advisory stub only — no sub-agent invoked, no SEC-DEP findings written.

Sprint 15 implementation note: use OWASP Dependency-Check CLI
(`dependency-check.sh --project {name} --scan pom.xml --format JSON`)
or `mvn org.owasp:dependency-check-maven:check`.

---

## OSV.dev Fallback

Source: OSV.dev API v1
Last-validated: 2026-10-08
Stale-after: 90

The OSV.dev fallback activates when:
- The CLI tool is absent from PATH, OR
- The CLI exits non-zero AND stdout contains no parseable vulnerability JSON

For each dependency declared in the manifest, use WebSearch to query OSV.dev:
```
site:osv.dev {package-name} {version}
```

Parse the OSV advisory page for:
```
.id                          — OSV ID (use as rule if no CVE assigned; prefer CVE- prefix)
.aliases[*]                  — check for CVE-* entries to use as rule field
.summary                     — short description (use in evidence field)
.affected[*].versions        — list of affected versions (check whether declared version is listed)
.affected[*].ranges[*].events — affected version ranges (alternative to versions list)
.severity[*].score           — CVSS score (use for severity normalization if present)
.severity[*].type            — "CVSS_V3" etc.
```

Rate-limit handling: if OSV.dev returns no results or HTTP 429 on the first attempt, retry once after a 2-second pause. If the second attempt also fails, emit:
```
SCA Scan: OSV.dev fallback unavailable for {ecosystem} — manual review recommended
```
Continue with any findings already collected from other ecosystems.

---

## Severity Normalization

Apply this mapping before populating the `severity` field of any SEC-DEP finding:

| Source | Source value | Schema value |
|---|---|---|
| npm | `critical` | `Critical` |
| npm | `high` | `High` |
| npm | `moderate` | `Medium` |
| npm | `low` | `Low` |
| pip / dotnet CVSS | CVSS >= 9.0 | `Critical` |
| pip / dotnet CVSS | CVSS 7.0-8.9 | `High` |
| pip / dotnet CVSS | CVSS 4.0-6.9 | `Medium` |
| pip / dotnet CVSS | CVSS < 4.0 | `Low` |
| OSV.dev | `CRITICAL` | `Critical` |
| OSV.dev | `HIGH` | `High` |
| OSV.dev | `MEDIUM` | `Medium` |
| OSV.dev | `LOW` | `Low` |

When no severity data is available from any source, default to `Medium` and note in the evidence field.

---

## SEC-DEP Finding Schema

Every SCA finding must have exactly these 8 fields for ledger and actionability compatibility (AC-F8):

| Field | Type | Description | Example |
|---|---|---|---|
| `fingerprint` | string | `FP-[0-9a-f]{8}` | `FP-a1b2c3d4` |
| `id` | string | Always `SEC-DEP` | `SEC-DEP` |
| `file` | string | Relative path to manifest | `package.json` |
| `line` | integer | Line number (use `1` if undeterminable) | `1` |
| `severity` | string | Critical / High / Medium / Low | `High` |
| `rule` | string | CVE-ID or OSV-ID | `CVE-2021-23337` |
| `evidence` | string | `{pkg}@{ver} -- {description}` | `lodash@4.17.15 -- Prototype Pollution` |
| `fix` | string | Remediation instruction | `Upgrade to lodash@4.17.21` |

---

## Governance

This file is managed by the ai-assisted-development plugin. To refresh when tool APIs or CVE data sources change:
```
REFRESH RULES sca-scan.md
```
