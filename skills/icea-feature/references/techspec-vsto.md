# Tech Spec Overlay — VSTO (Visual Studio Tools for Office)

Used when `detected_stacks` contains `vsto`. Replaces the framework-specific sections
from `techspec-aspnet-mvc-jquery.md` with VSTO-appropriate equivalents.

---

## Ribbon Changes

List every Ribbon element added or modified by this story.

| Element | Type | ID (XML) | Callback method | Ribbon file |
|---|---|---|---|---|
| | Button / ToggleButton / Group / Tab / Gallery | | | |

**Ribbon callback signature pattern:**
```csharp
public void OnButtonClick(IRibbonControl control) { ... }
public void OnToggleButtonClick(IRibbonControl control, bool pressed) { ... }
public string GetLabel(IRibbonControl control) { ... }  // for dynamic labels
```

---

## TaskPane Changes

Complete this section only if a TaskPane is added or modified.

| Item | Value |
|---|---|
| Control type | WinForms UserControl / WPF UserControl |
| Instance scope | Per-document (Dictionary key: Workbook/Document) / Shared (one instance) |
| Show/hide trigger | Ribbon toggle button / document event / startup |
| Dispose trigger | `WorkbookBeforeClose` / `DocumentBeforeClose` |

---

## Office Event Handlers

List every Office event subscription wired or modified by this story.

| Event | Object type | Handler class | Handler method | Registered in |
|---|---|---|---|---|
| | Application / Workbook / Worksheet / Document | | | ThisAddIn_Startup / feature class |

**Subscription / unsubscription pairing (required for every row above):**
- Subscribed in: `ThisAddIn_Startup` or document-open handler
- Unsubscribed in: `ThisAddIn_Shutdown` or document-close handler

---

## COM Interop Usage

List every Office COM object obtained during the operation.

| Office object | Obtained from | Operation | Released via | Null-guarded |
|---|---|---|---|---|
| `Excel.Workbook` | `Application.ActiveWorkbook` | | `Marshal.ReleaseComObject` | Yes / No |
| `Excel.Worksheet` | `wb.Sheets[n]` | | `Marshal.ReleaseComObject` | Yes / No |
| `Excel.Range` | `ws.Range[...]` | | Two-call ReleaseComObject loop | Yes / No |

---

## Files Changed

| File | Change type | Purpose |
|---|---|---|
| `ThisAddIn.cs` | Modified | Startup/Shutdown wiring for new events |
| `{Feature}Ribbon.cs` | Added / Modified | Ribbon callbacks |
| `{Feature}Ribbon.xml` | Added / Modified | Ribbon XML layout |
| `{Feature}TaskPane.cs` | Added / Modified | TaskPane control |
| `{Feature}Service.cs` | Added / Modified | Business logic |

---

## AC Coverage Matrix

### AC → File

| AC | File(s) that implement it |
|---|---|
| AC-F1 | |
| AC-F2 | |

### File → AC

| File | ACs satisfied |
|---|---|

---

## Test Cases

| AC | Test type | Scenario | Expected |
|---|---|---|---|
| AC-F1 | Unit | Happy path | |
| AC-F1 | Unit | Error / edge case | |

**Test infrastructure requirements:**
- Mock `Microsoft.Office.Interop.*` interfaces with Moq — no live Office process
- Verify `Marshal.ReleaseComObject` call count via `mock.Verify(..., Times.Once())`
- Test project must build and run without Office installed

---

## Deployment Impact

| Item | Impact |
|---|---|
| ClickOnce manifest version | Must be bumped — any code change requires a new version |
| New COM registration | None / `{describe if new COM server registered}` |
| Office bitness | AnyCPU / x86 / x64 — confirm matches supported Office builds |
| `minimumRequiredVersion` | Update if this version fixes a security or data-loss bug |

---

## Reviewer Checklist

- [ ] Every COM object obtained from Office has a corresponding `Marshal.ReleaseComObject` call
- [ ] Events subscribed in Startup are unsubscribed in Shutdown — no unpaired subscriptions
- [ ] No Office object model calls execute off the UI thread
- [ ] TaskPane is tracked per-document if per-document scope is required
- [ ] No blocking calls (network, file I/O, DB) in `ThisAddIn_Startup`
- [ ] ClickOnce manifest version bumped in project properties
- [ ] Unit tests mock COM interfaces — no live Office automation in test project
- [ ] AC Coverage Matrix is complete — every AC maps to at least one file

---

## Open Questions

| # | Question | Owner | Blocking |
|---|---|---|---|
