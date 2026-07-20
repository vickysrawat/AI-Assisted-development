<!-- TEMPLATE -->
# Architecture — Deployment & Operations

## Deployment Model

> ⚠ Not yet answered — complete the architect Step 0.5 VSTO questionnaire

| Item | Value |
|---|---|
| Deployment method | ClickOnce (network share / HTTPS) / MSI / Admin install |
| Deployment provider URL | |
| Install scope | Per-user (HKCU) / Machine-wide (HKLM) |
| Update mechanism | ClickOnce automatic / on-demand / manual redeploy |
| `minimumRequiredVersion` | |

<!-- ClickOnce deployment flow — populate from manifest and CI/CD pipeline config -->

<div style="background-color: white; padding: 25px; border-radius: 8px;">

```mermaid
flowchart LR
    Dev["Developer / CI"] -->|"build + Authenticode sign"| Manifest["ClickOnce Manifest"]
    Manifest -->|"publish"| Server["Deployment Server\n(network share / HTTPS)"]
    Server -.->|"update check on startup"| Client["Client Machine\n(Office + VSTO Add-in)"]
    style Dev fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
    style Manifest fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Server fill:#1F618D,color:#ffffff,stroke:#154360,stroke-width:2px
    style Client fill:#7F8C8D,color:#ffffff,stroke:#616A6B,stroke-width:2px
```

</div>

> ⚠ Could not determine — populate from actual ClickOnce manifest and pipeline config

## Trust & Code Signing

| Item | Value |
|---|---|
| Certificate type | Self-signed / CA-issued / EV |
| Certificate issuer | |
| Certificate expiry | |
| Trust mechanism | ClickOnce trust prompt / Inclusion List / GPO |

## Office Version and Bitness Matrix

| Office version | 32-bit | 64-bit | Notes |
|---|---|---|---|
| Microsoft 365 | | | |
| Office 2021 | | | |
| Office 2019 | | | |
| Office 2016 | | | |

## CI/CD Pipeline

| Item | Value |
|---|---|
| Tool | Azure DevOps Pipelines |
| Pipeline file | |
| Builds with code signing | Yes / No |
| Publishes ClickOnce manifest | Yes / No |
| ADO org | |
| ADO project | |

## Environments

| Environment | Deployment trigger | Manifest URL |
|---|---|---|

## Rollback Procedure

> ⚠ Not yet documented — add rollback steps here (e.g. redeploy previous manifest version,
> update minimumRequiredVersion, re-issue MSI with previous build)

## Known Infrastructure Constraints

> ⚠ Not yet documented — add Office Group Policy constraints, network share access rules,
> proxy settings for ClickOnce update checks, or AppLocker policies here

## Non-Functional Requirements & Constraints

| Item | Value |
|---|---|
| Startup time target | |
| Memory footprint target | |
| Supported Windows versions | |
| .NET Framework version required | |
| Compliance frameworks | |
