# Worked Examples
# Shows the skill what good input → output looks like

---

## Example 1 — Vague feature request (missing all three identifiers)

**Developer says:**
> "Add a filter to the user list page"

**Skill intercepts:**
```
⏸ ICEA GATE — Feature detected.
I'll create the ICEA document before writing any code.
This takes ~2 minutes and prevents rework.

Before I create the ICEA, I need a few details:

  ADO #:       [e.g. ADO #1847]          ← the work item ID
  Release #:   [e.g. Release 3 / R3]     ← the release this ships in
  Sprint #:    [e.g. Sprint 12 / S12]    ← the sprint it is planned for

Please provide any that are missing above.
```

**Developer replies:** ADO #1847, Release 3, Sprint 12

**Skill outputs ICEA draft then ends with:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 APPROVAL REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply with one of:

  ✅ APPROVED          — ICEA is correct, start code generation
  ✏  EDIT [section]   — e.g. "EDIT Context — the endpoint is POST not GET"
  ❌ REJECT [reason]   — Fundamental rethink needed

No code will be generated until you reply APPROVED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Example 2 — Edit during review

**Developer says:** EDIT Examples — add a scenario for when the user has no search results

**Skill responds:**
```
Updated — Scenario 3 (Edge Case: No Results):

### Scenario 3 — Edge Case: No Results
| | |
|---|---|
| Given  | Admin filters by a string that matches no users |
| When   | The filter is applied |
| Then   | Empty state displays: "No users match your search" |
| And    | A "Clear filter" button is visible |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 APPROVAL REQUIRED
[approval block repeated]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Example 3 — Impatient developer tries to skip

**Developer says:** just write the code, we can do the ICEA later

**Skill responds:**
```
I understand the pressure — but the ICEA gate is here to protect you.

The most common source of rework on this team is building the wrong
thing or missing edge cases. The ICEA takes 2 minutes now and saves
hours of PR comments and scope debates later.

If this is a genuine emergency, prefix your message with /skip-icea
and I will proceed with a warning.

Otherwise — what is the ADO work item ID?
```

---

## Example 4 — APPROVED response triggers code generation

**Developer says:** APPROVED

**Skill responds:**
```
✅ ICEA Approved — Generating full implementation
   ADO #1847 · Release 3 · Sprint 12 · User List Filter
   Saving ICEA     → docs/Release3/Sprint12/UserStory1847/ADO-1847-user-list-filter.icea.md
   Saving TechSpec → docs/Release3/Sprint12/UserStory1847/ADO-1847-user-list-filter.techspec.md

Generating in order:
1. .NET — UsersController + IUserFilterService + UserFilterService
2. EF Core — UserFilterDto
3. Angular — UserFilterComponent + UserFilterService
4. Tests — one test per ICEA scenario (5 total per layer)
5. PR description with ICEA compliance checklist
```

[Full implementation follows]

---

## Example 5 — VSTO feature request (Ribbon button)

**Developer says:**
> "Add an Export to PDF button in the Excel Ribbon that exports the active selection"

**Skill intercepts and collects identifiers (ADO #2241, Release 4, Sprint 15).**

**Skill drafts ICEA — key sections that differ from web projects:**

```
## Intent

Problem Statement:
  Analysts need to share specific data ranges from Excel with stakeholders who do not have
  Excel access. Currently they take screenshots or manually copy data, which is error-prone
  and loses formatting. A one-click PDF export of the selected range eliminates this step.

Story:
  As an analyst, I want to export my selected Excel range to a PDF with one Ribbon click,
  so that I can share formatted data without requiring the recipient to have Excel.

## Context

Stack: Excel VSTO add-in (.NET Framework 4.8)
Module: ExportFeature (to be created)
Office host: Excel (Excel.Application, Workbook, Worksheet, Range)
Ribbon: New "Export" button in the "Data Tools" custom Ribbon tab

## Examples

### Scenario 1 — Happy Path: valid rectangular range
| | |
|---|---|
| Given  | User selects range A1:D10 on the active worksheet |
| When   | User clicks "Export to PDF" in the Data Tools Ribbon tab |
| Then   | Save dialog appears pre-populated with the workbook name |
| And    | On confirm, a PDF is saved at the chosen path |
| And    | The active workbook and selection are unchanged |

