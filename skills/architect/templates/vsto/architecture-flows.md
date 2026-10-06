<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a user interaction through the add-in,
> debugging an event handler, or understanding COM object disposal chains.

## Ribbon Event Flows

### [Button / Group / Tab Name]

> What this flow does: [one-sentence description — e.g. "exports selected range to PDF and emails it"]

```mermaid
sequenceDiagram
    participant User
    participant Ribbon as [RibbonClass].[CallbackMethod]
    participant Service as [ServiceClass]
    participant Office as Excel/Word Object Model
    participant COM as COM Objects (must release)

    User->>Ribbon: Clicks [ButtonName] on [TabName] tab
    Note over Ribbon: Receives (RibbonButton sender, RibbonControlEventArgs e)
    Ribbon->>Service: [Method]([params])
    Note over Service: Business logic — [what it does, e.g. "validates selection, formats data"]
    Service->>Office: Globals.ThisAddIn.Application.[ActiveWorkbook / ActiveDocument]
    Note over Office: COM object acquired — reference count incremented; must be explicitly released
    Office-->>Service: [Application / Workbook / Worksheet / Range] COM object
    Service->>Office: [Operation on object — e.g. Range.Value, Range.Copy]
    Note over Office: [What the operation does — e.g. "reads cell values into array"]
    Office-->>Service: [Result / void]
    Service->>COM: Marshal.ReleaseComObject([range])
    Service->>COM: Marshal.ReleaseComObject([worksheet])
    Service->>COM: Marshal.ReleaseComObject([workbook])
    Note over COM: Release in reverse acquisition order — do NOT release Application (owned by Office host)
    COM-->>Service: References released
    Service-->>Ribbon: Complete
    Ribbon-->>User: UI feedback — [e.g. status bar message / MessageBox / ribbon button state reset]
```

---

## TaskPane Lifecycle

| Event | Action | File |
|---|---|---|
| Document/Workbook opened | TaskPane created, added to dictionary | |
| Ribbon button clicked | TaskPane.Visible toggled | |
| Document/Workbook closing | TaskPane disposed, removed from dictionary | |

> ⚠ Could not determine — populate from actual TaskPane management code

## Workbook / Document Events

| Event | Handler class | Handler method | Action |
|---|---|---|---|
| `WorkbookOpen` | | | |
| `WorkbookBeforeClose` | | | |
| `SheetChange` | | | |
| `SelectionChange` | | | |

> ⚠ Could not determine — populate from actual event subscriptions

## COM Interop Disposal Chains

For each Office object obtained from the object model, document the release chain:

### [Operation Name]

```csharp
var app = Globals.ThisAddIn.Application;          // Application — DO NOT release (not owned)
var wb  = app.ActiveWorkbook;                     // Workbook
var ws  = (Worksheet)wb.Sheets[1];                // Worksheet
var rng = ws.Range["A1"];                         // Range

// ... operation ...

Marshal.ReleaseComObject(rng);
Marshal.ReleaseComObject(ws);
Marshal.ReleaseComObject(wb);
// app not released — owned by Office host
```

> ⚠ Could not determine — populate from actual COM usage patterns
