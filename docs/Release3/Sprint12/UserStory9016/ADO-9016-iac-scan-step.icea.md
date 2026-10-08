# ICEA — Security Skill: Dedicated IaC Scan Step (Sub-Agent)
ADO #9016 · Release R3 · Sprint S12
Status: ✅ Approved

---

## Intent

### Goal
Add a dedicated, fingerprinted IaC Scan step to the security skill so that Dockerfile, docker-compose, and Kubernetes misconfiguration findings are tracked in the security ledger and enforced at the checkin gate — just like any other security finding.

### Problem Statement
The security skill's three-pass architecture has no fingerprinted, ledger-tracked IaC/container scanning. Infrastructure findings produced by Pass 2 P4 use `P4-{seq}` format — no SEC-NNN ID, no FP-fingerprint, no ledger row. A container running as root, a K8s deployment with plaintext env-var secrets, or a docker-compose service with `privileged: true` cannot be actioned via `/fix` or `/dismiss` and do not trigger `checkin` Check D. Three gaps are confirmed from file reads: (1) P4 output format is `P{N}-{seq}`, not `SEC-NNN`; (2) `cloud-checks.md` has no Dockerfile or docker-compose.yml per-rule checks; (3) the K8s file glob does not cover UAT environment paths — a repo with 12 K8s YAML files across two environments reviews only 1. Success is measurable: all four verification tests pass (ledger entry, per-rule fix, UAT env coverage, checkin gate enforcement).

### Business Impact
Untracked IaC findings produce false confidence — the developer sees a passing security scan while a container running as root, env-var secrets, or UAT misconfigs can merge without a recorded finding. Every sprint without this fix is a sprint where the checkin gate provides no enforcement for the entire IaC surface.

### Story
As a developer using the security skill, I want Dockerfile, docker-compose, and Kubernetes misconfiguration findings to be fingerprinted and tracked in the security ledger, so that I can action them with `/fix` and `/dismiss` and they are enforced at the checkin gate just like any other security finding.

### Success Metrics
- `security/security-ledger.md` contains at least one `SEC-CONTAINER` or `SEC-IAC` row with an FP-fingerprint after scanning a repo with IaC files
- `/fix FP-{id}` on a `SEC-CONTAINER` finding produces a corrected Dockerfile or docker-compose snippet
- `checkin` Check D fails when an OPEN `SEC-CONTAINER` or `SEC-IAC` finding is in the ledger
- All environment subdirectories (UAT, production, staging, etc.) appear in the scan scope report when K8s YAML files exist in them

---

## Context

### Personas

**Developer (primary):** Uses Claude Code daily · runs `/security` before PRs · currently sees P4 IaC findings as advisory prose that disappears after the session · success = IaC findings persist in the ledger, can be `/fix`'d, and block the checkin gate.

**Plugin Maintainer (secondary):** Maintains `iac-scan.md` rule catalog over time · needs `setup-status` to flag staleness automatically and `REFRESH RULES` to pull canonical updates · success = no manual tracking needed to keep the rule catalog current; `REFRESH RULES iac-scan.md` works out of the box.

### System Context

| Layer | Component / File | Change Type | Notes |
|---|---|---|---|
| Skill instruction | `skills/security/SKILL.md` | modify | Add IaC Scan Pre-Scan step (after .gitignore check, before Pass 1); add IaC detection to Step 0b; add explicit `find` glob to Step 0d; add sub-agent invocation + validation gate |
| Rule catalog | `skills/security/references/iac-scan.md` | new | Dockerfile rules, docker-compose rules, K8s YAML rules; source citations with version pins; coverage map; governance metadata (`Last-validated`, `Stale-after`) |
| Cloud checks ref | `skills/security/references/cloud-checks.md` | modify | Remove per-rule container checks (moved to `iac-scan.md`); cloud posture checks (AWS/GCP/Azure) remain for P4 architectural use |
| Persona definitions | `skills/security/references/pass2-personas.md` | modify | P4 de-duplication gate: add `SEC-CONTAINER`/`SEC-IAC` exclusions; narrow P4 "Looks for" to architectural concerns only (cloud IAM, network topology, trust boundaries) |
| Validation script | `scripts/validate-iac-findings.cjs` | new | Validates sub-agent JSON output before ledger merge; on invalid: log to `.claude/logs/`, raise single advisory, write NO partial findings to ledger |
| Test | `tests/validate-iac-findings.test.cjs` | new | 1:1 test coverage with the validation script |
| Plugin manifest | `_deploy-manifest.json` | modify | Register `skills/security/references/iac-scan.md` with `stale_after_days: 90` |

