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
[One line per active layer, named in the project's actual stack from architecture.md —
 e.g. Frontend (component/route), Backend (API endpoint), Service tier, Data model (ORM entity):]
[Layer]: [from ICEA]
Auth Policy: [from ICEA]
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

For each AC, generate tasks using this naming convention (one section per active layer
derived from the resolved stack in architecture.md — do not emit these placeholder
names literally; substitute the actual layer names, prefixes, and tags for this project):

| Layer | Task Title | Tags |
|---|---|---|
| {frontend-layer} | [FE] ComponentName — AC-F1 behaviour | frontend; {fe-tag} |
| {frontend-layer} | [FE] Unit tests — ComponentName | frontend; tests |
| {backend-layer} | [BE] ControllerName — AC-F1 endpoint | backend; {be-tag} |
| {backend-layer} | [BE] Unit + integration tests | backend; tests |
| {service-layer} | [SVC] ServiceName — AC-F1 logic | service; {svc-tag} |
| Database | [DB] Migration — TableName changes | database |
| QA | [QA] Test cases — Story #XXXX | qa |
