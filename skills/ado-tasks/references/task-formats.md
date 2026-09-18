# ADO Task Formats
# Used by ado-tasks skill

---

## Summary Table Format

Output this first — one row per task:

> Substitute the actual layer names, tags, and prefixes from the resolved stack in
> `architecture.md`. The placeholders below show the structure — do not emit them literally.

```
ADO #[ID] — [Feature Name] — Task Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Layer              Title                                    Tags           Est
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1   {frontend-layer}   [FE] ComponentName — AC-F1 behaviour    fe;{fe-tag}    4h
2   {frontend-layer}   [FE] Unit tests — ComponentName          fe;tests       2h
3   {backend-layer}    [BE] ControllerName — AC-F1 endpoint    be;{be-tag}    3h
4   {backend-layer}    [BE] Service + Repository — AC-F1       be;{be-tag}    4h
5   {backend-layer}    [BE] Unit + integration tests            be;tests       3h
6   {service-layer}    [SVC] ServiceName — AC-F1 logic         svc;{svc-tag}  3h
7   {service-layer}    [SVC] Tests — ServiceName                svc;tests      2h
8   Database           [DB] Migration — TableName changes      db             2h
9   QA                 [QA] Test cases — Story #[ID]           qa             3h
10  Infra              [INFRA] Pipeline config changes         infra          1h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Full Task Card Format

Output one block per task:

```
────────────────────────────────────────
TASK [N] — [Layer]
────────────────────────────────────────
Title:       [FE/BE/SVC/DB/QA/INFRA] ComponentName — AC-FN behaviour
Parent:      ADO #[Story ID]
Type:        Task
Tags:        [layer];[type]  e.g. frontend;angular
Assigned To: [leave blank — assign in ADO]
Estimate:    [N]h
Priority:    [2 = normal / 1 = high for blockers]

Description:
Implement [what this task does] as defined in ICEA AC-[N]:
"[paste the AC text]"

Related ICEA scenarios:
- Scenario [N]: [Given/When/Then one-liner]

Acceptance (task is done when):
- [ ] [Specific deliverable 1]
- [ ] [Specific deliverable 2]
- [ ] All related unit tests pass
- [ ] Code reviewed against ICEA

Depends on: [Task N — title, or "none"]
Blocks:     [Task N — title, or "none"]
────────────────────────────────────────
```

---

## Naming Conventions

Use the layer names from the resolved stack. The prefixes below are fixed regardless of stack.

| Layer | Prefix | Example (substitute your actual layer name) |
|---|---|---|
| Frontend component | `[FE]` | `[FE] UserFilterComponent — AC-F1 filter behaviour` |
| Frontend tests | `[FE]` | `[FE] Unit tests — UserFilterComponent` |
| Backend controller/service | `[BE]` | `[BE] UsersController — AC-F1 GET endpoint` |
| Backend tests | `[BE]` | `[BE] Tests — UserFilterService` |
| Service / middleware tier | `[SVC]` | `[SVC] NotificationService — AC-F2 email trigger` |
| Service / middleware tests | `[SVC]` | `[SVC] Tests — NotificationService` |
| DB migration | `[DB]` | `[DB] Migration — add FilterPresets table` |
| QA test cases | `[QA]` | `[QA] Test cases — ADO #1847 user filter` |
| Pipeline / config | `[INFRA]` | `[INFRA] Pipeline — add ICEA status gate` |

---

## Rough Effort Guidelines

Use these as starting ranges — flag that actual estimates need dev review.
Ranges apply regardless of the specific frontend/backend framework.

| Task Type | Typical Range |
|---|---|
| Frontend — new component (simple) | 3–5h |
| Frontend — new component (complex, with state) | 6–10h |
| Frontend — unit tests | 1–3h |
| Backend — new endpoint (thin controller/handler) | 2–4h |
| Backend — service + repository/data-access logic | 3–6h |
| Backend — unit + integration tests | 2–4h |
| Service / middleware — simple logic | 2–4h |
| Service / middleware — complex (external calls, orchestration) | 4–8h |
| Service / middleware — tests | 1–3h |
| DB migration (simple column/index) | 1–2h |
| DB migration (new table, relationships) | 2–4h |
| QA test case authoring | 2–4h |
| Infra / pipeline changes | 1–3h |

---

## ADO Story Description Block

Paste this into the User Story Description field in Azure DevOps:

```
--- INTENT ---
Problem:  [from ICEA]
User:     [from ICEA]
Impact:   [from ICEA]
Outcome:  [from ICEA]

--- CONTEXT ---
[One line per active layer, named in the project's actual stack from architecture.md —
 e.g. Frontend (component/route), Backend (API endpoint), Service tier, Data model (ORM entity):]
[Layer]:      [from ICEA]
Auth Policy:  [from ICEA]
Performance:  [from ICEA constraints]
Dependencies: [from ICEA]

--- EXAMPLES ---
Scenario 1 — Happy Path
  Given: [from ICEA]
  When:  [from ICEA]
  Then:  [from ICEA]

[repeat for all scenarios]

--- ACCEPTANCE CRITERIA ---
[ ] AC-F1:  [from ICEA]
[ ] AC-F2:  [from ICEA]
[ ] AC-NF1: [from ICEA]
[ ] AC-NF2: [from ICEA]

--- OUT OF SCOPE ---
- [from ICEA]
```