### Constraint Context

| Constraint | Type | Bounds the solution how? |
|---|---|---|
| CommonJS (.cjs) module system | technical | All new scripts use `require()` / `module.exports` — no ES module syntax |
| Node.js 20+ | technical | Scripts may use Node 20 APIs; no runtime polyfills needed |
| Three-pass architecture preserved | technical | New step is a Pre-Scan step; three-pass-spec.md confirmed: spec defines passes 1–3 only, not what precedes them; security SKILL.md already uses two Pre-Scan steps |
| No partial ledger writes | technical | `validate-iac-findings.cjs` must reject the entire sub-agent batch if any finding is malformed — all-or-nothing write |
| Tests 1:1 with scripts | technical | Every new `.cjs` script under `scripts/` requires a matching `tests/*.test.cjs` |
| Write Gate | process | All file changes require `APPROVE ADO-9016` before writing to disk |
| Feature Gate | process | Implementation blocked until ICEA has `Status: ✅ Approved` |

### Change Tier
**T2** — new named Pre-Scan step in an existing skill; one new reference file; two new scripts; three file modifications. No structural change to the three-pass spec or the ledger schema. No new external dependencies. Bounded scope with deterministic four-test verification.

---

## Examples

### Happy Path

| Given | When | Then (observable outcome) |
|---|---|---|
| Repo contains `Dockerfile` with no `USER` instruction | `/security --full` runs | `security/security-ledger.md` contains a `SEC-CONTAINER` row with `FP-xxxxxxxx` fingerprint, file `Dockerfile`, status `Open` |
| Repo contains `pipelines/k8s/uat/deployment.yaml` with `env: SECRET_KEY: plaintext` | `/security --full` runs | Ledger contains `SEC-IAC` row citing `pipelines/k8s/uat/deployment.yaml` (not just the production path) |
| `SEC-CONTAINER` finding `FP-abc12345` is Open in ledger | `/fix FP-abc12345` runs | Produces corrected Dockerfile snippet with `USER appuser` appended before the final `CMD` |
| `SEC-IAC` finding `FP-xyz67890` is Open in ledger | `checkin` runs | Check D fails and cites `FP-xyz67890` with file path and rule |

### Edge Cases

| Given | When | Then (expected behaviour) |
|---|---|---|
| Repo has no `Dockerfile`, `docker-compose*.yml`, or `k8s/**/*.yaml` | `/security` runs | IaC Scan announces `IaC Scan: skipped — no IaC files found in scope` and continues to Pass 1; no sub-agent invoked |
| `docker-compose.yml` has `privileged: false` set explicitly | IaC Scan runs | No `SEC-CONTAINER` finding for privileged — rule fires only on `true` |
| K8s YAML exists in `pipelines/k8s/staging/` (third env directory) | `/security --full` runs | `pipelines/k8s/staging/*.yaml` files appear in scan scope report; findings from them appear in ledger |
| P4 persona runs after IaC Scan already logged `SEC-CONTAINER` for `Dockerfile` | Pass 2 P4 runs | P4 de-duplication gate suppresses re-reporting `Dockerfile` + same vuln class; P4 produces only new architectural findings |

### Error States

