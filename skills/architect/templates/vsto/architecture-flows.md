<!-- TEMPLATE -->
# Architecture — Flows

> Load this file when tracing a user interaction through the add-in,
> debugging an event handler, or understanding COM object disposal chains.

## Ribbon Event Flows

### [Button / Group / Tab Name]

```
User clicks Ribbon button
  → {RibbonClass}.{CallbackMethod}(RibbonButton sender, RibbonControlEventArgs e)
    → {ServiceClass}.{Method}()
      → Excel.Application / Workbook / Worksheet / Range
        → Marshal.ReleaseComObject(...)
```

> ⚠ Could not determine — populate from actual Ribbon callbacks

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

```
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
