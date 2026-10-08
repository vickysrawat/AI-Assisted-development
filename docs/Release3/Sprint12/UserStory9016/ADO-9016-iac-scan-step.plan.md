# Feature Plan — ADO-9016: Security Skill — IaC Scan Step (Sub-Agent)

**ADO:** 9016 · **Release:** R3 · **Sprint:** S12
**Status:** Saved — 2026-10-07

---

## Problem Statement

The security skill's three-pass architecture has no fingerprinted, ledger-tracked IaC/container
scanning. Infrastructure findings are produced by Pass 2 P4 as advisory items using P4-{seq}
format — they carry no SEC-NNN ID, no FP-fingerprint, and no ledger row. This means a container
running as root, a K8s deployment exposing plaintext secrets in env vars, or a docker-compose
service with `privileged: true` cannot be actioned via `/fix` or `/dismiss` and do not trigger
the `checkin` Check D gate. Three concrete gaps were confirmed from file reads: (1) P4 output
format is P{N}-{seq}, not SEC-NNN; (2) cloud-checks.md has no Dockerfile or docker-compose.yml
rules; (3) the K8s file glob does not cover UAT environment paths. The cost of not solving this
is false confidence — a repo with 12 K8s YAML files across two environments looks clean after a
security scan that only reviewed 1 file. Success is measurable: all four verification tests pass
(ledger test, per-rule test, env coverage test, checkin gate test).

---

## Story

As a developer using the security skill, I want IaC and container security findings to be
fingerprinted and tracked in the security ledger, so that I can action them with `/fix` and
`/dismiss` and they are enforced at the checkin gate just like any other security finding.

---

## Personas

**Developer (primary):** Uses Claude Code daily · runs `/security` before PRs · currently sees
P4 IaC findings as advisory prose that disappears after the session · success = IaC findings
persist in the ledger, can be `/fix`'d, and block the checkin gate.

**Plugin Maintainer (secondary):** Maintains `iac-scan.md` over time · needs `setup-status` to
flag staleness and `REFRESH RULES` to pull updates · success = `iac-scan.md` is registered,
stale-flagged, and refreshable without manual tracking.

---

## Feature Priority (MoSCoW)

**Must Have:**
- Dedicated IaC Scan step in SKILL.md (after .gitignore Pre-Scan, before Pass 1)
- Two IDs: `SEC-CONTAINER` (Dockerfile, docker-compose) + `SEC-IAC` (K8s YAML, Terraform)
- Fingerprinted findings in `security-ledger.md` — actionable via `/fix` and `/dismiss`
- Explicit `find` glob covering all IaC file types across all environment subdirs (no hardcoded env names)
- `validate-iac-findings.cjs` with malformed-output guard (no partial ledger writes on invalid sub-agent JSON)
- `iac-scan.md` with Dockerfile rules, docker-compose rules, K8s YAML rules + source citations + coverage map
- P4 de-duplication gate updated to exclude `SEC-CONTAINER`/`SEC-IAC` already raised

**Should Have:**
- `iac-scan.md` registered in `_deploy-manifest.json` (`stale_after_days: 90`) — enables `setup-status` flagging and `REFRESH RULES iac-scan.md`
- `cloud-checks.md` slimmed (per-rule container checks moved to `iac-scan.md`)
- Skip announcement when no IaC files found in scope

**Could Have:**
- Configurable `stale_after_days` threshold per-project (overridable in settings.json)

**Won't Have (this sprint):**
- Container image layer scanning (Trivy/Snyk) — requires external tooling; separate story
- Network policy K8s rules — require a live cluster; not automatable via file scan
- Terraform/CDK IaC rules (cloud-checks.md already covers these via P4) — no gap confirmed

---

## Release Plan

**MVP (this sprint):** IaC Scan step + `iac-scan.md` + `validate-iac-findings.cjs` + P4 narrowed.
Outcome: `SEC-CONTAINER`/`SEC-IAC` findings in ledger, checkin Check D enforces them.

**V1 (backlog):** `setup-status` staleness integration + `REFRESH RULES iac-scan.md` support.

---

## Step Order (resolved)

```
Pre-Scan — Static Asset Audit
Pre-Scan — .gitignore Coverage
Pre-Scan — IaC Scan (sub-agent)   ← NEW: after gitignore, before Pass 1
Pass 1 — Structured Rule-Based Scan
Pass 2 — Specialized Persona Passes  (P4 reverts to architectural advisory only)
Pass 3 — Free-Flow Adversarial Pass
```

---

## ID Decision (resolved)

Two IDs — ownership domains differ:
- `SEC-CONTAINER` → Dockerfile, docker-compose.yml (developer-owned)
- `SEC-IAC` → K8s YAML, Terraform, Helm (DevOps/Platform-owned)

Rationale: governance reports can split findings by owner type; consistent with how
Checkmarx KICS distinguishes container vs IaC categories.

---

## Assumptions

[1] The three-pass architecture spec (`skills/shared/three-pass-spec.md`) permits a named
    step between Pre-Scan and Pass 1 without requiring a spec version bump — UNVERIFIED.
    Must read before SKILL.md edit.

[2] The Agent tool is available within skill execution for sub-agent delegation — VERIFIED
    (used by other skills, confirmed by plugin architecture).

[3] `_deploy-manifest.json` format supports a `stale_after_days` property per file — UNVERIFIED.
    Must read before adding the entry.

[4] The `security-ledger.md` schema supports `SEC-CONTAINER` and `SEC-IAC` as new pattern IDs
    without schema changes — VERIFIED (ledger-schema.md uses the ID as a free-form field).

---

## Risks

[1] Sub-agent produces malformed JSON — Probability: M | Impact: H
    Mitigated by `validate-iac-findings.cjs` guard (no partial ledger writes).

[2] `three-pass-spec.md` prohibits intermediate steps — Probability: L | Impact: H
    Mitigated by reading the spec before writing SKILL.md (Assumption 1 must be verified).

[3] `iac-scan.md` drifts from current CIS Benchmark — Probability: H | Impact: M
    Mitigated by governance controls (source citations, `stale_after_days`, `REFRESH RULES`).

---

## Pre-mortem

"This shipped and failed. What went wrong?"

The `validate-iac-findings.cjs` guard was not wired into the SKILL.md step — a malformed
sub-agent response wrote partial findings to the ledger, causing `/fix` to fail silently on
entries with missing fingerprints. Alternatively, the `iac-scan.md` coverage map was omitted
as "nice to have" and the file silently covered 9 of 84 CIS Docker checks with no indication
to reviewers that 75 were excluded.

---

## Dependencies

[1] `skills/shared/three-pass-spec.md` — must be read before SKILL.md edit | Blocking: yes
[2] `_deploy-manifest.json` schema — must be read before registration | Blocking: yes (Should Have)

---

## Open Questions

None — all resolved before save.
