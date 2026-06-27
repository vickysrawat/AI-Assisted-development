# ADO Work Item Description Template
# Paste this into the Azure DevOps Description field after ICEA approval

---

## Usage

After ICEA is approved, generate this block and tell the developer:
"Copy the section below into the ADO work item #[ID] Description field."

---

## Template to Generate

```
--- INTENT ---
Problem: [from ICEA Intent — Problem Statement]
User: [from ICEA Intent — Affected User]
Impact: [from ICEA Intent — Business Impact if Not Built]
Outcome: [from ICEA Intent — Measurable Success Metric]

--- CONTEXT ---
Angular Route/Component: [from ICEA]
.NET API: [from ICEA]
Node.js Service: [from ICEA]
Auth Policy: [from ICEA]
EF Core Entity: [from ICEA]
Performance: [from ICEA Constraints]
Dependencies: [from ICEA]

--- EXAMPLES ---
Scenario 1 — Happy Path
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

Scenario 2 — Edge Case: [name]
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

Scenario 3 — Edge Case: [name]
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

Scenario 4 — Error State
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

Scenario 5 — Permission Boundary
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

--- ACCEPTANCE CRITERIA ---
[ ] AC-F1: [from ICEA]
[ ] AC-F2: [from ICEA]
[ ] AC-NF1: [from ICEA]
[ ] AC-NF2: [from ICEA]

--- OUT OF SCOPE ---
- [from ICEA]
```

---

## Task Breakdown (generate after ADO description)

For each AC, generate tasks using this naming convention:

| Layer | Task Title | Tags |
|---|---|---|
| Angular | [FE] ComponentName — AC-F1 behaviour | frontend; angular |
| Angular | [FE] Unit tests — ComponentName | frontend; tests |
| .NET | [BE] ControllerName — AC-F1 endpoint | backend; dotnet |
| .NET | [BE] Unit + integration tests | backend; tests |
| Node.js | [SVC] ServiceName — AC-F1 logic | service; nodejs |
| Database | [DB] Migration — TableName changes | database |
| QA | [QA] Test cases — Story #XXXX | qa |
