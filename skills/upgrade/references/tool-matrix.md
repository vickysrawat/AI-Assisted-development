# Upgrade — Deterministic Tool Matrix & Install Guidance (Workstream A, AC-F2)

> Loaded by `skills/upgrade/SKILL.md` Step 2 (preflight). The probe + classification logic lives in
> `scripts/upgrade-tool-preflight.cjs`; this reference is the human-readable matrix and the
> per-OS install steps it prints. Design of record: `docs/plans/migrationSkill/upgrade.md`.

## Principle — check + guide, never bundle

The plugin is markdown + CJS with no binary distribution. It therefore **does not ship** upgrade
tools; it **probes** for them and, when missing/outdated, **prints** exact install + verify steps for
the developer to run. The skill never executes an install (LLM authors, human executes). Tool absence
is a graceful pause, not a hard failure.

## Preflight status → action

| Status | Exit | Meaning | Skill action |
|---|---|---|---|
| `available` | 0 | tool present at ≥ min version | proceed to gap/risk analysis |
| `outdated` | 2 | present but below min version | print upgrade-the-tool steps; pause; re-check |
| `needs-install` | 3 | tool not found on PATH | print install + verify steps; pause; re-check after install |
| `unknown-stack` | 4 | no tool mapped for this stack | STOP (Upgrade cannot serve this stack) |

## Matrix

| Stack | Tool | Probe (read-only) | Min | Coverage | Residual load |
|---|---|---|---|---|---|
| `dotnet` | `dotnet upgrade-assistant` | `dotnet --version` | 6 | Good | Low–Med |
| `angular` | `ng update` (Angular CLI) | `ng version` | 15 | Excellent | Low |
| `java` | OpenRewrite (via Maven) | `mvn --version` | 3 | Good (recipe-dependent) | Med |
| `python` | `pyupgrade` | `pyupgrade --version` | 3 | Modest (syntax, not deps) | Med–High |
| `nodejs` | `npm-check-updates` | `ncu --version` | 16 | Weak (bumps versions, not code) | High |
| `react` | `npm-check-updates` + jscodeshift | `ncu --version` | 16 | Modest | Med |

## Install + verify steps (printed per OS — the developer runs them)

Each command is presented with what it does + how to verify, per the script-transparency rule. The
skill emits the row for the developer's current OS only.

**dotnet** — installs the .NET SDK + the global `upgrade-assistant` tool.
- Windows: `winget install Microsoft.DotNet.SDK.8 ; dotnet tool install -g upgrade-assistant`
- macOS: `brew install --cask dotnet-sdk ; dotnet tool install -g upgrade-assistant`
- Linux: `sudo apt-get install -y dotnet-sdk-8.0 ; dotnet tool install -g upgrade-assistant`
- Verify: `dotnet tool list -g | grep upgrade-assistant`

**angular** — installs the Angular CLI globally (provides `ng update`).
- All OS: `npm install -g @angular/cli` · Verify: `ng version`

**java** — installs Maven (OpenRewrite runs as a Maven plugin).
- Windows: `choco install maven` · macOS: `brew install maven` · Linux: `sudo apt-get install -y maven`
- Verify: `mvn --version` then `mvn org.openrewrite.maven:rewrite-maven-plugin:dryRun`

**python** — installs `pyupgrade` (prefer pipx for isolation).
- All OS: `pipx install pyupgrade` · Verify: `pyupgrade --version`

**nodejs / react** — installs `npm-check-updates` (+ `jscodeshift` for React codemods).
- nodejs: `npm install -g npm-check-updates` · react: `npm install -g npm-check-updates jscodeshift`
- Verify: `ncu --version`
