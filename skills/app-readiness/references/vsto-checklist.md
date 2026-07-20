# VSTO Production Readiness Checklist

Used by `app-readiness/SKILL.md` Step 2/5 when `HOSTING_MODEL = vsto`.
Each domain lists evidence signals and Green / Yellow / Red thresholds.

---

## Domain 1 — Signing & Trust

**What to check:**
- csproj has `<SignAssembly>true</SignAssembly>` and `<ManifestKeyFile>` or `<ManifestCertificateThumbprint>`
- Certificate is CA-issued or EV (not self-signed) for production deployments
- Certificate expiry is > 90 days from today
- Trust mechanism is documented (ClickOnce trust prompt / Inclusion List / GPO)

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Certificate type | CA-issued or EV | Self-signed with GPO trust | Not signed |
| Certificate expiry | > 90 days | 30–90 days | < 30 days or expired |
| Signing wired in CI | Yes | Manual signing step | Not signed in CI |

---

## Domain 2 — ClickOnce Manifest

**What to check:**
- `.application` manifest file exists in the repo or is produced by the pipeline
- `deploymentProvider` URL uses HTTPS (not HTTP)
- `updateEnabled="true"` is set
- `minimumRequiredVersion` is set (prevents rollback to vulnerable versions)
- `expiration` for offline availability is configured if needed

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Deployment URL scheme | HTTPS | HTTP with network isolation | HTTP on public network |
| `minimumRequiredVersion` set | Yes | No — rollback possible | No manifest at all |
| Update check enabled | Yes | On-demand only | Disabled |

---

## Domain 3 — Office Compatibility

**What to check:**
- `TargetOfficeVersion` in csproj matches documented support matrix
- Both 32-bit and 64-bit Office are tested if `AnyCPU` build target is used
- PIAs / Interop assemblies match the oldest supported Office version
- No API calls that only exist in newer Office versions without version guards

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Bitness tested | Both 32 + 64 bit | One bitness only | Not tested |
| Version matrix documented | Yes | Partial | Not documented |
| PIA versions consistent | Match oldest target | Minor mismatch | Major version mismatch |

---

## Domain 4 — Build Pipeline

**What to check:**
- CI pipeline builds in Release configuration (not Debug)
- Pipeline code-signs the assembly and ClickOnce manifest
- Pipeline publishes the ClickOnce manifest to the deployment URL
- No debug symbols (`.pdb`) shipped in the ClickOnce package
- Build fails if signing certificate is missing

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Release config | Yes | Debug pushed manually | Always Debug |
| Signing in pipeline | Automated | Manual post-build step | Not signed in pipeline |
| Manifest published by pipeline | Yes | Manual publish | Not automated |

---

## Domain 5 — Test Coverage

**What to check:**
- Unit test project exists with `*Tests.csproj`
- Tests mock `Microsoft.Office.Interop.*` interfaces — no live Office automation
- COM disposal is verified (Marshal.ReleaseComObject call count via mock)
- Startup/Shutdown pairing is tested (every subscribe has a matching unsubscribe assertion)
- Tests pass without Office installed (build agent compatibility)

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Test project exists | Yes | Partial coverage | No tests |
| COM interfaces mocked | Yes | Some live Office automation | All live automation |
| Startup/Shutdown pairing tested | Yes | Not explicitly tested | No shutdown tests |

---

## Domain 6 — Secrets

**What to check:**
- No credentials, API keys, or connection strings in `app.config` committed to source
- Sensitive values use Windows Credential Manager or per-user isolated storage
- No hardcoded passwords or tokens in any `.cs` file

| Signal | Green | Yellow | Red |
|---|---|---|---|
| `app.config` secrets | None found | Placeholder / dev-only | Production credentials |
| Storage mechanism | Credential Manager / encrypted isolated storage | Plain isolated storage | Hardcoded in source |

---

## Domain 7 — Runbook

**What to check:**
- Deployment steps are documented (how to publish ClickOnce, how to update the manifest)
- Rollback procedure is documented (how to redeploy previous version, update `minimumRequiredVersion`)
- Trust configuration steps documented (how to push Inclusion List via GPO, or how users accept the trust prompt)
- On-call / support contact for add-in issues is identified

| Signal | Green | Yellow | Red |
|---|---|---|---|
| Deployment steps | Documented | Partial | Not documented |
| Rollback procedure | Documented | Not documented | Not possible (no previous manifest) |
| Trust configuration | Documented | Informal knowledge | Unknown |
