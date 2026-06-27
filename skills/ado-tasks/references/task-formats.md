# ADO Task Formats
# Used by ado-tasks skill

---

## Summary Table Format

Output this first — one row per task:

```
ADO #[ID] — [Feature Name] — Task Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Layer     Title                                    Tags         Est
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1   Angular   [FE] ComponentName — AC-F1 behaviour    fe;angular   4h
2   Angular   [FE] Unit tests — ComponentName          fe;tests     2h
3   .NET      [BE] ControllerName — AC-F1 endpoint    be;dotnet    3h
4   .NET      [BE] Service + Repository — AC-F1       be;dotnet    4h
5   .NET      [BE] Unit + integration tests            be;tests     3h
6   Node.js   [SVC] ServiceName — AC-F1 logic         svc;nodejs   3h
7   Node.js   [SVC] Jest tests — ServiceName           svc;tests    2h
8   Database  [DB] Migration — TableName changes      db           2h
9   QA        [QA] Test cases — Story #[ID]           qa           3h
10  Infra     [INFRA] Pipeline config changes         infra        1h
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

| Layer | Prefix | Example |
|---|---|---|
| Angular component | `[FE]` | `[FE] UserFilterComponent — AC-F1 filter behaviour` |
| Angular tests | `[FE]` | `[FE] Unit tests — UserFilterComponent` |
| .NET controller/service | `[BE]` | `[BE] UsersController — AC-F1 GET endpoint` |
| .NET tests | `[BE]` | `[BE] xUnit tests — UserFilterService` |
| Node.js service | `[SVC]` | `[SVC] NotificationService — AC-F2 email trigger` |
| Node.js tests | `[SVC]` | `[SVC] Jest tests — NotificationService` |
| DB migration | `[DB]` | `[DB] Migration — add FilterPresets table` |
| QA test cases | `[QA]` | `[QA] Test cases — ADO #1847 user filter` |
| Pipeline / config | `[INFRA]` | `[INFRA] Pipeline — add ICEA status gate` |

---

## Rough Effort Guidelines

Use these as starting ranges — flag that actual estimates need dev review:

| Task Type | Typical Range |
|---|---|
| Angular new component (simple) | 3–5h |
| Angular new component (complex, with state) | 6–10h |
| Angular unit tests | 1–3h |
| .NET new endpoint (thin controller) | 2–4h |
| .NET service + repo logic | 3–6h |
| .NET unit + integration tests | 2–4h |
| Node.js service (simple) | 2–4h |
| Node.js service (complex, external calls) | 4–8h |
| Node.js Jest tests | 1–3h |
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
Angular Route/Component: [from ICEA]
.NET API:                [from ICEA]
Node.js Service:         [from ICEA]
Auth Policy:             [from ICEA]
EF Core Entity:          [from ICEA]
Performance:             [from ICEA constraints]
Dependencies:            [from ICEA]

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