### Scenario 2 — Non-contiguous selection
| | |
|---|---|
| Given  | User selects a multi-area range (e.g. A1:B5, D1:E5) |
| When   | User clicks "Export to PDF" |
| Then   | Error message: "Please select a single contiguous range to export" |
| And    | No file is created |

### Scenario 3 — Empty selection
| | |
|---|---|
| Given  | No cells are selected (or an empty range) |
| When   | User clicks "Export to PDF" |
| Then   | Error message: "Please select a range before exporting" |

### Scenario 4 — Export cancelled by user
| | |
|---|---|
| Given  | User clicks "Export to PDF" with a valid range |
| When   | User clicks Cancel in the Save dialog |
| Then   | No file is created; add-in returns to normal state with no error |

## Acceptance Criteria

AC-F1: Ribbon button "Export to PDF" appears in the "Data Tools" tab when any Excel workbook is open
AC-F2: Clicking the button opens a SaveFileDialog pre-set to .pdf extension
AC-F3: A valid contiguous range is exported to PDF preserving cell formatting
AC-F4: Non-contiguous selection shows an informative error and creates no file
AC-F5: Empty selection shows an informative error and creates no file
AC-F6: Cancelling the dialog creates no file and leaves the workbook unchanged

AC-NF1: All COM objects obtained during export are released via Marshal.ReleaseComObject
         before the callback returns — verified by unit test mock assertions
AC-NF2: Export works on both 32-bit and 64-bit Excel 2019 and Microsoft 365
AC-NF3: COMException is caught and displayed as a user-friendly message (not a crash)
AC-NF4: No credentials, file paths, or user data are logged

Out of scope:
- Exporting charts or pivot tables (addressed in ADO #2242)
- Email integration (out of scope for this release)
- Excel Online / web version
```

**Note on VSTO ICEA shape vs web ICEA shape:**
- No HTTP status codes, no REST endpoints, no Angular components
- Acceptance criteria reference COM lifecycle (AC-NF1), Office version matrix (AC-NF2),
  and COMException handling (AC-NF3) — concepts specific to Office add-in development
- "Out of scope" explicitly excludes other Excel object types to prevent scope creep
  across COM object boundaries

---

## Example 6 — Request that should NOT trigger the skill

**Developer says:** "why is the filter test failing on line 42?"

**Skill does NOT trigger** — this is a debugging request, not a new feature.

**Developer says:** "refactor UserFilterService to use async/await"

**Skill does NOT trigger** — this is refactoring existing behaviour, not new design.

---

## Example 6 — ADO ID provided but Release and Sprint missing

**Developer says:**
> "/icea-feature ADO-1847 — add export to CSV on the report page"

**Skill intercepts:**
```
⏸ ICEA GATE — Feature detected (Tier 2).
I'll create the ICEA document before writing any code.

I have the ADO ID (ADO #1847), but I still need:

  Release #:   [e.g. Release 3 / R3]     ← the release this ships in
  Sprint #:    [e.g. Sprint 12 / S12]    ← the sprint it is planned for

Please provide both before I draft the ICEA.
```

**Developer replies:** R4, Sprint 14

**Skill:** proceeds to draft the ICEA and saves to
`docs/Release4/Sprint14/UserStory1847/ADO-1847-export-to-csv.icea.md`
and
`docs/Release4/Sprint14/UserStory1847/ADO-1847-export-to-csv.techspec.md`

---

## Example 7 — All three identifiers provided upfront

**Developer says:**
> "/icea-feature ADO-2301 R5 S18 — add two-factor authentication to the login flow"

**Skill:** recognises all three identifiers immediately, skips the identifier prompt,
and proceeds directly to the change-tier classification and ICEA draft.

Files will be saved to:
`docs/Release5/Sprint18/UserStory2301/ADO-2301-two-factor-authentication.icea.md`
`docs/Release5/Sprint18/UserStory2301/ADO-2301-two-factor-authentication.techspec.md`
