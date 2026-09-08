<!--
  TRANSITION ACCEPTANCE CHECKLIST TEMPLATE  (go-live skill)
  ──────────────────────────────────────────────────────────
  Filling rules (SKILL.md enforces):
    • {{PLACEHOLDER}} → derive from evidence: readiness report, security ledger, code-review
                        ledger, architecture-deployment.md, pipeline. If a source is absent, emit
                        the row with status ⚠ TODO and a "run /X" note — never invent a finding.
    • ⚠ TODO          → people, dates, sign-offs, and any value needing a human/live check. Leave
                        literally in place.
    • {{#each …}} blocks → one row per derived item; DELETE the block if there is no data.
    • Strip every HTML comment from the final output.
  This is a ONE-TIME go/no-go gate, not a living doc. It ingests the other skills' outputs; it does
  NOT read application source.
-->
# {{PROJECT_NAME}} — Support-Transition Acceptance Checklist (Go / No-Go)

> **Purpose:** the sign-off sheet the incoming support team uses to decide whether to accept
> {{PROJECT_NAME}} into support, and the go/no-go gate for go-live. Each item has an owner, a
> status, and required evidence — "someone said it's fine" is not evidence.
>
> **Context:** {{GOLIVE_CONTEXT — e.g. go-live target date; support handover timing}}.
> {{BUSINESS_CONTEXT_NOTE — e.g. blast radius / data sensitivity, if known}}.
>
> **Status:** DRAFT · Last updated: {{DATE}}
>
> **Legend:** ☐ open · ⚠ in progress · ✅ done · 🔴 go-live blocker · 🟠 accept with fast-follow

---

## A. Go-live blockers (must be ✅ before prod serves users)

<!-- Derive rows from: open Critical/High security-ledger findings (by FP-id); open Critical/High
     code-review defects (by CID); readiness Red domains; prod-env-exists / approval-gate / backup
     signals from architecture-deployment.md + pipeline. If a source ledger/report is ABSENT, emit
     the corresponding ⚠ TODO row (see the "sources absent" rows) — do not silently drop it. -->
| # | Item | Sev | Owner | Status | Evidence required |
|---|---|---|---|---|---|
{{#each BLOCKERS}}
| A{{this.n}} | {{this.item}} | 🔴 | {{this.owner}} | ☐ | {{this.evidence}} |
{{/each}}
{{#if SECURITY_LEDGER_ABSENT}}
| A? | **Security posture unverified** — no security report found | 🔴 | ⚠ TODO | ☐ | Run `/security-review`; confirm no open Critical/High |
{{/if}}
{{#if CODEREVIEW_LEDGER_ABSENT}}
| A? | **Code-defect posture unverified** — no code-review report found | 🔴 | ⚠ TODO | ☐ | Run `/code-review`; confirm no open Critical/High |
{{/if}}
{{#if READINESS_ABSENT}}
| A? | **Production readiness unassessed** — no readiness report found | 🔴 | ⚠ TODO | ☐ | Run `/app-readiness`; resolve any Red domain |
{{/if}}

---

## B. Accept-with-fast-follow (agree owner + due date; not go-live blockers)

<!-- Derive from readiness Amber (score-3) domains and open Medium findings. -->
| # | Item | Sev | Target | Owner | Status |
|---|---|---|---|---|---|
{{#each FAST_FOLLOW}}
| B{{this.n}} | {{this.item}} | 🟠 | {{this.target}} | {{this.owner}} | ☐ |
{{/each}}

---

## C. Knowledge transfer (evidence the team can actually operate it)

| # | Item | Owner | Status |
|---|---|---|---|
| C1 | Walkthrough of the Operational Runbook + all failure-mode playbooks | Dev→Support | ☐ |
| C2 | Live demo: deploy, **rollback**, and restart in a non-prod env | Dev→Support | ☐ |
| C3 | Support team has all access listed in the Runbook §4 | Support | ☐ |
| C4 | Demo: rotate a secret end-to-end | Dev→Support | ☐ |
{{#each EXTRA_KT}}
| C{{this.n}} | {{this.item}} | {{this.owner}} | ☐ |
{{/each}}
| C? | Ownership & contacts confirmed reachable | Both | ☐ |
| C? | Hypercare start/end dates + how to reach the dev team recorded | Both | ☐ |

---

## D. Artifacts handed over

<!-- Auto-link artifacts that exist on disk; mark missing ones ⚠ TODO. -->
| Artifact | Location | Received? |
|---|---|---|
| Operational runbook | {{RUNBOOK_LINK_OR_TODO}} | {{RUNBOOK_STATUS}} |
| Readiness assessment | {{READINESS_LINK_OR_TODO}} | {{READINESS_STATUS}} |
| Security report | {{SECURITY_LINK_OR_TODO}} | {{SECURITY_STATUS}} |
| Code review report | {{CODEREVIEW_LINK_OR_TODO}} | {{CODEREVIEW_STATUS}} |
| Architecture docs | [../../.claude/architecture/](../../.claude/architecture/) | {{ARCH_STATUS}} |
{{#each EXTRA_ARTIFACTS}}
| {{this.name}} | {{this.location}} | {{this.status}} |
{{/each}}

---

## Recommendation

{{RECOMMENDATION — a plain-English go / conditional-go / no-go call, grounded ONLY in the rows
above. State the sharpest go-live risks (the Section A blockers) and note that Sections B/C are the
support team's acceptance conditions with named owners + due dates. If Section A cannot be fully ✅,
the choices are: (1) slip go-live, or (2) go live with a documented, time-boxed exception signed by
the accountable owner below.}}

---

## Sign-off

| Party | Name | Decision (Accept / Accept-with-exceptions / Reject) | Date |
|---|---|---|---|
| Support lead (incoming) | ⚠ TODO | | |
| Dev team lead (outgoing) | ⚠ TODO | | |
| Product owner | ⚠ TODO | | |
| Engineering manager | ⚠ TODO | | |

**Exceptions granted at go-live (if any):** ⚠ TODO — list item #, reason, owner, remediation date.
