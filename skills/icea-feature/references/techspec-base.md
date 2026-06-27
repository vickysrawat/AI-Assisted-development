# Tech Spec Base Template
# Framework-agnostic sections — used by all stacks.
# Framework-specific sections (files changed, implementation details,
# API contract, auth pattern) are defined in the overlay template for
# each stack. Step 8 selects the overlay from detected_stacks.
#
# Overlay templates:
#   techspec-aspnet-mvc-jquery.md   — ASP.NET MVC + jQuery/Bootstrap
#   techspec-aspnet-api-angular.md  — ASP.NET Web API + Angular
#   techspec-java-spring-angular.md — Java Spring Boot + Angular
#   techspec-python-fastapi.md      — Python FastAPI + Angular/React

---

# Tech Spec — {Feature Name}
ADO #{ID} · Release {R} · Sprint {S}
Status: DRAFT

---

## Overview

{One paragraph: what this story adds, which components it touches, and
the governing architectural pattern it follows. Written for a developer
picking this up cold. Include the stub/swap strategy if relevant.}

---

## AC Coverage Matrix

Every AC from the ICEA must be covered by at least one file change.
Every file change must satisfy at least one AC. Gaps are flagged ⚠.

### AC → File mapping

| AC | Description (short) | File(s) | Status |
|---|---|---|---|
| AC-F1 | {description} | {File N} | ✅ Covered / ⚠ Gap |

### File → AC mapping

| File | ACs satisfied |
|---|---|
| {File 1 — path} | AC-F1, AC-F2 |

**Coverage result:** {all N ACs covered, no orphaned file changes ✅ / list gaps ⚠}

> Populate this section after drafting the Files Changed section.
> A gap in either direction (AC with no file, file with no AC) is a
> blocking issue — resolve before SAVE TECH.

---

## Files Changed

{Populate from the framework overlay template — each stack has a
different file pattern. See overlay for table format and file sections.}

---

## {Framework-specific implementation sections}

{Populated from the overlay template for the detected stack.
Covers: controller/service/DTO implementation, UI layer, CSS.}

---

## API Changes

{New endpoints and changes to outbound API calls.
Populated from the overlay template.}

---

## Auth & Security

{Auth pattern, anti-forgery, XSS analysis.
Populated from the overlay template.}

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| {scenario} | {what the user sees / what the system does} |

---

## Sizing and Story Breakdown

| AC group | Work | SP |
|---|---|---|
| {AC group} | {description} | {N} |
| **Total** | | **{N}** |

**Total SP: {N}**
**Type: STORY / EPIC** — {rationale}

{If EPIC, add story breakdown table:}

| Story | Child ADO # | Logical scope | SP | Shippable alone? | Depends on |
|---|---|---|---|---|---|
| 1 | TBD | {what user can do after this ships} | {N} | Yes | None |

> Stories broken by logical completion — each story is a shippable slice
> delivering user value independently (≤5 SP). Never broken by AC.

---

## Definition of Done

The developer must tick every item before raising the PR.

**Implementation**
- [ ] All files changed as specified in Files Changed section
- [ ] No hardcoded secrets, connection strings, or credentials
- [ ] No `Debug.WriteLine`, `console.log`, or diagnostic output in production paths
- [ ] {Stack-specific items from overlay — e.g. stub comment format, DTO defaults}

**Quality**
- [ ] All unit tests (positive and negative) pass — see Test Cases section
- [ ] All integration tests pass — see Test Cases section
- [ ] Regression verified: existing behaviour unchanged when new feature is not exercised

**Review readiness**
- [ ] PR title format: `[ADO-{ID}] {Feature name} — {brief description}`
- [ ] PR description maps each changed file to its ACs (reference AC Coverage Matrix)
- [ ] ICEA committed in the same branch

### Reviewer Checklist

{Story-specific items for the Tech Lead / code reviewer.
Populated from the overlay template — covers security, stub integrity,
regression guard, and stack-specific concerns.}

---

## Open Questions

| # | Question | Owner | Deadline | Status |
|---|---|---|---|---|
| ❓[1] | {question} | {owner} | {deadline} | Open |

> All open questions must be resolved (or explicitly deferred with
> justification) before APPROVE. Use REVISE ADO-{ID} to resolve.

---

## Request Flow

{Sequence diagram in prose or ASCII showing the key flows:
happy path, error path, submit path. Include component names.}

---

## Rollback

{Is this purely additive? What is the rollback procedure?
Reference the standard ADO pipeline rollback if no data migrations.}

---

## Handover

### QA Team
{What was added, how to test manually, test data, environments,
regression risk.}

### DevOps / Platform Team
{Azure App Config changes, Key Vault secrets, new environment variables,
new HTTP clients, Docker/AKS changes, pipeline changes, DB migrations,
health check impact. If none, state explicitly.}

### Future Developer — {stub/swap or follow-on work}
{Step-by-step instructions for the next developer who picks this up.
Specific enough to follow without asking anyone a question.}

---

## Test Cases

> Tests derived from the AC list. Every AC gets at minimum:
> - One positive unit test (happy path)
> - One negative unit test (guard / error / edge case)
> Integration tests cover deployed behaviour end-to-end.
> NF ACs (performance, accessibility) have explicit verification methods.

### Positive Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| P-U1 | {class/method} | {input} | {expected output} | {AC-Fx} |

### Negative Unit Tests

| ID | Target | Input | Expected | AC |
|---|---|---|---|---|
| N-U1 | {class/method} | {input} | {expected output} | {AC-Fx} |

### Integration Tests

| ID | Scenario | Steps | Expected | AC |
|---|---|---|---|---|
| INT-1 | {scenario} | {steps} | {expected} | {AC-Fx} |

> NF AC verification:
> AC-NF1 ({description}): verified by {method — e.g. load test, browser
> devtools, Lighthouse, manual timing with stopwatch}.

---

### Revision Log
{date} — {description}
