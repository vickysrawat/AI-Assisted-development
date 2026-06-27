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

#### Angular ([list component/service files changed])
- [File]: [What it implements — reference AC]
- [File]: [What it implements — reference AC]

#### .NET ([list controller/service/repo files changed])
- [File]: [What it implements — reference AC]
- [File]: [What it implements — reference AC]

#### Node.js ([list service files changed, or N/A])
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
- Unit test results: [paste dotnet test summary / ng test summary]
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
- [ ] .NET: FluentValidation on all new inputs
- [ ] .NET: ProblemDetails on all error responses
- [ ] .NET: ILogger structured (no string interpolation)
- [ ] Angular: OnPush on all new components
- [ ] Angular: async pipe used (no manual subscribe)
- [ ] Angular: loading / error / empty states handled
- [ ] Node.js: Zod validation at route level
- [ ] Node.js: no PII in log output
- [ ] No secrets or connection strings committed
- [ ] ICEA saved to docs/icea/ADO-[ID]-[feature].md
