# PR Description Template
# Used by pr-describe skill — fill every field from diff + ICEA

---

## [ADO-ID] [Feature Name] — [One-line summary of what this PR does]

### Linked Work Item
ADO #[ID] — [Work Item Title]
ICEA Status: Approved ✅

---

### What This PR Does
[2-3 sentences. What behaviour does this add or change? Write for a reviewer
who has not read the ICEA — enough context to understand without being a novel.]

---

### Changes by Layer
> One section per active layer from architecture.md. The headers below are an example
> for an Angular/.NET/Node.js stack — rename them to your project's actual layers.

#### [Frontend layer] ([list component/view files changed])
- [File]: [What it implements — reference AC]
- [File]: [What it implements — reference AC]

#### [Backend layer] ([list controller/service/repo files changed])
- [File]: [What it implements — reference AC]
- [File]: [What it implements — reference AC]

#### [Service tier] ([list service files changed, or N/A])
- [File]: [What it implements — reference AC]

#### Database ([migrations, schema changes, or N/A])
- [File]: [What changed]

#### Tests
- [File]: [What scenarios are covered — map to ICEA Examples]

---

### ICEA Acceptance Criteria Checklist
> Reviewer: verify each item against the code, not just the checkbox.

- [ ] AC-F1: [paste AC text] — implemented in [file:line]
- [ ] AC-F2: [paste AC text] — implemented in [file:line]
- [ ] AC-F3: [paste AC text] — implemented in [file:line]
- [ ] AC-NF1: [paste AC text] — validated by [test file or evidence]
- [ ] AC-NF2: [paste AC text] — validated by [test file or evidence]

---

### ICEA Scenario Coverage
> One test per scenario. Reviewer: confirm each scenario has a corresponding test.

| Scenario | Test File | Test Method | Status |
|---|---|---|---|
| Happy Path | [file] | [method name] | ✅ |
| Edge Case: [name] | [file] | [method name] | ✅ |
| Edge Case: [name] | [file] | [method name] | ✅ |
| Error State | [file] | [method name] | ✅ |
| Permission Boundary | [file] | [method name] | ✅ |

---

### Out of Scope (not in this PR)
[List items from ICEA Out of Scope section — confirms they were not accidentally included]
- [Deferred item — ADO #XXXX]

---

### Test Evidence
- Unit test results: [paste the test summary for each changed layer's test runner]
- Integration tests: [Pass / Fail / N/A]
- Manual test: [brief note on what was verified locally]
- Screenshot / recording: [attach for any UI changes]

---

### Reviewer Notes
[Anything the reviewer should pay particular attention to, known limitations,
or decisions made during implementation that deviate from the ICEA and why.]

---

### Definition of Done Checklist (author completes before requesting review)
- [ ] All ICEA Acceptance Criteria implemented
- [ ] All 5 ICEA scenarios covered by tests
- [ ] No behaviour outside ICEA scope introduced
- [ ] Per-layer quality bar met (input validation, structured error responses,
      structured logging with no PII, framework performance idioms) — see rules/ for
      the project's stack-specific rule files
- [ ] No secrets or connection strings committed
- [ ] ICEA saved to docs/Release{R}/Sprint{S}/UserStory{ID}/ADO-[ID]-[feature].icea.md