| Given | When | Then (user-visible message + system behaviour) |
|---|---|---|
| Sub-agent returns malformed JSON (missing `fingerprint` field) | `validate-iac-findings.cjs` runs | Raw output written to `.claude/logs/iac-scan-{YYYY-MM-DD}.md`; single advisory finding raised: `"IaC scan output invalid — manual review required, see .claude/logs/iac-scan-{date}.md"`; NO findings written to ledger |
| Sub-agent returns valid JSON but `file` path does not exist on disk | Validation runs | Finding flagged `UNRESOLVABLE_PATH`; written to `.claude/logs/`; not written to ledger; advisory raised per finding |
| `iac-scan.md` is missing at scan time | IaC Scan step begins | Step halts: `⛔ IaC Scan blocked — iac-scan.md not found. Run /setup-sync to repair.` Pass 1 continues normally |

### Permission Boundary (mandatory)

| Given | When | Then (observable outcome) |
|---|---|---|
| This is a local developer tool with no users or roles | Any developer runs `/security` | All findings written to the local repo's `security/` folder only; no network transmission of findings; findings subject to the same Write Gate as all skill outputs |

---

## Acceptance

### Acceptance Criteria

**Structural — skill step:**
- [ ] AC-F1: `skills/security/SKILL.md` contains a named `IaC Scan` Pre-Scan step positioned after `.gitignore Coverage` and before Pass 1
- [ ] AC-F2: The step includes an explicit `find` command globbing `Dockerfile`, `docker-compose*.yml`, and `*.yaml` files under `k8s/`, `pipelines/`, `deploy/`, and `manifests/` directories recursively — no hardcoded environment names
- [ ] AC-F3: If no IaC files are found, the step announces `IaC Scan: skipped — no IaC files found in scope` and exits without invoking a sub-agent
- [ ] AC-F4: The step delegates to a sub-agent whose context is scoped to: the IaC file list, `iac-scan.md` rule catalog, `fingerprint-spec.md`, and the ledger output JSON schema — source code files are NOT passed to the sub-agent

**Finding IDs:**
- [ ] AC-F5: Dockerfile and docker-compose.yml findings are emitted with pattern ID `SEC-CONTAINER`
- [ ] AC-F6: Kubernetes YAML findings are emitted with pattern ID `SEC-IAC`
- [ ] AC-F7: Both IDs produce FP-fingerprinted ledger entries with `Status: Open` in `security/security-ledger.md`

**Actionability:**
- [ ] AC-F8: `/fix FP-{id}` works on `SEC-CONTAINER` findings and produces a corrected Dockerfile or docker-compose snippet
- [ ] AC-F9: `/dismiss FP-{id}` works on `SEC-IAC` findings and updates ledger status to `Dismissed`
- [ ] AC-F10: `checkin` Check D fails when any `OPEN` `SEC-CONTAINER` or `SEC-IAC` finding is in the ledger

**Validation script:**
- [ ] AC-F11: `scripts/validate-iac-findings.cjs` validates sub-agent JSON before ledger merge; required fields per finding: `fingerprint`, `id`, `file`, `line`, `severity`, `rule`, `evidence`, `fix`
- [ ] AC-F12: On any finding missing a required field: entire batch rejected; raw output written to `.claude/logs/iac-scan-{YYYY-MM-DD}.md`; single advisory finding raised; zero findings written to ledger
- [ ] AC-F13: `tests/validate-iac-findings.test.cjs` passes, covering: valid JSON accepted, missing-field batch rejected, empty array accepted (no IaC findings = no findings, no error), non-JSON string rejected

**Rule catalog:**
- [ ] AC-F14: `skills/security/references/iac-scan.md` contains at minimum: 5 Dockerfile rules (USER, pipefail, :latest tag, EXPOSE debug ports, COPY --chown), 5 docker-compose rules (privileged, cap_add, read_only, plaintext env secrets, network_mode: host), 9 K8s YAML rules (env secrets, securityContext.privileged, runAsNonRoot, hostPath, hostNetwork, cap_add, resources.limits, namespace: default, readOnlyRootFilesystem)
- [ ] AC-F15: Each rule section header contains `Source:` (benchmark name + version), `Last-validated:` (YYYY-MM-DD), `Stale-after:` (days)
- [ ] AC-F16: A coverage map table appears at the top of `iac-scan.md` with columns: Source, Total checks, Automated here, Excluded (reason)

**P4 narrowed:**
- [ ] AC-F17: `pass2-personas.md` P4 de-duplication gate explicitly excludes findings with IDs `SEC-CONTAINER` and `SEC-IAC` that are already in the ledger from the current scan run
- [ ] AC-F18: `cloud-checks.md` per-rule Dockerfile and docker-compose checks are removed from that file; AWS/GCP/Azure cloud posture checks remain

**Governance:**
- [ ] AC-F19: `_deploy-manifest.json` contains an entry for `skills/security/references/iac-scan.md` with `stale_after_days: 90`
- [ ] AC-F20: `setup-status` flags `iac-scan.md` amber/red when its `Last-validated` date is more than 90 days ago

**Non-functional:**
- [ ] AC-NF1: IaC Scan step adds no latency when no IaC files are found — skip path completes in <1s (sub-agent not invoked)
- [ ] AC-NF2: `validate-iac-findings.cjs` completes validation in <500ms for a batch of up to 50 findings

### Out of Scope

- We will NOT add container image layer scanning (Trivy/Snyk) — requires external tooling and a built image; this is a separate story
- We will NOT add K8s network policy rules — network policy enforcement requires a live cluster; not automatable via static file scan
- We will NOT add Terraform/CDK rules to `iac-scan.md` — these are already covered by P4 via `cloud-checks.md`; no confirmed gap
- We will NOT modify `skills/shared/three-pass-spec.md` — the new step is a Pre-Scan step, preserving the three-pass architecture unchanged

### Assumptions

- The three-pass architecture spec (`skills/shared/three-pass-spec.md`) permits named Pre-Scan steps before Pass 1 — **verified** (spec defines passes 1–3 only; security SKILL.md already uses two Pre-Scan steps without spec modification)
- The Agent tool is available within skill execution for sub-agent delegation — **verified** (used by other plugin skills)
- `security-ledger.md` schema accepts `SEC-CONTAINER` and `SEC-IAC` as valid pattern IDs without schema changes — **verified** (ledger-schema.md treats ID as a free-form field)
- `_deploy-manifest.json` format supports a `stale_after_days` property per file — **unverified** (must read manifest before implementing AC-F19)

### Open Questions

None.

### Risks & Pre-Mortem

| Risk | Probability | Impact |
|---|---|---|
| Sub-agent produces malformed JSON | M | H |
| `iac-scan.md` drifts from current CIS Benchmark within 90 days | H | M |
| `_deploy-manifest.json` does not support `stale_after_days` (Assumption 4 fails) | L | M |

**Pre-mortem:** "This shipped and failed. What went wrong?"
The `validate-iac-findings.cjs` guard was not wired into the SKILL.md step — a malformed sub-agent response wrote partial findings to the ledger with missing fingerprints, causing `/fix` to fail silently on those entries. Separately, the `iac-scan.md` coverage map was omitted and the file shipped covering 9 of 84 CIS Docker checks with no indication to reviewers that 75 were excluded — producing false confidence that container hardening was fully automated.

### Dependencies

- Blocked by: None
- Blocks: None
- Informational: Must read `_deploy-manifest.json` before implementing AC-F19 (Assumption 4 unverified)

### Irreversibility Flags

None identified — all changes are file edits reversible by revert; no schema migrations, no database changes, no external state modifications.

### D-Blocks

None.

---

## Story Breakdown

> If total SP ≤ 5: Type = STORY — single implementation ADO, no child ADOs needed.

**Type:** STORY
**Total SP:** 5

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | TBD | Developer runs `/security` on a repo with IaC files and sees `SEC-CONTAINER`/`SEC-IAC` findings in the ledger; `/fix` and `/dismiss` work; `checkin` Check D enforces them | 5 | Yes | None | ⏳ Pending |

---

## Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| Product | | | ⬜ Pending |
| Tech Lead | | | ⬜ Pending |

---

### Revision Log
2026-10-07 — Initial draft
